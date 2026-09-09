import { enhanceConfig } from '../../src';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { MochartInputConfig } from '../../src';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';


const VERSION = '1.0.0';

/**
 * Builds a fully-defaulted, validated EnhancedMochartConfig from a partial input.
 * enhanceConfig is the same entry point the public API uses, so fixtures stay
 * in sync with real config defaults rather than being hand-assembled. Input is
 * intentionally loose — these fixtures feed runtime code that accepts untrusted
 * config, so the static config type is not enforced here.
 */
export function makeConfig(input: Record<string, unknown>): EnhancedMochartConfig {
  return enhanceConfig({ version: VERSION, ...input } as MochartInputConfig) as EnhancedMochartConfig;
}

/** A minimal valid config: one ordinal string category axis. */
export function ordinalConfig(categoryAxisOverrides: Record<string, unknown> = {}): EnhancedMochartConfig {
  return makeConfig({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...categoryAxisOverrides }
  });
}

export { ArrayOfObjectsDataProvider };
