import { Config } from '@verdaccio/types';
import { Range } from 'semver';

export type BlockStrategy = 'block' | 'replace';

export type PackageBlockRule =
  | { scope: string }
  | { package: string }
  | { package: string; versions: string; strategy?: BlockStrategy };

export type PackageAllowRule = { scope: string } | { package: string } | { package: string; versions: string };

export interface CustomConfig extends Config {
  dateThreshold?: string | number;
  minAgeDays?: number;
  block?: PackageBlockRule[];
  allow?: PackageAllowRule[];
}

interface ParsedBlockConfig {
  versions: Range[];
  strategy?: BlockStrategy;
}

interface ParsedAllowConfig {
  versions: Range[];
}

export type ParsedScopeLevel = 'scope' | 'package' | undefined;
export type ParsedBlockRule = ParsedBlockConfig | ParsedScopeLevel;
export type ParsedAllowRule = ParsedAllowConfig | ParsedScopeLevel;

export interface ParsedConfig {
  dateThreshold: Date | null;
  minAgeMs: number | null;
  block: Map<string, ParsedBlockRule>;
  allow: Map<string, ParsedAllowRule>;
}
