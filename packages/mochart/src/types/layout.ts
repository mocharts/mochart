import type { Anchor } from '../config/core/constants';
import type { Bounds, TextBounds } from './geometry';

/** Bounds input accepted by createSpacingLayoutInfo; `default` marks placeholder text bounds. */
export type SpacingBoundsInput = Bounds & { default?: boolean; fontSize?: number };

/** Bounds plus the margin/padding-adjusted bounds produced by createSpacingLayoutInfo. */
export interface SpacingLayoutInfo extends Bounds {
  marginBounds: Bounds;
  marginRelativeBounds: Bounds;
  paddingBounds: Bounds;
  paddingRelativeBounds: Bounds;
  default?: boolean;
  /** measured font size of the text these bounds came from, where one was captured */
  fontSize?: number;
}

/** Orientation-aware bounds produced by createLayoutInfo. */
export interface LayoutInfo extends Bounds {
  categoryPosition: number;
  valuePosition: number;
  categoryExtent: number;
  valueExtent: number;
  inverted: boolean;
}

export interface BeforeAfter {
  before: number;
  after: number;
}

export interface AxisTickInfo {
  tickLabelParallel: boolean;
  tickLabelAnchor: Anchor;
}

export interface AxisTickInfos {
  categoryAxisTickInfo: AxisTickInfo;
  valueAxisTickInfos: Record<string, AxisTickInfo>;
}

/** SpacingLayoutInfo extended in place by setExtraAxisInfo (PlotLayout.ts). */
export interface AxisLayoutInfo extends SpacingLayoutInfo, LayoutInfo {
  tickLabelParallel: boolean;
  tickLabelSize: number;
  tickLabelSpace: number;
  titleSize: number;
  totalTickLabelSize: number;
  totalTitleSize: number;
  tickHeight: number;
  vertical: boolean;
  tickLabelAnchor: Anchor;
  tickTextX: number;
  tickTextY: number;
  titleLayoutInfo: SpacingLayoutInfo | Bounds;
  tickLabelLayoutInfo: SpacingLayoutInfo;
  focusRangeLayoutInfo: SpacingLayoutInfo | Bounds;
  thresholdTitleLayoutInfos: (SpacingLayoutInfo | Bounds)[];
  titleTextX: number;
  titleTextY: number;
  titleTextAngle: number;
  tickMarkX1: number;
  tickMarkY1: number;
  tickMarkX2: number;
  tickMarkY2: number;
  focusTickMarkX1: number;
  focusTickMarkY1: number;
  focusTickMarkX2: number;
  focusTickMarkY2: number;
  axisLineX1: number;
  axisLineY1: number;
  axisLineX2: number;
  axisLineY2: number;
  titleBoundsX: number;
  titleBoundsY: number;
  titleBoundsWidth: number;
  titleBoundsHeight: number;
}

export interface CategoryAxisLayoutInfo extends AxisLayoutInfo {
  position: number;
  before: number;
  after: number;
  minTickSize: number;
}

export interface TitleLayoutResult {
  titleLayoutInfo: SpacingLayoutInfo;
  titlePrefixLayoutInfo: SpacingLayoutInfo;
  titleTextLayoutInfo: SpacingLayoutInfo;
  titleTextRawLayoutInfo: SpacingLayoutInfo;
  titleSuffixLayoutInfo: SpacingLayoutInfo;
}

export interface LegendLayoutResult {
  legendLayoutInfo: SpacingLayoutInfo;
  legendItemTextLayoutInfo: SpacingLayoutInfo;
  legendItemTextRawLayoutInfo: SpacingLayoutInfo;
  legendItemLayoutInfos: SpacingLayoutInfo[];
  legendItemRawLayoutInfos: SpacingLayoutInfo[];
}

export interface PlotLayoutResult {
  plotLayoutInfo: SpacingLayoutInfo;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  seriesLayoutInfo: LayoutInfo;
  /** Hidden axes get zero-size layout infos so their series scales stay usable. */
  valueAxisLayoutInfos: Record<string, AxisLayoutInfo>;
}

/** The full layout produced by getChartLayoutInfo. Legend fields are absent when the legend is hidden. */
export type ChartLayoutInfo = TitleLayoutResult & PlotLayoutResult & Partial<LegendLayoutResult> & {
  chartContentLayoutInfo: SpacingLayoutInfo;
  containerLayoutInfo: SpacingLayoutInfo;
};

/** Measured text bounds consumed by the layout functions (utils/TextMeasurement.ts). */
export interface ChartTextBoundsData {
  titleTextBounds: TextBounds;
  titleTextRawBounds: TextBounds;
  titlePrefixBounds: TextBounds;
  titleSuffixBounds: TextBounds;
  categoryAxisTickBounds: TextBounds;
  categoryAxisSizeTickBounds: TextBounds;
  categoryAxisTitleBounds: TextBounds;
  categoryAxisThresholdTitleBounds: Record<number, TextBounds>;
  valueAxisTickBounds: Record<string, TextBounds>;
  valueAxisTitleBounds: Record<string, TextBounds>;
  valueAxisThresholdTitleBounds: Record<string, Record<number, TextBounds>>;
  legendBounds: TextBounds;
  /** Keyed by series id, so a set measured one frame ago cannot describe the wrong series. */
  legendItemTextBounds: Record<string, TextBounds>;
  legendItemTextRawBounds: Record<string, TextBounds>;
  legendItemMaxTextBounds: TextBounds;
  hasDefault: boolean;
}

/** The slice of ChartData that the layout functions read. */
export interface ChartDataForLayout {
  seriesData: {
    /** Count of unfiltered series per value-axis id. */
    axisSeriesCounts: Record<string, number>;
  };
}
