import { Logger, Package } from '@verdaccio/types';
import { satisfies } from 'semver';

import { ParsedRule } from '../config/types';

import { matchRules } from './matcher';
import { MatchType } from './types';

/**
 * Filter out all blocked package versions.
 * If all package is blocked, or it's scope is blocked - block all versions.
 */
export function filterBlockedVersions(packageInfo: Package, rules: Map<string, ParsedRule>, logger: Logger): Package {
  const match = matchRules(packageInfo, rules);
  if (!match) {
    return packageInfo;
  }

  if (match.type === MatchType.SCOPE) {
    return {
      ...packageInfo,
      versions: {},
      readme: `All packages in scope ${match.scope} are blocked by rule`,
    };
  }

  if (match.type === MatchType.PACKAGE) {
    return {
      ...packageInfo,
      versions: {},
      readme: `All package versions are blocked by rule`,
    };
  }

  const rule = match.rule;
  const versionRanges = rule.versions;
  if (versionRanges.length === 0) {
    return packageInfo;
  }

  if (!rule.strategy) {
    rule.strategy = 'block';
  }

  if (rule.strategy === 'block') {
    let blockedVersionsCount = 0;
    Object.keys(packageInfo.versions).forEach((version) => {
      versionRanges.forEach((versionRange) => {
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
        `\nSome versions(${blockedVersionsCount}) of package are blocked by rules: ${versionRanges.map(
          (range) => range.raw
        )}`;
    }

    return packageInfo;
  }

  // We assume that the order of versions is already sorted
  const nonBlockedVersions = { ...packageInfo.versions };
  const newVersionsMapping: Record<string, string | null> = {};

  versionRanges.forEach((versionRange) => {
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
