import type { ConfigValidation, DataProvider, MochartConfig } from '@mochart/core';
import type { DemoRandomConfig } from '@mochart/demo-data';

export type {
  DataObject, Demo, DemoConfig, DemoData, DemoRandomConfig,
  ErrorBarsRandomConfig, HeatmapRandomConfig, HistogramRandomConfig, PieRandomConfig,
  RandomConfig, WalkRandomConfig, WaterfallRandomConfig
} from '@mochart/demo-data';

/** A value on the category axis of a generated data set. */
export type CategoryValue = number | string;

/** Map of series id -> whether that series is currently filtered out. */
export type FilteredSeriesIds = Record<string, boolean>;

/** Focus event payload emitted by the chart interactions. */
export interface FocusData {
  valueAxisId?: string | null;
  seriesId?: string | null;
  categoryIndex?: number;
}

/** The transition demo's config bundle: one config plus a sequence of datasets. */
export interface TransitionConfig {
  config: Record<string, any>;
  data: Record<string, any>[][];
}

/** The data provider shape the demo charts hand to the chart bindings. */
export type ChartDataProviderLike = DataProvider;

/**
 * The data provider produced by the random generator and consumed by the
 * chart / getDataErrors. `getError` marks the error/invalid variants.
 */
export interface DemoDataProvider extends DataProvider {
  getError?: () => string | boolean;
  categoryValues?: CategoryValue[];
  seriesValues?: Record<string, (number | undefined)[]>;
}

/** The demo mode routes exposed by the gallery. */
export type DemoMode = 'single' | 'multi' | 'random' | 'transition' | 'rotation' | 'sparkline';



/** The random config plus the validity flag the random editor tracks. */
export type RandomConfigWithValid = DemoRandomConfig & { valid: boolean };

/**
 * The derived config bundle returned by buildMochartDemoConfig — the built
 * mochart config plus the with/without-defaults variants used by the editors.
 */
export interface MochartDemoConfig {
  config: Record<string, unknown>;
  configDefaults: Record<string, unknown>;
  configWithDefaults: Record<string, unknown>;
  configWithoutDefaults: Record<string, unknown>;
  configValidation: ConfigValidation;
  mochartConfig: MochartConfig;
  valid: boolean;
  categoryProperty: string | undefined;
  seriesCount: number;
  /** True for pie-type charts (pie/donut/gauge): slices are series, one data row. */
  pieMode: boolean;
}
