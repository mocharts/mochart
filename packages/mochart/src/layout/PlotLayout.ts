import { NONE, AUTO, ANCHOR_START, ANCHOR_END, ANCHOR_MIDDLE, SIDE_START } from '../config/core/constants';
import { resolveThresholds } from '../config/defaults/axisConfig';
import type { Anchor } from '../config/core/constants';
import { arrayToMap, idAccessor } from '../utils/utils';
import { createLayoutInfo } from './LayoutInfo';
import { getRotatedBounds, getRotatedZeroBounds } from './RotatedLayoutInfo';
import { createCategoryAxisLayoutInfo, getCategoryAxisRotatedTickBounds, getCategoryAxisBeforeAfter, getCategoryAxisSize } from './CategoryAxisLayout';
import { createValueAxisLayoutInfos, getValueAxisRotatedTickBounds, getValueAxisBeforeAfter, getValueAxisSizes, emptyLayoutInfo } from './ValueAxisLayoutInfo';
import { createInvertedSpacingLayoutInfo, getSpacingWidth, getSpacingHeight, getSpacingLeft, getSpacingTop, createInnerOuterSpacingLayoutInfo, createSpacingLayoutInfo } from './SpacingLayoutInfo';
import type { Bounds, Size, TextBounds } from '../types/geometry';
import type { AxisConfigBase, AxisTickLabelConfig, CategoryAxisConfig, PlotConfig } from '../types/config';
import { getMinorTickLabel, getMinorTickMark } from '../config/core/minorConfig';
import type { MinorTickLabel, MinorTickMark } from '../config/core/minorConfig';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisLayoutInfo, AxisTickInfo, AxisTickInfos, BeforeAfter, ChartDataForLayout, ChartTextBoundsData, PlotLayoutResult, SpacingLayoutInfo } from '../types/layout';

/** The settings a kind of tick label is laid out from: the tick label settings, or the minor ones resolved. */
export type TickLabelLayoutSettings = Pick<AxisTickLabelConfig, 'size' | 'marginInner' | 'marginOuter' | 'paddingInner' | 'paddingOuter' | 'rotation' | 'anchor'>;

export function getRotatedTickBounds(tickLabel: Pick<AxisTickLabelConfig, 'rotation'>, tickBounds: TextBounds, axisTickInfo: AxisTickInfo): Bounds {
  const rotatedTickBounds = tickLabel.rotation !== 0
    ? getRotatedBounds(tickBounds, tickLabel.rotation, axisTickInfo.tickLabelAnchor)
    : getRotatedZeroBounds(tickBounds, axisTickInfo.tickLabelAnchor);
  rotatedTickBounds.x = Math.floor(rotatedTickBounds.x);
  rotatedTickBounds.y = Math.floor(rotatedTickBounds.y);
  rotatedTickBounds.width = Math.ceil(rotatedTickBounds.width);
  rotatedTickBounds.height = Math.ceil(rotatedTickBounds.height);
  return rotatedTickBounds;
}

function getCollapsedAfterSizeConsumption(axisConfigs: EnhancedValueAxisConfig[], axisSizeArray: Record<string, number>): number {
  let totalSize = 0;
  for (const axisConfig of axisConfigs) {
    if (axisConfig.collapsed === true && axisConfig.side !== SIDE_START) {
      totalSize += axisSizeArray[axisConfig.id];
    }
  }
  return Math.ceil(totalSize);
}

function getAxisTickInfos(plotConfig: PlotConfig, categoryAxisConfig: CategoryAxisConfig, valueAxisConfigs: EnhancedValueAxisConfig[]): AxisTickInfos {
  const { inverted } = plotConfig;
  return {
    categoryAxisTickInfo: getAxisTickInfo(categoryAxisConfig.tickLabel, categoryAxisConfig, inverted),
    valueAxisTickInfos: arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => getAxisTickInfo(valueAxisConfig.tickLabel, valueAxisConfig, !inverted)),
    categoryAxisMinorTickInfo: getAxisTickInfo(getMinorTickLabel(categoryAxisConfig.tickLabel), categoryAxisConfig, inverted),
    valueAxisMinorTickInfos: arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => getAxisTickInfo(getMinorTickLabel(valueAxisConfig.tickLabel), valueAxisConfig, !inverted))
  };
}

function getAxisTickInfo(tickLabel: TickLabelLayoutSettings, axisConfig: Pick<AxisConfigBase, 'side' | 'collapsed'>, vertical: boolean): AxisTickInfo {
  const tickLabelRotation = Math.abs(tickLabel.rotation);
  const tickLabelParallel = vertical ? tickLabelRotation > 70 : tickLabelRotation < 20;
  const tickLabelAnchor = getTickLabelAnchor(tickLabel, axisConfig, vertical, tickLabelParallel);
  return {
    tickLabelParallel,
    tickLabelAnchor
  };
}

/** Whether an axis lays out minor labels: they are drawn, and there is one to measure. */
function hasMinorTickLabels(minorTickLabel: MinorTickLabel, minorTickBounds: TextBounds): boolean {
  return minorTickLabel.visible && minorTickBounds.empty !== true;
}

// a kind of label a config hides takes no room: neither its size nor its margins and paddings
function getTickLabelTotalSize(tickLabel: TickLabelLayoutSettings, rotatedTickBounds: Size, vertical: boolean, present: boolean): number {
  if (!present) {
    return 0;
  }
  const tickLabelSize = tickLabel.size === AUTO
    ? (vertical ? rotatedTickBounds.width : rotatedTickBounds.height)
    : tickLabel.size;
  return tickLabel.marginInner + tickLabel.paddingInner + tickLabelSize + tickLabel.marginOuter + tickLabel.paddingOuter;
}

/** The room the tick labels take across the axis: the larger of the two kinds' totals. */
function getAxisTotalTickLabelSize(axisConfig: AxisConfigBase, rotatedTickBounds: Size, minorTickBounds: TextBounds, minorRotatedTickBounds: Size, vertical: boolean): number {
  const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
  return Math.max(
    getTickLabelTotalSize(axisConfig.tickLabel, rotatedTickBounds, vertical, axisConfig.tickLabel.visible),
    getTickLabelTotalSize(minorTickLabel, minorRotatedTickBounds, vertical, hasMinorTickLabels(minorTickLabel, minorTickBounds)));
}

function getAxisTitleSize(axisConfig: AxisConfigBase, titleBounds: Size): number {
  let titleSize = 0;
  if (axisConfig.title.text !== NONE) {
    titleSize = axisConfig.title.size === AUTO ? titleBounds.height : axisConfig.title.size;
  }
  return titleSize;
}

function getAxisTotalTitleSize(axisConfig: AxisConfigBase, titleBounds: Size): number {
  let titleSize = 0;
  if (axisConfig.title.text !== NONE) {
    titleSize = axisConfig.title.marginInner + axisConfig.title.paddingInner + getAxisTitleSize(axisConfig, titleBounds) + axisConfig.title.marginOuter + axisConfig.title.paddingOuter;
  }
  return titleSize;
}

export function getAxisSize(axisConfig: AxisConfigBase, rotatedTickBounds: Size, minorTickBounds: TextBounds, minorRotatedTickBounds: Size, titleBounds: Size, vertical: boolean): number {
  let axisSize = 0;
  if (axisConfig.visible) {
    axisSize = axisConfig.marginInner + axisConfig.paddingInner +
      getAxisTotalTickLabelSize(axisConfig, rotatedTickBounds, minorTickBounds, minorRotatedTickBounds, vertical) +
      getAxisTotalTitleSize(axisConfig, titleBounds) + axisConfig.marginOuter + axisConfig.paddingOuter;
  }
  return Math.ceil(axisSize);
}

/** One kind of tick label's placement across the axis, from its own settings and measured bounds. */
interface TickLabelKindInfo {
  parallel: boolean;
  size: number;
  space: number;
  totalSize: number;
  tickHeight: number;
  anchor: Anchor;
  textX: number;
  textY: number;
  layoutInfo: SpacingLayoutInfo;
}

function getTickLabelKindInfo(tickLabel: TickLabelLayoutSettings, present: boolean, axisTickInfo: AxisTickInfo, tickBounds: TextBounds, rotatedTickBounds: Bounds, maxTotalSize: number, totalTitleSize: number, width: number, height: number, vertical: boolean, inverted: boolean, notAfter: boolean): TickLabelKindInfo {
  const { marginInner, marginOuter, paddingInner, paddingOuter } = tickLabel;
  const totalSize = getTickLabelTotalSize(tickLabel, rotatedTickBounds, vertical, present);
  let { size } = tickLabel;
  if (size === AUTO) {
    size = vertical ? rotatedTickBounds.width : rotatedTickBounds.height;
  }
  // The rotated label box sits inside its band, flush with the plot side: the anchor is offset by the
  // box's extent on the outer side of the anchor (rotatedTickBounds is anchor-relative), which for
  // unrotated text is half its height (or its anchored width) and for a 90° label nothing at all.
  const rotatedOuterExtent = vertical ? -rotatedTickBounds.x : -rotatedTickBounds.y;
  const rotatedInnerExtent = (vertical ? rotatedTickBounds.width : rotatedTickBounds.height) - rotatedOuterExtent;
  const tickTextOffset = notAfter ? size - rotatedInnerExtent : rotatedOuterExtent;
  // both kinds' boxes sit flush with the plot side, so the narrower kind of a notAfter axis starts later
  const boxOffset = notAfter ? totalTitleSize + maxTotalSize - totalSize : 0;
  const tickMarginOffset = notAfter ? marginOuter + paddingOuter : marginInner + paddingInner;
  const tickOffset = boxOffset + tickMarginOffset;
  return {
    parallel: axisTickInfo.tickLabelParallel,
    size: vertical ? rotatedTickBounds.width : rotatedTickBounds.height,
    space: axisTickInfo.tickLabelParallel ? tickBounds.width : tickBounds.height,
    totalSize,
    tickHeight: tickBounds.height,
    anchor: axisTickInfo.tickLabelAnchor,
    textX: vertical ? tickOffset + tickTextOffset : 0,
    textY: vertical ? 0 : tickOffset + tickTextOffset,
    layoutInfo: createInnerOuterSpacingLayoutInfo({
      x: vertical ? boxOffset : 0,
      y: vertical ? 0 : boxOffset,
      width: vertical ? totalSize : width,
      height: vertical ? height : totalSize
    }, vertical, inverted, notAfter, marginInner, marginOuter, paddingInner, paddingOuter)
  };
}

function setTickMarkInfo(tickMark: Pick<MinorTickMark, 'visible' | 'size' | 'marginInner'>, width: number, height: number, vertical: boolean, notAfter: boolean): [number, number, number, number] {
  if (!tickMark.visible) {
    return [0, 0, 0, 0];
  }
  const { marginInner: tickMarkMargin, size: tickMarkSize } = tickMark;
  const tickMarkOffset = notAfter ? (vertical ? width : height) - tickMarkMargin : tickMarkMargin;
  const x1 = vertical ? tickMarkOffset : 0;
  const x2 = vertical ? (notAfter ? x1 - tickMarkSize : x1 + tickMarkSize) : 0;
  const y1 = vertical ? 0 : tickMarkOffset;
  const y2 = vertical ? 0 : (notAfter ? y1 - tickMarkSize : y1 + tickMarkSize);
  return [x1, y1, x2, y2];
}

export function getPlotHeight(innerHeight: number, titleHeight: number, legendHeight: number): number {
  // title and legend can exceed a small chart; a negative height reaches background and clip rects
  return Math.max(0, innerHeight - titleHeight - legendHeight);
}

export function setExtraAxisInfo(axisLayoutInfo: AxisLayoutInfo, axisConfig: AxisConfigBase, axisTickInfo: AxisTickInfo, minorTickInfo: AxisTickInfo, tickBounds: TextBounds, rotatedTickBounds: Bounds, minorTickBounds: TextBounds, minorRotatedTickBounds: Bounds, titleBounds: TextBounds, thresholdTitleBounds: Record<number, TextBounds>, vertical: boolean, inverted: boolean): void {
  const { side, collapsed, focusRange } = axisConfig;
  const { marginInner: titleMarginInner, marginOuter: titleMarginOuter, paddingInner: titlePaddingInner, paddingOuter: titlePaddingOuter, text: title } = axisConfig.title;
  const { marginInner: tickLabelMarginInner, marginOuter: tickLabelMarginOuter, paddingInner: tickLabelPaddingInner, paddingOuter: tickLabelPaddingOuter } = axisConfig.tickLabel;
  const before = side === SIDE_START;
  const notAfter = (before && !collapsed) || (!before && collapsed);
  const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
  const minorPresent = hasMinorTickLabels(minorTickLabel, minorTickBounds);

  axisLayoutInfo.titleSize = getAxisTitleSize(axisConfig, titleBounds);
  axisLayoutInfo.totalTickLabelSize = getAxisTotalTickLabelSize(axisConfig, rotatedTickBounds, minorTickBounds, minorRotatedTickBounds, vertical);
  axisLayoutInfo.totalTitleSize = getAxisTotalTitleSize(axisConfig, titleBounds);
  axisLayoutInfo.vertical = vertical;

  const { totalTickLabelSize, totalTitleSize, width, height } = axisLayoutInfo;

  // each kind of label is placed from its own settings, inside the room the larger kind reserves
  const major = getTickLabelKindInfo(axisConfig.tickLabel, axisConfig.tickLabel.visible, axisTickInfo, tickBounds, rotatedTickBounds, totalTickLabelSize, totalTitleSize, width, height, vertical, inverted, notAfter);
  const minor = getTickLabelKindInfo(minorTickLabel, minorPresent, minorTickInfo, minorTickBounds, minorRotatedTickBounds, totalTickLabelSize, totalTitleSize, width, height, vertical, inverted, notAfter);
  axisLayoutInfo.tickLabelParallel = major.parallel;
  axisLayoutInfo.tickLabelSize = major.size;
  axisLayoutInfo.tickLabelSpace = major.space;
  axisLayoutInfo.tickHeight = major.tickHeight;
  axisLayoutInfo.tickLabelAnchor = major.anchor;
  axisLayoutInfo.tickTextX = major.textX;
  axisLayoutInfo.tickTextY = major.textY;
  axisLayoutInfo.minorTickLabelParallel = minor.parallel;
  axisLayoutInfo.minorTickLabelSize = minor.size;
  axisLayoutInfo.minorTickLabelSpace = minor.space;
  axisLayoutInfo.totalMinorTickLabelSize = minor.totalSize;
  axisLayoutInfo.minorTickHeight = minor.tickHeight;
  axisLayoutInfo.minorTickLabelAnchor = minor.anchor;
  axisLayoutInfo.minorTickTextX = minor.textX;
  axisLayoutInfo.minorTickTextY = minor.textY;
  axisLayoutInfo.minorTickLabelLayoutInfo = minor.layoutInfo;

  let titleTextX = 0;
  let titleTextY = 0;
  let titleTextAngle = 0;

  // Both boxes offset across the axis and span its full length; the outer side
  // comes first locally, so the title leads for a notAfter axis (matching tickOffset/titleOffset).
  // The inner/outer margin sides follow notAfter too, so a collapsed axis's boxes wrap its text.
  const titleBoxOffset = notAfter ? 0 : totalTickLabelSize;

  const titleLayoutInfo = axisLayoutInfo.titleLayoutInfo = title === NONE ? emptyLayoutInfo : createInnerOuterSpacingLayoutInfo({
    x: vertical ? titleBoxOffset : 0,
    y: vertical ? 0 : titleBoxOffset,
    width: vertical ? totalTitleSize : width,
    height: vertical ? height : totalTitleSize,
  }, vertical, inverted, notAfter, titleMarginInner, titleMarginOuter, titlePaddingInner, titlePaddingOuter);

  // the focus range wraps whichever kind of label reserves the room
  const tickLabelLayoutInfo = axisLayoutInfo.tickLabelLayoutInfo = major.layoutInfo;
  const focusLabelLayoutInfo = minor.totalSize > major.totalSize ? minor.layoutInfo : major.layoutInfo;

  const { applyToTitle: focusRangeApplyToTitle } = focusRange;
  const focusRangeTitle = focusRangeApplyToTitle && title !== NONE;
  const focusMarginInner = tickLabelMarginInner;
  const focusMarginOuter = focusRangeApplyToTitle ? titleMarginOuter : tickLabelMarginOuter;
  const focusPaddingInner = tickLabelPaddingInner;
  const focusPaddingOuter = focusRangeApplyToTitle ? titlePaddingOuter : tickLabelPaddingOuter;
  axisLayoutInfo.focusRangeLayoutInfo = axisConfig.focusRange.visible === false ? emptyLayoutInfo : createInnerOuterSpacingLayoutInfo({
    x: focusRangeTitle ? Math.min(titleLayoutInfo.x, focusLabelLayoutInfo.x) : focusLabelLayoutInfo.x,
    y: focusRangeTitle ? Math.min(titleLayoutInfo.y, focusLabelLayoutInfo.y) : focusLabelLayoutInfo.y,
    width: vertical ? (focusRangeApplyToTitle ? titleLayoutInfo.width + focusLabelLayoutInfo.width : focusLabelLayoutInfo.width) : width,
    height: !vertical ? (focusRangeApplyToTitle ? titleLayoutInfo.height + focusLabelLayoutInfo.height : focusLabelLayoutInfo.height) : height,
  }, vertical, inverted, notAfter, focusMarginInner, focusMarginOuter, focusPaddingInner, focusPaddingOuter);
  void tickLabelLayoutInfo;

  if (title !== NONE) {
    const titleOffset = notAfter ? titleMarginOuter + titlePaddingOuter + axisLayoutInfo.titleSize / 2.0 : (totalTickLabelSize + totalTitleSize - titleMarginOuter - titlePaddingOuter - axisLayoutInfo.titleSize / 2.0);
    titleTextX = vertical ? titleOffset : width / 2.0;
    titleTextY = vertical ? height / 2.0 : titleOffset;
    titleTextAngle = vertical ? (notAfter ? 90 : 270) : 0;
  }
  axisLayoutInfo.thresholdTitleLayoutInfos = resolveThresholds(axisConfig.thresholds).map((threshold, thresholdIndex) => {
    const bounds = thresholdTitleBounds[thresholdIndex];
    return !(threshold.title.text !== NONE && bounds !== undefined)
      ? emptyLayoutInfo
      : createSpacingLayoutInfo({ x: 0, y: 0, ...bounds }, threshold.title.margin, threshold.title.padding, false);
  });

  axisLayoutInfo.titleTextX = titleTextX;
  axisLayoutInfo.titleTextY = titleTextY;
  axisLayoutInfo.titleTextAngle = titleTextAngle;

  [axisLayoutInfo.tickMarkX1, axisLayoutInfo.tickMarkY1, axisLayoutInfo.tickMarkX2, axisLayoutInfo.tickMarkY2] = setTickMarkInfo(axisConfig.tickMark, width, height, vertical, notAfter);
  [axisLayoutInfo.minorTickMarkX1, axisLayoutInfo.minorTickMarkY1, axisLayoutInfo.minorTickMarkX2, axisLayoutInfo.minorTickMarkY2] = setTickMarkInfo(getMinorTickMark(axisConfig.tickMark), width, height, vertical, notAfter);

  let focusTickMarkX1 = 0;
  let focusTickMarkY1 = 0;
  let focusTickMarkX2 = 0;
  let focusTickMarkY2 = 0;
  if (axisConfig.focusTickMark.visible) {
    const { marginInner: focusTickMarkMargin, size: focusTickMarkSize } = axisConfig.focusTickMark;
    const focusTickMarkOffset = notAfter ? (vertical ? width : height) - focusTickMarkMargin : focusTickMarkMargin;
    focusTickMarkX1 = vertical ? focusTickMarkOffset : 0;
    focusTickMarkX2 = vertical ? (notAfter ? focusTickMarkX1 - focusTickMarkSize : focusTickMarkX1 + focusTickMarkSize) : 0;
    focusTickMarkY1 = vertical ? 0 : focusTickMarkOffset;
    focusTickMarkY2 = vertical ? 0 : (notAfter ? focusTickMarkY1 - focusTickMarkSize : focusTickMarkY1 + focusTickMarkSize);
  }
  axisLayoutInfo.focusTickMarkX1 = focusTickMarkX1;
  axisLayoutInfo.focusTickMarkY1 = focusTickMarkY1;
  axisLayoutInfo.focusTickMarkX2 = focusTickMarkX2;
  axisLayoutInfo.focusTickMarkY2 = focusTickMarkY2;

  let axisLineX1 = 0;
  let axisLineY1 = 0;
  let axisLineX2 = 0;
  let axisLineY2 = 0;
  if (axisConfig.axisLine.visible === true) {
    const { marginInner: axisLineMargin } = axisConfig.axisLine;
    const axisLineOffset = notAfter ? (vertical ? width : height) - axisLineMargin : axisLineMargin;
    axisLineX1 = vertical ? axisLineOffset : 0;
    axisLineY1 = vertical ? 0 : axisLineOffset;
    axisLineX2 = vertical ? axisLineX1 : axisLineX1 + width;
    axisLineY2 = vertical ? axisLineY1 + height : axisLineY1;
  }

  axisLayoutInfo.axisLineX1 = axisLineX1;
  axisLayoutInfo.axisLineY1 = axisLineY1;
  axisLayoutInfo.axisLineX2 = axisLineX2;
  axisLayoutInfo.axisLineY2 = axisLineY2;

  let titleBoundsX = 0;
  let titleBoundsY = 0;
  let titleBoundsWidth = 0;
  let titleBoundsHeight = 0;
  // TODO - check axisConfig.visible higher up...
  if (axisConfig.visible && axisConfig.title.text !== NONE && axisConfig.title.truncation.enabled) {
    const titleOffset = notAfter ? axisConfig.title.marginOuter + axisConfig.title.paddingOuter : totalTickLabelSize + axisConfig.title.marginInner + axisConfig.title.paddingInner;

    titleBoundsX = vertical ? titleOffset : 0;
    titleBoundsY = vertical ? 0 : titleOffset;
    titleBoundsWidth = vertical ? axisLayoutInfo.titleSize : width;
    titleBoundsHeight = vertical ? height : axisLayoutInfo.titleSize;
  }

  axisLayoutInfo.titleBoundsX = titleBoundsX;
  axisLayoutInfo.titleBoundsY = titleBoundsY;
  axisLayoutInfo.titleBoundsWidth = titleBoundsWidth;
  axisLayoutInfo.titleBoundsHeight = titleBoundsHeight;
}

function getTickLabelAnchor(tickLabel: TickLabelLayoutSettings, axisConfig: Pick<AxisConfigBase, 'side' | 'collapsed'>, vertical: boolean, tickLabelParallel: boolean): Anchor {
  if (tickLabel.anchor === AUTO) {
    if (!tickLabelParallel) {
      const { side, collapsed } = axisConfig;
      const { rotation: tickLabelRotation } = tickLabel;
      const before = side === SIDE_START;
      const notAfter = (before && !collapsed) || (!before && collapsed);
      if (vertical) {
        return notAfter ? ANCHOR_END : ANCHOR_START;
      }
      else {
        return notAfter ? (tickLabelRotation >= 0 ? ANCHOR_END : ANCHOR_START) : (tickLabelRotation >= 0 ? ANCHOR_START : ANCHOR_END);
      }
    }
    else {
      return ANCHOR_MIDDLE;
    }
  }
  else {
    return tickLabel.anchor;
  }
}

export interface AxisMetrics {
  axisTickInfos: AxisTickInfos;
  categoryAxisRotatedTickBounds: Bounds;
  valueAxisRotatedTickBounds: Record<string, Bounds>;
  categoryAxisMinorRotatedTickBounds: Bounds;
  valueAxisMinorRotatedTickBounds: Record<string, Bounds>;
  valueAxisSizes: Record<string, number>;
  categoryAxisSize: number;
  valueAxisVisibleSeriesCounts: Record<string, number>;
  categoryAxesOffset: BeforeAfter;
  valueAxesOffset: BeforeAfter;
}

// Independent of the plot extents, so ChartLayout computes it once for the width pre-pass and the full layout pass.
export function getAxisMetrics(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, chartData: ChartDataForLayout | null): AxisMetrics {
  const { plot: plotConfig, categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs } = mochartConfig;
  const { categoryAxisTitleBounds, valueAxisTitleBounds, categoryAxisMinorTickBounds, valueAxisMinorTickBounds } = chartTextBoundsData;
  const { inverted } = plotConfig;
  const valueAxisVisibleSeriesCounts = chartData ? chartData.seriesData.axisSeriesCounts : {};

  const axisTickInfos = getAxisTickInfos(plotConfig, categoryAxisConfig, valueAxisConfigs);

  const categoryAxisRotatedTickBounds = getCategoryAxisRotatedTickBounds(mochartConfig, chartTextBoundsData, axisTickInfos);
  const valueAxisRotatedTickBounds = getValueAxisRotatedTickBounds(mochartConfig, chartTextBoundsData, axisTickInfos);
  const categoryAxisMinorRotatedTickBounds = getRotatedTickBounds(getMinorTickLabel(categoryAxisConfig.tickLabel), categoryAxisMinorTickBounds, axisTickInfos.categoryAxisMinorTickInfo);
  const valueAxisMinorRotatedTickBounds = arrayToMap(valueAxisConfigs, idAccessor,
    valueAxisConfig => getRotatedTickBounds(getMinorTickLabel(valueAxisConfig.tickLabel), valueAxisMinorTickBounds[valueAxisConfig.id], axisTickInfos.valueAxisMinorTickInfos[valueAxisConfig.id]));

  const categoryAxisSize = getCategoryAxisSize(categoryAxisConfig, categoryAxisRotatedTickBounds, categoryAxisMinorTickBounds, categoryAxisMinorRotatedTickBounds, categoryAxisTitleBounds, inverted);
  const valueAxisSizes = getValueAxisSizes(valueAxisConfigs, valueAxisVisibleSeriesCounts, valueAxisRotatedTickBounds, valueAxisMinorTickBounds, valueAxisMinorRotatedTickBounds, valueAxisTitleBounds, !inverted);

  const valueAxesOffset = getCategoryAxisBeforeAfter(categoryAxisConfig, categoryAxisSize);
  const categoryAxesOffset = getValueAxisBeforeAfter(valueAxisConfigs, valueAxisSizes);

  return {
    axisTickInfos,
    categoryAxisRotatedTickBounds,
    valueAxisRotatedTickBounds,
    categoryAxisMinorRotatedTickBounds,
    valueAxisMinorRotatedTickBounds,
    valueAxisSizes,
    categoryAxisSize,
    valueAxisVisibleSeriesCounts,
    categoryAxesOffset,
    valueAxesOffset
  };
}

// extent is the plot spacing box along the axis
function getInnerExtent(extent: number, axesOffset: BeforeAfter): number {
  return Math.max(extent - axesOffset.before - axesOffset.after, 1);
}

export function getPlotWidthAndX(mochartConfig: EnhancedMochartConfig, axisMetrics: AxisMetrics, contentBounds: Bounds): { x: number; width: number } {
  const { x: contentX, width: contentWidth } = contentBounds;
  const { inverted, margin, padding } = mochartConfig.plot;
  const { categoryAxesOffset, valueAxesOffset } = axisMetrics;
  const plotSpacingWidth = contentWidth - getSpacingWidth(margin, padding);
  const plotSpacingX = contentX + getSpacingLeft(margin, padding);
  const axesOffset = inverted ? valueAxesOffset : categoryAxesOffset;

  return {
    x: plotSpacingX + axesOffset.before,
    width: getInnerExtent(plotSpacingWidth, axesOffset)
  };
}

export function getPlotLayoutInfo(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, chartData: ChartDataForLayout | null, axisMetrics: AxisMetrics, contentBounds: Bounds, plotHeight: number, plotY: number): PlotLayoutResult {
  const { x, width } = contentBounds;
  const { inverted, margin, padding } = mochartConfig.plot;
  const spacingTop = getSpacingTop(margin, padding);
  const spacingLeft = getSpacingLeft(margin, padding);
  const plotSpacingHeight = plotHeight - getSpacingHeight(margin, padding);
  const plotSpacingWidth = width - getSpacingWidth(margin, padding);
  const plotSpacingX = x + spacingLeft;
  const plotSpacingY = plotY + spacingTop;
  const categoryExtent = inverted ? plotSpacingHeight : plotSpacingWidth;
  const seriesExtent = inverted ? plotSpacingWidth : plotSpacingHeight;
  const categoryY = inverted ? plotSpacingY : plotSpacingX;
  const valueY = inverted ? plotSpacingX : plotSpacingY;

  const {
    axisTickInfos, categoryAxisRotatedTickBounds, valueAxisRotatedTickBounds, categoryAxisMinorRotatedTickBounds, valueAxisMinorRotatedTickBounds, valueAxisSizes, categoryAxisSize,
    valueAxisVisibleSeriesCounts, categoryAxesOffset, valueAxesOffset
  } = axisMetrics;
  const categoryInnerExtent = getInnerExtent(categoryExtent, categoryAxesOffset);
  const valueInnerExtent = getInnerExtent(seriesExtent, valueAxesOffset);

  const valueAxesCollapsedAfter = getCollapsedAfterSizeConsumption(mochartConfig.valueAxes, valueAxisSizes);

  const seriesLayoutInfo = createLayoutInfo(categoryY + categoryAxesOffset.before,
    valueY + valueAxesOffset.before, categoryInnerExtent, valueInnerExtent, inverted);

  const categoryAxisLayoutInfo = createCategoryAxisLayoutInfo(mochartConfig, chartTextBoundsData, categoryAxisRotatedTickBounds, categoryAxisMinorRotatedTickBounds, axisTickInfos, categoryY, valueY, categoryInnerExtent, valueInnerExtent, categoryAxesOffset, categoryAxisSize);
  const valueAxisLayoutInfos = createValueAxisLayoutInfos(mochartConfig, chartTextBoundsData, chartData, valueAxisRotatedTickBounds, valueAxisMinorRotatedTickBounds, axisTickInfos, categoryY, valueY, categoryInnerExtent, valueInnerExtent, categoryAxesOffset, valueAxesOffset, valueAxisSizes, valueAxisVisibleSeriesCounts, valueAxesCollapsedAfter);

  const plotLayoutInfo = createInvertedSpacingLayoutInfo({ x, y: plotY, width, height: plotHeight }, inverted, margin, padding);

  return {
    plotLayoutInfo,
    categoryAxisLayoutInfo,
    seriesLayoutInfo,
    valueAxisLayoutInfos
  };
}

// TODO - possibly split setExtraAxisInfo's output into per-part layouts:
// tick marks, tick labels, title, axis line, title clip.
