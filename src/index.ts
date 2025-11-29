/* eslint-disable new-cap */
import { IPluginStorageFilter, Package, PluginOptions } from '@verdaccio/types';
import semver from 'semver';

import { parseConfig } from './config/parser';
import { CustomConfig, ParsedConfig } from './config/types';
import { filterBlockedVersions } from './filtering/packageVersion';

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

export default class VerdaccioMiddlewarePlugin implements IPluginStorageFilter<CustomConfig> {
  private readonly config: CustomConfig;
  private readonly parsedConfig: ParsedConfig;
  protected readonly logger: PluginOptions<unknown>['logger'];

  public constructor(config: CustomConfig, options: PluginOptions<CustomConfig>) {
    this.config = config;
    this.logger = options.logger;
    this.parsedConfig = parseConfig(config);

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
