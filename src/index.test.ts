import { describe, expect, it } from '@jest/globals';
import { Logger, Package, Version } from '@verdaccio/types';
import * as semver from 'semver';

import { CustomConfig, ParsedBlockRule } from '../types';

import VerdaccioMiddlewarePlugin, { filterBlockedVersions } from './index';

const exampleVersion: Version = {
  _id: '',
  main: '',
  name: '',
  readme: '',
  version: '',
} as Version; // Some properties are omitted on purpose

const babelTestPackage: Package = {
  'dist-tags': { latest: '3.0.0' },
  _attachments: {},
  _distfiles: {},
  _rev: '',
  _uplinks: {},
  name: '@babel/test',
  versions: {
    '1.0.0': exampleVersion,
    '1.5.0': exampleVersion,
    '3.0.0': exampleVersion,
  },

  time: {
    '1.0.0': '2020-01-01T00:00:00.000Z',
    '1.5.0': '2022-01-01T00:00:00.000Z',
    '3.0.0': '2024-01-01T00:00:00.000Z',
  },
};

const typesNodePackage: Package = {
  'dist-tags': { latest: '2.6.3' },
  _attachments: {},
  _distfiles: {},
  _rev: '',
  _uplinks: {},
  name: '@types/node',
  versions: {
    '1.0.0': exampleVersion,
    '2.2.0': exampleVersion,
    '2.6.3': exampleVersion,
  },

  time: {
    '1.0.0': '2010-01-01T00:00:00.000Z',
    '2.2.0': '2015-01-01T00:00:00.000Z',
    '2.6.3': '2025-01-01T00:00:00.000Z',
  },
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (): void => {};
const logger: Logger = {
  child: noop,
  debug: noop,
  error: noop,
  http: noop,
  warn: noop,
  info: noop,
  trace: noop,
};

describe('filterBlockedVersions()', () => {
  it('filters by scope', () => {
    const block = new Map<string, ParsedBlockRule>([['@babel', 'scope']]);

    // Should block all versions of @babel/test
    expect(filterBlockedVersions(babelTestPackage, block, logger)).toMatchSnapshot();

    // Should not block @types/node
    expect(filterBlockedVersions(typesNodePackage, block, logger)).toMatchSnapshot();
  });

  it('filters by package', () => {
    const block = new Map<string, ParsedBlockRule>([['@babel/test', 'package']]);

    // Should block all versions of @babel/test
    expect(filterBlockedVersions(babelTestPackage, block, logger)).toMatchSnapshot();

    // Should not block @types/node
    expect(filterBlockedVersions(typesNodePackage, block, logger)).toMatchSnapshot();
  });

  it('filters by versions', () => {
    const block = new Map<string, ParsedBlockRule>([['@babel/test', { block: [new semver.Range('>1.0.0')] }]]);

    // Should block all versions of @babel/test greater than 1.0.0
    expect(filterBlockedVersions(babelTestPackage, block, logger)).toMatchSnapshot();

    // Should not block @types/node
    expect(filterBlockedVersions(typesNodePackage, block, logger)).toMatchSnapshot();
  });

  it('filters by multiple versions', () => {
    const block = new Map<string, ParsedBlockRule>([
      ['@babel/test', { block: [new semver.Range('>2.0.0'), new semver.Range('<1.3.0')] }],
    ]);

    expect(filterBlockedVersions(babelTestPackage, block, logger)).toMatchSnapshot();
  });
});

describe('VerdaccioMiddlewarePlugin', () => {
  it('filters by age', async function() {
    const latestDateWeWantToSee = new Date('2023');
    const ageMs = new Date().getTime() - latestDateWeWantToSee.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const config = {
      minAgeDays: ageDays,
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });
});
