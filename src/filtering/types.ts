import { PackageScopeLevel, ParsedConfigRule } from '../config/types';

export enum MatchType {
  SCOPE = 'scope',
  PACKAGE = 'package',
  VERSIONS = 'versions',
}

export interface MatchScopeResult {
  type: MatchType.SCOPE;
  rule: PackageScopeLevel;
  scope: string;
}

export interface MatchPackageResult {
  type: MatchType.PACKAGE;
  rule: PackageScopeLevel;
  package: string;
}

export interface MatchVersionsResult {
  type: MatchType.VERSIONS;
  rule: ParsedConfigRule;
  versions: string[];
}

export type MatchResult = MatchScopeResult | MatchPackageResult | MatchVersionsResult;
