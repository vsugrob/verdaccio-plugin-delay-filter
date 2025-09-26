import { describe, expect, it } from '@jest/globals';
import { Logger, Package, Version } from '@verdaccio/types';

import { CustomConfig } from '../types';

import VerdaccioMiddlewarePlugin from './index';

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

describe('VerdaccioMiddlewarePlugin', () => {
  it('filters by age', async function() {
    const latestDateWeWantToSee = new Date('2023');
    const ageMs = new Date().getTime() - latestDateWeWantToSee.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const config = {
      minAgeDays: ageDays,
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    // Should block 3.0.0 version of @babel/test
    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

    // Should not block 2.6.3 version of @types/node
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });

  it('filters by scope', async function() {
    const config = {
      block: [{ scope: '@babel' }],
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    // Should block all versions of @babel/test
    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

    // Should not block @types/node
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });

  it('filters by package', async function() {
    const config = {
      block: [{ package: '@babel/test' }],
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    // Should block all versions of @babel/test
    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

    // Should not block @types/node
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });

  it('filters by versions', async function() {
    const config = {
      block: [{ package: '@babel/test', versions: '>1.0.0' }],
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    // Should block all versions of @babel/test greater than 1.0.0
    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

    // Should not block @types/node
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });

  it('filters by multiple versions', async function() {
    const config = {
      block: [
        { package: '@babel/test', versions: '>2.0.0' },
        { package: '@babel/test', versions: '<1.3.0' },
      ],
    } as CustomConfig; // Some properties are omitted on purpose
    const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

    // Should leave only 1.5.0 version of @babel/test
    expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

    // Should not block @types/node
    expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
  });
});
