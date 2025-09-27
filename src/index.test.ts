import { describe, expect, it } from '@jest/globals';
import { Logger, Package, Version } from '@verdaccio/types';

import { CustomConfig } from './types';

import VerdaccioMiddlewarePlugin from './index';

const versionStub: Version = {
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
    '1.0.0': { ...versionStub, _id: '@babel/test@1.0.0' },
    '1.5.0': { ...versionStub, _id: '@babel/test@1.5.0' },
    '3.0.0': { ...versionStub, _id: '@babel/test@3.0.0' },
  },
  time: {
    modified: '2024-01-01T00:00:00.123Z',
    created: '2020-01-01T00:00:00.000Z',
    '1.0.0': '2020-01-01T00:00:00.000Z',
    '1.5.0': '2022-01-01T00:00:00.000Z',
    '3.0.0': '2024-01-01T00:00:00.000Z',
  },
  readme: 'It is a babel test package',
};

const typesNodePackage: Package = {
  'dist-tags': { latest: '2.6.3' },
  _attachments: {},
  _distfiles: {},
  _rev: '',
  _uplinks: {},
  name: '@types/node',
  versions: {
    '1.0.0': { ...versionStub, _id: '@types/node@1.0.0' },
    '2.2.0': { ...versionStub, _id: '@types/node@2.2.0' },
    '2.6.3': { ...versionStub, _id: '@types/node@2.6.3' },
  },
  time: {
    modified: '2025-01-01T00:00:00.456Z',
    created: '2010-01-01T00:00:00.000Z',
    '1.0.0': '2010-01-01T00:00:00.000Z',
    '2.2.0': '2015-01-01T00:00:00.000Z',
    '2.6.3': '2025-01-01T00:00:00.000Z',
  },
  readme: 'It is a types node package',
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

function getDaysSince(date: Date | string): number {
  if (typeof date === 'string') {
    date = new Date(date);
  }

  const ageMs = new Date().getTime() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays;
}

describe('VerdaccioMiddlewarePlugin', () => {
  describe('date filtering', () => {
    it('filters by minAgeDays', async function() {
      const config = {
        minAgeDays: getDaysSince('2023'),
      } as CustomConfig; // Some properties are omitted on purpose
      const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

      // Should block 3.0.0 version of @babel/test
      expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

      // Should not block 2.6.3 version of @types/node
      expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
    });

    it('filters by dateThreshold', async function() {
      const config = {
        dateThreshold: '2023-01-01',
      } as CustomConfig; // Some properties are omitted on purpose
      const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

      // Should block 3.0.0 version of @babel/test
      expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

      // Should not block 2.6.3 version of @types/node
      expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
    });

    describe('dateThreshold combined with minAgeDays', () => {
      it("filters by minAgeDays when it's earlier than dateThreshold", async function() {
        const config = {
          minAgeDays: getDaysSince('2023-01-01'),
          dateThreshold: '2024-06-01',
        } as CustomConfig; // Some properties are omitted on purpose
        const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

        // Should block 3.0.0 version of @babel/test
        expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

        // Should not block 2.6.3 version of @types/node
        expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
      });

      it("filters by dateThreshold when it's earlier than minAgeDays", async function() {
        const config = {
          minAgeDays: getDaysSince('2024-06-01'),
          dateThreshold: '2023-01-01',
        } as CustomConfig; // Some properties are omitted on purpose
        const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

        // Should block 3.0.0 version of @babel/test
        expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

        // Should not block 2.6.3 version of @types/node
        expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
      });
    });
  });

  describe('package and version filtering', () => {
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

    it('replaces versions', async function() {
      const config = {
        block: [{ package: '@babel/test', versions: '>1.0.0', strategy: 'replace' }],
      } as CustomConfig; // Some properties are omitted on purpose
      const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

      // Should replace all versions of @babel/test greater than 1.0.0
      expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();

      // Should not replace versions of @types/node
      expect(await plugin.filter_metadata(typesNodePackage)).toMatchSnapshot();
    });

    describe('readme stays intact when no filtering applied', () => {
      it('filter by versions', async function() {
        const config = {
          block: [{ package: '@babel/test', versions: '>10.0.0' }],
        } as CustomConfig; // Some properties are omitted on purpose
        const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

        // Should not change anything
        expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();
      });

      it('version replacement', async function() {
        const config = {
          block: [{ package: '@babel/test', versions: '>10.0.0', strategy: 'replace' }],
        } as CustomConfig; // Some properties are omitted on purpose
        const plugin = new VerdaccioMiddlewarePlugin(config, { logger, config });

        // Should not change anything
        expect(await plugin.filter_metadata(babelTestPackage)).toMatchSnapshot();
      });
    });
  });
});
