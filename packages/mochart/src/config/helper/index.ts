import { getDefaults } from '../defaults/mochartConfig.js';
import { default as validateConfig } from '../validation/mochartConfig.js';
import { default as buildMochartConfig } from '../core/mochartConfig.js';
import { default as migrateConfig } from '../migration/mochartConfig.js';
import type { MochartConfig, MochartInputConfig } from '../../types/config.js';

/** The parameter type names the current format; older formats are accepted and migrated. */
export function enhanceConfig(config: MochartInputConfig): MochartConfig {
  // migrate a stored config to the current format first; migration returns a copy, so the caller's object is untouched
  const migratedConfig = migrateConfig(config);
  const configDefaults = getDefaults(migratedConfig);
  const configValidation = validateConfig(migratedConfig, configDefaults);
  const mochartConfig = buildMochartConfig(migratedConfig, configDefaults, configValidation);
  return mochartConfig;
}
