import { isObject } from './utils';
import { CHART_TYPE_PIE, NONE } from '../core/constants';
import { deepMergeAll } from '../core/deepMerge';
import { configWithAll, filterConfigs, filterConfig, getConfigKey } from '../core/configUtils';

import getAccessibilityDefaults from './accessibilityConfig';
import getAnimationDefaults from './animationConfig';
import getChartDefaults from './chartConfig';
import getColorPaletteDefaults from './colorPaletteConfig';
import getClipIndicatorDefaults from './clipIndicatorConfig';
import getCrosshairDefaults from './crosshairConfig';
import getCategoryAxisDefaults from './categoryAxisConfig';
import getLegendDefaults from './legendConfig';
import getLinearGradientDefaults from './linearGradientConfig';
import getPatternDefaults from './patternConfig';
import getPieDefaults from './pieConfig';
import getPlotDefaults from './plotConfig';
import getRadialGradientDefaults from './radialGradientConfig';
import getValueAxisDefaults from './valueAxisConfig';
import getSeriesDefaults from './seriesConfig';
import getSeriesGroupDefaults from './seriesGroupConfig';
import getSeriesStackDefaults from './seriesStackConfig';
import getTitleDefaults from './titleConfig';
import getTooltipDefaults from './tooltipConfig';
import type {
  DeepPartial, LinearGradientConfig, MochartInputConfig, PatternConfig, PatternInputConfig, RadialGradientConfig,
  ValueAxisConfig, SeriesConfig, SeriesGroupConfig, SeriesStackConfig
} from '../../types/config';

function getWithDefault<T extends object>(config: unknown, configAll: unknown, defaults: T): T {
  return deepMergeAll<T>(defaults, isObject(configAll) ? configAll : {}, isObject(config) ? config : {});
}

function getOnlyIdWithDefaults<T extends { id?: string }>(configs: unknown, configAll: unknown, defaults: T[]): string | null {
  const filteredConfigs = (!Array.isArray(configs) && filterConfig(configs)) ? [configs] : filterConfigs(configs);
  if (filteredConfigs.length === 1) {
    const only = getWithDefault(filteredConfigs[0], configAll, defaults[0]);
    const { id } = only;
    return id !== undefined ? id : NONE;
  }
  if (filteredConfigs.length === 0 && Array.isArray(defaults) && defaults.length === 1) {
    const only = defaults[0];
    const { id } = only;
    return id !== undefined ? id : NONE;
  }
  return NONE;
}

function getConfigCount(configs: unknown): number {
  return Array.isArray(configs) ? filterConfigs(configs).length : (filterConfig(configs) ? 1 : 0);
}

export const implicitEntrySectionKeys = ['valueAxes'];

export function getDefaults(config: MochartInputConfig | unknown): Record<string, unknown> {
  if (isObject(config)) {
    const inputConfig = config as MochartInputConfig;
    const chartConfig = getChartDefaults();
    const chartConfigDefault = getWithDefault(inputConfig.chart, null, chartConfig);
    const pieMode = chartConfigDefault.type === CHART_TYPE_PIE;

    const valueAxisConfigs = getValueAxisListOrSingleDefaults(inputConfig, true, pieMode);
    const soleValueAxisId = getOnlyIdWithDefaults(inputConfig.valueAxes, inputConfig.valueAxisDefaults, valueAxisConfigs);

    const seriesStackConfigs = getListOrSingleDefaults<SeriesStackConfig>(inputConfig.seriesStacks, inputConfig.seriesStackDefaults, (aConfig, index) => getSeriesStackDefaults(aConfig, index, soleValueAxisId));
    const soleSeriesStackId = getOnlyIdWithDefaults(inputConfig.seriesStacks, inputConfig.seriesStackDefaults, seriesStackConfigs);

    const seriesGroupConfigs = getListOrSingleDefaults<SeriesGroupConfig>(inputConfig.seriesGroups, inputConfig.seriesGroupDefaults, (aConfig, index) => getSeriesGroupDefaults(aConfig, index));
    const soleSeriesGroupId = getOnlyIdWithDefaults(inputConfig.seriesGroups, inputConfig.seriesGroupDefaults, seriesGroupConfigs);

    const linearGradientConfigs = getListOrSingleDefaults<LinearGradientConfig>(inputConfig.linearGradients, inputConfig.linearGradientDefaults, (aConfig, index) => getLinearGradientDefaults(aConfig, index));
    const soleLinearGradientConfigId = getOnlyIdWithDefaults(inputConfig.linearGradients, inputConfig.linearGradientDefaults, linearGradientConfigs);

    const radialGradientConfigs = getListOrSingleDefaults<RadialGradientConfig>(inputConfig.radialGradients, inputConfig.radialGradientDefaults, (aConfig, index) => getRadialGradientDefaults(aConfig, index));
    const soleRadialGradientConfigId = getOnlyIdWithDefaults(inputConfig.radialGradients, inputConfig.radialGradientDefaults, radialGradientConfigs);

    const patternConfigs = getListOrSingleDefaults<PatternConfig>(inputConfig.patterns, inputConfig.patternDefaults,
      (aConfig, index) => getPatternDefaults(aConfig as DeepPartial<PatternInputConfig>, index));
    const solePatternId = getOnlyIdWithDefaults(inputConfig.patterns, inputConfig.patternDefaults, patternConfigs);

    const gradientCount = getConfigCount(inputConfig.linearGradients) + getConfigCount(inputConfig.radialGradients);
    const patternCount = getConfigCount(inputConfig.patterns);
    const soleGradientConfigId = gradientCount === 1 && patternCount === 0
      ? (soleLinearGradientConfigId ?? soleRadialGradientConfigId)
      : NONE;
    const solePatternConfigId = patternCount === 1 && gradientCount === 0 ? solePatternId : NONE;

    const seriesCount = getConfigCount(inputConfig.series);

    const plotConfig = getPlotDefaults();
    const plotConfigDefault = getWithDefault(inputConfig.plot, null, plotConfig);
    const { inverted } = plotConfigDefault;

    const seriesDefaults = (aConfig: DeepPartial<SeriesConfig>, index: number) =>
      getSeriesDefaults(aConfig, index, soleValueAxisId, soleSeriesStackId, soleSeriesGroupId, soleGradientConfigId, solePatternConfigId, pieMode);

    return {
      accessibility: getAccessibilityDefaults(),
      animation: getAnimationDefaults(),
      chart: chartConfig,
      colorPalette: getColorPaletteDefaults(),
      clipIndicator: getClipIndicatorDefaults(inputConfig.clipIndicator),
      crosshair: getCrosshairDefaults(),
      categoryAxis: getCategoryAxisDefaults(inputConfig.categoryAxis, inverted, pieMode),
      legend: getLegendDefaults(inputConfig.legend, seriesCount),
      linearGradients: linearGradientConfigs,
      patterns: patternConfigs,
      pie: getPieDefaults(inputConfig.pie),
      plot: plotConfig,
      radialGradients: radialGradientConfigs,
      valueAxes: valueAxisConfigs,
      series: getListOrSingleDefaults<SeriesConfig>(inputConfig.series, inputConfig.seriesDefaults, seriesDefaults),
      seriesGroups: seriesGroupConfigs,
      seriesStacks: seriesStackConfigs,
      title: getTitleDefaults(),
      tooltip: getTooltipDefaults(inputConfig.tooltip, pieMode)
    };
  }
  else {
    return {};
  }
}

function getValueAxisListOrSingleDefaults(config: MochartInputConfig, singleDefaultIfEmpty = false, pieMode = false): ValueAxisConfig[] {
  const rawConfigs = config.valueAxes;
  const configs = ((!Array.isArray(rawConfigs) && filterConfig(rawConfigs)) ? [rawConfigs] : filterConfigs(rawConfigs)) as DeepPartial<ValueAxisConfig>[];
  const allConfig = config.valueAxisDefaults;
  const rawStackConfigs = config.seriesStacks;
  // merged with seriesStackDefaults: an axis set there stacks that axis just as one set on the entry does
  const stackConfigs = configWithAll(
    (!Array.isArray(rawStackConfigs) && filterConfig(rawStackConfigs)) ? [rawStackConfigs] : filterConfigs(rawStackConfigs),
    config.seriesStackDefaults) as DeepPartial<SeriesStackConfig>[];
  const stackMap: Record<string, boolean> = {};
  for (const stackConfig of stackConfigs) {
    const { axis } = stackConfig;
    // a stack with no axis marks the first value axis (by its id, or its default id) as stacked
    const key = getConfigKey(axis === undefined ? (configs[0]?.id ?? 'VA0') : axis);
    if (key !== null) {
      stackMap[key] = true;
    }
  }
  // effective ids mirror the id default ('VA' + index), so a stack explicitly
  // referencing a defaulted axis id still marks that axis as stacked
  const getDefaults = (aConfig: DeepPartial<ValueAxisConfig>, index: number) => getValueAxisDefaults(aConfig, index, stackMap[getConfigKey(aConfig.id ?? 'VA' + index) ?? ''], pieMode);
  if (singleDefaultIfEmpty && configs.length === 0) {
    return [getDefaults(configWithAll({}, allConfig) as DeepPartial<ValueAxisConfig>, 0) as ValueAxisConfig];
  }
  return (configWithAll(configs, allConfig) as DeepPartial<ValueAxisConfig>[]).map((config, i) => getDefaults(config, i) as ValueAxisConfig);
}

function getListOrSingleDefaults<T extends object>(configs: unknown, allConfig: unknown, getDefaults: (config: DeepPartial<T>, index: number) => Partial<T>, singleDefaultIfEmpty = false): T[] {
  const filteredConfigs = (!Array.isArray(configs) && filterConfig(configs)) ? [configs] : filterConfigs(configs);
  if (singleDefaultIfEmpty && filteredConfigs.length === 0) {
    return [getDefaults(configWithAll({}, allConfig) as DeepPartial<T>, 0) as T];
  }
  return (configWithAll(filteredConfigs, allConfig) as DeepPartial<T>[]).map((config, i) => getDefaults(config, i) as T);
}
