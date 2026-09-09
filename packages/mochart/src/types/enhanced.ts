import type {
  LinearGradientConfig, MochartConfig, PatternConfig, RadialGradientConfig,
  SeriesConfig, SeriesGroupConfig, SeriesStackConfig, ValueAxisConfig
} from './config';

/**
 * Internal enhanced views of the public config types: buildMochartConfig adds
 * cross-references and lookup maps, deliberately absent from the public types;
 * the core casts to these at its entry points. Never exported from the package index.
 */

export interface EnhancedValueAxisConfig extends ValueAxisConfig {
  seriesConfigs?: EnhancedSeriesConfig[];
  seriesConfigIndicesById?: Record<string, number>;
}

export interface EnhancedSeriesConfig extends SeriesConfig {
  valueAxisConfig: EnhancedValueAxisConfig;
  seriesStackConfig?: EnhancedSeriesStackConfig;
  seriesGroupConfig?: EnhancedSeriesGroupConfig;
  linearGradientConfig?: LinearGradientConfig;
  radialGradientConfig?: RadialGradientConfig;
  patternConfig?: PatternConfig;
}

export interface EnhancedSeriesStackConfig extends SeriesStackConfig {
  valueAxisConfig?: EnhancedValueAxisConfig;
  seriesConfigs?: EnhancedSeriesConfig[];
  seriesConfigIndicesById?: Record<string, number>;
}

export interface EnhancedSeriesGroupConfig extends SeriesGroupConfig {
  seriesConfigs?: EnhancedSeriesConfig[];
  seriesConfigIndicesById?: Record<string, number>;
  /** Side-by-side sub-slots of the category slot: one per stack in the group (stack-mates share it) or per unstacked series. */
  subSlotIndicesById?: Record<string, number>;
  subSlotCount?: number;
}

export interface EnhancedMochartConfig extends Omit<MochartConfig, 'valueAxes' | 'series' | 'seriesGroups' | 'seriesStacks'> {
  valueAxes: EnhancedValueAxisConfig[];
  valueAxesById: Record<string, EnhancedValueAxisConfig>;
  valueAxisIndicesById: Record<string, number>;
  series: EnhancedSeriesConfig[];
  seriesById: Record<string, EnhancedSeriesConfig>;
  seriesIndicesById: Record<string, number>;
  seriesGroups: EnhancedSeriesGroupConfig[];
  seriesGroupsById: Record<string, EnhancedSeriesGroupConfig>;
  seriesStacks: EnhancedSeriesStackConfig[];
  seriesStacksById: Record<string, EnhancedSeriesStackConfig>;
}
