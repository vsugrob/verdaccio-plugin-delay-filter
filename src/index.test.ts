import { describe, expect, it } from '@jest/globals';
import { Logger, Package, Version } from '@verdaccio/types';
import * as semver from 'semver';

import { ParsedBlockRule } from '../types';

import { filterBlockedVersions } from './index';

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
