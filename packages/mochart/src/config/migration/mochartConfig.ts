import { CONFIG_VERSION } from '../core/constants';
import { deepClone } from '../core/deepMerge';

type LegacyConfig = Record<string, unknown>;

/** A copy of `config` upgraded to the current format version: the caller's object is untouched. The parameter is `unknown` because a config written against an older format need not match the current config type; the result is not validated. */
export default function migrateConfig(config: unknown): LegacyConfig {
  let migratedConfig = config as LegacyConfig;
  if (config !== null && typeof config === 'object') {
    migratedConfig = deepClone(migratedConfig);
    // An omitted version means "authored for the current config format" — it is
    // normalized here so future migration steps never run against it.
    if (migratedConfig.version === undefined) {
      migratedConfig.version = CONFIG_VERSION;
    }
  }
  const migrationSteps: Array<(config: LegacyConfig) => LegacyConfig> = [];

  // No migrations yet — 1.0.0 is the first config version. When the shape changes, bump CONFIG_VERSION and
  // push steps via a fall-through switch on config.version; each step stamps the version it migrates to.

  for (const migrationStep of migrationSteps) {
    migratedConfig = migrationStep(migratedConfig);
  }
  return migratedConfig;
}
