/* eslint-disable new-cap */
import { IPluginStorageFilter, Logger, Package, PluginOptions } from '@verdaccio/types';
import semver, { Range, satisfies } from 'semver';

import { BlockStrategy, CustomConfig, PackageBlockRule, ParsedAllowRule, ParsedBlockRule, ParsedConfig } from './types';

/**
 * Split a package name into name itself and scope
 * @param name
 */
function splitName(name: string): { name: string; scope?: string } {
  const parts = name.split('/');

  if (parts.length > 1) {
    return {
      scope: parts[0],
      name: parts[1],
    };
  } else {
    return {
      name: parts[0],
    };
  }
}

/**
 * Delete a tag if it maps to a removed version
 */
function cleanupTags(packageInfo: Package): void {
  const distTags = packageInfo['dist-tags'];
  Object.entries(distTags).forEach(([tag, tagVersion]) => {
    if (!packageInfo.versions[tagVersion]) {
      delete distTags[tag];
    }
  });
}

/**
 * Delete a time entry if it maps to a removed version
 */
function cleanupTime(packageInfo: Package): void {
  const time = packageInfo.time;
  if (!time) {
    return;
  }

  Object.keys(time).forEach((version) => {
    if (!packageInfo.versions[version]) {
      delete time[version];
    }
  });
}

function getLatestVersion(packageInfo: Package, versions: string[]): string | undefined {
  const time = packageInfo.time;
  if (!time) {
    // No time information, it's the best we can do
    const sortedVersions = versions.sort(semver.rcompare);
    return sortedVersions[0];
  }

  const timedVersions = versions
    .map((v) => ({
      version: v,
      time: time[v],
    }))
    .filter((v) => v.time);

  if (timedVersions.length === 0) {
    return undefined;
  }

  const timeOrderedVersions = timedVersions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return timeOrderedVersions[0].version;
}

/**
 * Set the latest tag if dist-tags/latest is missing
 */
function setupLatestTag(packageInfo: Package): void {
  const distTags = packageInfo['dist-tags'];
  if (distTags.latest) {
    // Tag 'latest' must only be fixed when latest version was blocked
    return;
  }

  const versions = Object.keys(packageInfo.versions);
  if (versions.length === 0) {
    return;
  }

  const untaggedVersions = versions.filter((v) => semver.valid(v) && Object.values(distTags).indexOf(v) === -1);
  if (untaggedVersions.length === 0) {
    return;
  }

  // Try stable versions first (no "-next" or "-beta", etc.)
  const stableVersions = untaggedVersions.filter((v) => !semver.prerelease(v));
  const latestStableVersion = getLatestVersion(packageInfo, stableVersions);
  if (latestStableVersion) {
    distTags.latest = latestStableVersion;
    return;
  }

  // Fallback to all versions
  const latestVersion = getLatestVersion(packageInfo, untaggedVersions);
  if (!latestVersion) {
    return;
  }

  distTags.latest = latestVersion;
}

/**
 * Set the created and modified times
 */
function setupCreatedAndModified(packageInfo: Package): void {
  const time = packageInfo.time;
  if (!time) {
    return;
  }

  const times = Object.values(time);
  if (times.length === 0) {
    return;
  }

  const sortedTimes = times.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  time['created'] = sortedTimes[0];
  time['modified'] = sortedTimes[sortedTimes.length - 1];
}

/**
 * Remove distfiles that are not used by any version
 */
function cleanupDistFiles(newPackage: Package): void {
  const distFiles = newPackage._distfiles;
  Object.entries(distFiles).forEach(([key, file]) => {
    const fileUrl = file.url;
    const versionPointingToFile = Object.values(newPackage.versions).find((v) => v.dist.tarball === fileUrl);
    if (!versionPointingToFile) {
      delete distFiles[key];
    }
  });
}

function getPackageClone(packageInfo: Readonly<Package>): Package {
  return {
    ...packageInfo,
    name: packageInfo.name ?? '',
    versions: {
      ...packageInfo.versions,
    },
    'dist-tags': {
      ...packageInfo['dist-tags'],
    },
    time: {
      ...packageInfo.time,
    },
    _distfiles: {
      ...packageInfo._distfiles,
    },
  };
}

/**
 * filter out all package versions that were published after dateThreshold
 * @param packageInfo
 * @param dateThreshold
 */
function filterVersionsByPublishDate(packageInfo: Package, dateThreshold: Date): Promise<Package> {
  const { versions, time, name } = packageInfo;

  if (!time) {
    throw new TypeError(`Time of publication was not provided for package ${name}`);
  }

  const clearVersions: string[] = [];

  Object.keys(versions).forEach((version) => {
    const publishTime = time[version];

    if (!publishTime) {
      throw new TypeError(`Time of publication was not provided for package ${name}, version ${version}`);
    }

    if (new Date(publishTime) > dateThreshold) {
      // clear untrusted version
      clearVersions.push(version);
    }
  });

  // delete version from versions
  clearVersions.forEach((version) => {
    delete packageInfo.versions[version];
  });

  return Promise.resolve(packageInfo);
}

function isScopeRule(rule: PackageBlockRule): rule is { scope: string } {
  // eslint-disable-next-line no-prototype-builtins
  return 'scope' in rule && typeof rule.scope === 'string';
}

function isPackageRule(rule: PackageBlockRule): rule is { package: string; versions: never } {
  // eslint-disable-next-line no-prototype-builtins
  return 'package' in rule && !('versions' in rule);
}

function isPackageAndVersionRule(
  rule: PackageBlockRule
): rule is { package: string; versions: string; strategy?: BlockStrategy } {
  // eslint-disable-next-line no-prototype-builtins
  return 'package' in rule && 'versions' in rule;
}

/**
 * Filter out all blocked package versions.
 * If all package is blocked, or it's scope is blocked - block all versions.
 */
function filterBlockedVersions(packageInfo: Package, block: Map<string, ParsedBlockRule>, logger: Logger): Package {
  const { scope } = splitName(packageInfo.name);

  if (scope && block.get(scope) === 'scope') {
    return {
      ...packageInfo,
      versions: {},
      readme: `All packages in scope ${scope} blocked by rule`,
    };
  }

  const blockRule = block.get(packageInfo.name);

  if (!blockRule) {
    return packageInfo;
  }

  if (blockRule === 'package') {
    return {
      ...packageInfo,
      versions: {},
      readme: `All package versions blocked by rule`,
    };
  }

  if (blockRule === 'scope') {
    throw new Error('Unexpected case - blockRule for package should never be "scope"');
  }

  const blockedVersionRanges = blockRule.versions;
  if (blockedVersionRanges.length === 0) {
    return packageInfo;
  }

  if (!blockRule.strategy) {
    blockRule.strategy = 'block';
  }

  if (blockRule.strategy === 'block') {
    let blockedVersionsCount = 0;
    Object.keys(packageInfo.versions).forEach((version) => {
      blockedVersionRanges.forEach((versionRange) => {
        if (
          satisfies(version, versionRange, {
            includePrerelease: true,
            loose: true,
          })
        ) {
          delete packageInfo.versions[version];
          blockedVersionsCount++;
        }
      });
    });

    if (blockedVersionsCount > 0) {
      // Add debug info for devs
      packageInfo.readme =
        (packageInfo.readme || '') +
        `\nSome versions(${blockedVersionsCount}) of package are blocked by rules: ${blockedVersionRanges.map(
          (range) => range.raw
        )}`;
    }

    return packageInfo;
  }

  // We assume that the order of versions is already sorted
  const nonBlockedVersions = { ...packageInfo.versions };
  const newVersionsMapping: Record<string, string | null> = {};

  blockedVersionRanges.forEach((versionRange) => {
    const allVersions = Object.keys(nonBlockedVersions);

    let lastNonBlockedVersion: string | null = null;
    let firstNonBlockedVersion: string | null = null;

    allVersions.forEach((version) => {
      if (
        satisfies(version, versionRange, {
          includePrerelease: true,
          loose: true,
        })
      ) {
        delete nonBlockedVersions[version];
        newVersionsMapping[version] = lastNonBlockedVersion;
      } else {
        lastNonBlockedVersion = version;
        firstNonBlockedVersion = firstNonBlockedVersion ?? version;
      }
    });
  });

  logger.debug(`Filtering package ${packageInfo.name}, replacing versions`);
  logger.debug(`${JSON.stringify(newVersionsMapping)}`);

  const removedVersions = Object.entries(newVersionsMapping).filter(([_, replace]) => replace === null) as [
    string,
    null
  ][];
  const replacedVersions = Object.entries(newVersionsMapping).filter(([_, replace]) => replace !== null) as [
    string,
    string
  ][];

  removedVersions.forEach(([version]) => {
    logger.debug(`No version to replace ${version}`);
    delete packageInfo.versions[version];
  });

  replacedVersions.forEach(([version, replaceVersion]) => {
    packageInfo.versions[version] = {
      ...packageInfo.versions[replaceVersion],
      version,
    };
  });

  if (removedVersions.length > 0) {
    packageInfo.readme +=
      `\nSome versions of package could not be replaced and thus are fully blocked (${removedVersions.length}):` +
      ` ${removedVersions.map((a) => a[0])}`;
  }

  if (replacedVersions.length > 0) {
    packageInfo.readme +=
      `\nSome versions of package are replaced by other(${replacedVersions.length}):` +
      ` ${replacedVersions.map((a) => `${a[0]} => ${a[1]}`)}`;
  }

  return packageInfo;
}

export default class VerdaccioMiddlewarePlugin implements IPluginStorageFilter<CustomConfig> {
  private readonly config: CustomConfig;
  private readonly parsedConfig: ParsedConfig;
  protected readonly logger: PluginOptions<unknown>['logger'];

  public constructor(config: CustomConfig, options: PluginOptions<CustomConfig>) {
    this.config = config;
    this.logger = options.logger;

    const blockMap = new Map<string, ParsedBlockRule>();
    const allowMap = new Map<string, ParsedAllowRule>();
    const blockCfg = config.block ?? [];
    for (const value of blockCfg) {
      if (isScopeRule(value)) {
        if (!value.scope.startsWith('@')) {
          throw new TypeError(`Scope value must start with @, found: ${value.scope}`);
        }

        blockMap.set(value.scope, 'scope');
        continue;
      }

      if (isPackageRule(value)) {
        blockMap.set(value.package, 'package');
        continue;
      }

      if (isPackageAndVersionRule(value)) {
        const previousConfig = blockMap.get(value.package) || { versions: [] };

        if (typeof previousConfig === 'string') {
          throw new Error(`Package ${value.package} is already specified by another strict rule ${previousConfig}`);
        }

        // Merge version ranges of the rules for the same package
        const range = new Range(value.versions);
        blockMap.set(value.package, {
          versions: [...previousConfig.versions, range],
          strategy: value.strategy ?? 'block',
        });

        continue;
      }

      throw new TypeError(`Could not parse rule ${JSON.stringify(value, null, 4)}`);
    }

    const dateThreshold = config.dateThreshold ? new Date(config.dateThreshold) : null;

    // eslint-disable-next-line no-prototype-builtins
    if (dateThreshold && isNaN(dateThreshold.getTime())) {
      throw new TypeError(`Invalid date ${config.dateThreshold} were provided for dateThreshold`);
    }

    const minAgeDays = config.minAgeDays ? Number(config.minAgeDays) : null;
    let minAgeMs: number | null = null;
    // eslint-disable-next-line no-prototype-builtins
    if (minAgeDays !== null) {
      if (isNaN(minAgeDays) || minAgeDays < 0) {
        throw new TypeError(`Invalid number ${config.minAgeDays} was provided for minAgeDays`);
      }

      minAgeMs = minAgeDays * 24 * 60 * 60 * 1000;
    }

    this.parsedConfig = {
      ...config,
      dateThreshold,
      minAgeMs,
      block: blockMap,
      allow: allowMap,
    };

    options.logger.debug(
      `Loaded plugin-delay-filter, ${JSON.stringify(this.parsedConfig, null, 4)}, ${Array.from(
        this.parsedConfig.block.entries()
      )}`
    );
  }

  public async filter_metadata(packageInfo: Readonly<Package>): Promise<Package> {
    const { dateThreshold, minAgeMs, block } = this.parsedConfig;

    let newPackage = getPackageClone(packageInfo);
    if (block.size > 0) {
      newPackage = filterBlockedVersions(newPackage, block, this.logger);
    }

    let earliestDateThreshold: Date | null = null;
    if (minAgeMs) {
      earliestDateThreshold = new Date(Date.now() - minAgeMs);
    }

    if (dateThreshold && (!earliestDateThreshold || dateThreshold < earliestDateThreshold)) {
      earliestDateThreshold = dateThreshold;
    }

    if (earliestDateThreshold) {
      newPackage = await filterVersionsByPublishDate(newPackage, earliestDateThreshold);
    }

    cleanupTags(newPackage);
    setupLatestTag(newPackage);
    cleanupTime(newPackage);
    setupCreatedAndModified(newPackage);
    cleanupDistFiles(newPackage);
    return Promise.resolve(newPackage);
  }
}
