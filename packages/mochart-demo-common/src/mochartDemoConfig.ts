import { CHART_TYPE_PIE, migrateConfig, buildMochartConfig, getDefaults, getConfigWithDefaults, getConfigWithoutDefaults, validateConfig } from '@mochart/core';

import type { MochartDemoConfig } from './types';

type ConfigRecord = Record<string, unknown>;

export default function buildMochartDemoConfig(config: ConfigRecord): MochartDemoConfig {
  config = migrateConfig(config);
  const configDefaults = getDefaults(config);
  const configWithDefaults = getConfigWithDefaults(config, configDefaults);
  const configWithoutDefaults = getConfigWithoutDefaults(configWithDefaults, configDefaults);
  const configValidation = validateConfig(config, configDefaults);
  const mochartConfig = buildMochartConfig(config, configDefaults, configValidation);

  // helper shortcuts
  const { valid } = configValidation;
  const { categoryAxis: categoryAxisConfig, series: seriesConfigs } = mochartConfig;
  const categoryProperty = categoryAxisConfig ? categoryAxisConfig.property : undefined;
  const seriesCount = Array.isArray(seriesConfigs) ? seriesConfigs.length : 0;
  const pieMode = mochartConfig.chart?.type === CHART_TYPE_PIE;

  return {
    config,
    configDefaults,
    configWithDefaults,
    configWithoutDefaults,
    configValidation,
    mochartConfig,
    valid,
    categoryProperty,
    seriesCount,
    pieMode
  };
}
