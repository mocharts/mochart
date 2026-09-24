// The ambient d3 shims must ride along for consumers typechecking from source (development export
// condition); a global declaration file can only be referenced, not imported, hence the exception.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/d3.d.ts" />
export type * from './types/index.js';
export { createChart, createDefaultChart } from './createChart.js';
export type { ChartHandle } from './createChart.js';
export { getVersionString } from './version.js';
export { ArrayOfObjectsDataProvider, ObjectOfArraysDataProvider } from './data/DataProvider.js';
export { default as buildMochartConfig, hasConfigStructureChange, getConfigWithDefaults, getConfigWithoutDefaults, sectionKeyAllMap } from './config/core/mochartConfig.js';
export { getDefaults } from './config/defaults/mochartConfig.js';
export { default as validateConfig } from './config/validation/mochartConfig.js';
export { validateConfigDetailed } from './config/validation/mochartConfig.js';
export { default as migrateConfig } from './config/migration/mochartConfig.js';
export { enhanceConfig } from './config/helper/index.js';
export { createSparklineConfig } from './config/helper/sparkline.js';
export type { CreateSparklineConfigOptions } from './config/helper/sparkline.js';
// other enumerated config values are written as string literals; the union types below name them
export { NONE, AUTO, TYPE_DATE, TYPE_NUMBER, TYPE_STRING, SCALE_ORDINAL, SCALE_LINEAR, EASINGS } from './config/core/constants.js';
export { getEasingFunction } from './animation/Easing.js';
export type { EasingFunction } from './animation/Easing.js';
// the union types every config member is declared with, so a host can name one in its own signatures
export type {
  Auto, Align, TooltipValueAlign, VerticalAlign, Anchor, Position, MissingValueMode, AxisSide, ThresholdTitleSide,
  ChartType, PieLabelType, PieTooltipValueType, Scale, DataType, RendererType, PatternType, CurveType,
  CapType, LabelPosition, ColorMode, ColorInterpolation, MarkerShape, MarkerSizeScale, StepPeriod, CategoryValueIntervalPeriod, DomainChange, AnimationEasing,
  FontWeight, FontStyle, Major
} from './config/core/constants.js';
export { getDataErrors } from './data/DataValidator.js';
export { binValues, createHistogram } from './data/Histogram.js';
export type { HistogramBin, BinValuesOptions, CreateHistogramOptions, HistogramData } from './data/Histogram.js';
export { computeWaterfallSteps, createWaterfall } from './data/Waterfall.js';
export type { WaterfallDirection, WaterfallItem, WaterfallStep, CreateWaterfallOptions, WaterfallData } from './data/Waterfall.js';
export { createHeatmap, createHeatmapColorScale } from './data/Heatmap.js';
export type { HeatmapRow, CreateHeatmapOptions, CreateHeatmapColorScaleOptions, HeatmapData } from './data/Heatmap.js';
export { computeCandlesticks, createCandlestick } from './data/Candlestick.js';
export type { CandlestickAxisType, CandlestickLabel, CandlestickDirection, CandlestickItem, Candlestick, CreateCandlestickOptions, CandlestickVolumeOptions, CandlestickData } from './data/Candlestick.js';
export { createOhlc } from './data/Ohlc.js';
export type { CreateOhlcOptions, OhlcData } from './data/Ohlc.js';
export { computePieFractions, createPie } from './data/Pie.js';
export type { PieItem, CreatePieOptions, PieData } from './data/Pie.js';
export { CHART_TYPE_XY, CHART_TYPE_PIE } from './config/core/constants.js';
export { CONFIG_VERSION } from './config/core/constants.js';
export { mochartCssClasses } from './utils/ChartDom.js';
