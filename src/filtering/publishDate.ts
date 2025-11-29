import { Package } from '@verdaccio/types';

/**
 * filter out all package versions that were published after dateThreshold
 * @param packageInfo
 * @param dateThreshold
 */
export function filterVersionsByPublishDate(packageInfo: Package, dateThreshold: Date): Promise<Package> {
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
