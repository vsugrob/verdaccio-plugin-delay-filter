import { Range } from 'semver';

import { ConfigRule, ParsedRule } from './types';

export function parseConfigRules(configRules: ConfigRule[]): Map<string, ParsedRule> {
  const ruleMap = new Map<string, ParsedRule>();
  for (const rule of configRules) {
    if ('scope' in rule && typeof rule.scope === 'string') {
      if (!rule.scope.startsWith('@')) {
        throw new TypeError(`Scope value must start with @, found: ${rule.scope}`);
      }

      ruleMap.set(rule.scope, 'scope');
      continue;
    }

    if ('package' in rule && !('versions' in rule)) {
      ruleMap.set(rule.package, 'package');
      continue;
    }

    if ('package' in rule && 'versions' in rule) {
      const previousConfig = ruleMap.get(rule.package) || { versions: [] };

      if (typeof previousConfig === 'string') {
        throw new Error(`Package ${rule.package} is already specified by another strict rule ${previousConfig}`);
      }

      // Merge version ranges of the rules for the same package
      const range = new Range(rule.versions);
      ruleMap.set(rule.package, {
        versions: [...previousConfig.versions, range],
        strategy: rule.strategy ?? 'block',
      });

      continue;
    }

    throw new TypeError(`Could not parse rule ${JSON.stringify(rule, null, 4)}`);
  }

  return ruleMap;
}
