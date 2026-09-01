// The ambient d3 shims must ride along for consumers typechecking from source (development export
// condition); a global declaration file can only be referenced, not imported — hence the exception.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/d3.d.ts" />
export type * from './types';
export { createChart, createDefaultChart } from './createChart';
export type { ChartHandle } from './createChart';
export { getVersionString } from './version';
export { ArrayOfObjectsDataProvider, ObjectOfArraysDataProvider } from './data/DataProvider';
export { default as buildMochartConfig, hasConfigStructureChange, getConfigWithDefaults, getConfigWithoutDefaults, sectionKeyAllMap } from './config/core/mochartConfig';
export { getDefaults } from './config/defaults/mochartConfig';
export { default as validateConfig } from './config/validation/mochartConfig';
export { validateConfigDetailed } from './config/validation/mochartConfig';
export { default as migrateConfig } from './config/migration/mochartConfig';
export { enhanceConfig } from './config/helper';
export { createSparklineConfig } from './config/helper/sparkline';
export type { CreateSparklineConfigOptions } from './config/helper/sparkline';
// other enumerated config values are written as string literals; the union types below name them
export { NONE, AUTO, TYPE_DATE, TYPE_NUMBER, TYPE_STRING, SCALE_ORDINAL, SCALE_LINEAR, EASINGS } from './config/core/constants';
export { getEasingFunction } from './animation/Easing';
export type { EasingFunction } from './animation/Easing';
// the union types every config member is declared with, so a host can name one in its own signatures
export type {
  Auto, Align, TooltipValueAlign, VerticalAlign, Anchor, Position, MissingValueMode, AxisSide, ThresholdTitleSide,
  ChartType, PieLabelType, PieTooltipValueType, Scale, DataType, RendererType, PatternType, CurveType,
  CapType, LabelPosition, ColorMode, ColorInterpolation, MarkerShape, MarkerSizeScale, DomainChange, AnimationEasing
} from './config/core/constants';
export { getDataErrors } from './data/DataValidator';
export { binValues, createHistogram } from './data/Histogram';
export type { HistogramBin, BinValuesOptions, CreateHistogramOptions, HistogramData } from './data/Histogram';
export { computeWaterfallSteps, createWaterfall } from './data/Waterfall';
export type { WaterfallDirection, WaterfallItem, WaterfallStep, CreateWaterfallOptions, WaterfallData } from './data/Waterfall';
export { createHeatmap, createHeatmapColorScale } from './data/Heatmap';
export type { HeatmapRow, CreateHeatmapOptions, CreateHeatmapColorScaleOptions, HeatmapData } from './data/Heatmap';
export { computeCandlesticks, createCandlestick } from './data/Candlestick';
export type { CandlestickDirection, CandlestickItem, Candlestick, CreateCandlestickOptions, CandlestickVolumeOptions, CandlestickData } from './data/Candlestick';
export { createOhlc } from './data/Ohlc';
export type { CreateOhlcOptions, OhlcData } from './data/Ohlc';
export { computePieFractions, createPie } from './data/Pie';
export type { PieItem, CreatePieOptions, PieData } from './data/Pie';
export { CHART_TYPE_XY, CHART_TYPE_PIE } from './config/core/constants';
export { CONFIG_VERSION } from './config/core/constants';
export { mochartCssClasses } from './utils/ChartDom';
