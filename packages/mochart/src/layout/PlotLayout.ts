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
import type { AxisConfigBase, CategoryAxisConfig, PlotConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisLayoutInfo, AxisTickInfo, AxisTickInfos, BeforeAfter, ChartDataForLayout, ChartTextBoundsData, PlotLayoutResult } from '../types/layout';

export function getRotatedTickBounds(axisConfig: AxisConfigBase, tickBounds: TextBounds, axisTickInfo: AxisTickInfo): Bounds {
  const rotatedTickBounds = axisConfig.tickLabel.rotation !== 0
    ? getRotatedBounds(tickBounds, axisConfig.tickLabel.rotation, axisTickInfo.tickLabelAnchor)
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
  const categoryAxisTickInfo = getAxisTickInfo(categoryAxisConfig, inverted);
  const valueAxisTickInfos = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig =>
    getAxisTickInfo(valueAxisConfig, !inverted)
  );
  return {
    categoryAxisTickInfo,
    valueAxisTickInfos
  };
}

function getAxisTickInfo(axisConfig: AxisConfigBase, vertical: boolean): AxisTickInfo {
  const tickLabelRotation = Math.abs(axisConfig.tickLabel.rotation);
  const tickLabelParallel = vertical ? tickLabelRotation > 70 : tickLabelRotation < 20;
  const tickLabelAnchor = getTickLabelAnchor(axisConfig, vertical, tickLabelParallel);
  return {
    tickLabelParallel,
    tickLabelAnchor
  };
}

function getAxisTotalTickLabelSize(axisConfig: AxisConfigBase, rotatedTickBounds: Size, vertical: boolean): number {
  const tickLabelSize = axisConfig.tickLabel.size === AUTO
    ? (vertical ? rotatedTickBounds.width : rotatedTickBounds.height)
    : axisConfig.tickLabel.size;
  return axisConfig.tickLabel.marginInner + axisConfig.tickLabel.paddingInner + tickLabelSize + axisConfig.tickLabel.marginOuter + axisConfig.tickLabel.paddingOuter;
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

export function getAxisSize(axisConfig: AxisConfigBase, rotatedTickBounds: Size, titleBounds: Size, vertical: boolean): number {
  let axisSize = 0;
  if (axisConfig.visible) {
    axisSize = axisConfig.marginInner + axisConfig.paddingInner +
      getAxisTotalTickLabelSize(axisConfig, rotatedTickBounds, vertical) +
      getAxisTotalTitleSize(axisConfig, titleBounds) + axisConfig.marginOuter + axisConfig.paddingOuter;
  }
  return Math.ceil(axisSize);
}

export function getPlotHeight(innerHeight: number, titleHeight: number, legendHeight: number): number {
  // title and legend can exceed a small chart; a negative height reaches background and clip rects
  return Math.max(0, innerHeight - titleHeight - legendHeight);
}

export function setExtraAxisInfo(axisLayoutInfo: AxisLayoutInfo, axisConfig: AxisConfigBase, axisTickInfo: AxisTickInfo, tickBounds: TextBounds, rotatedTickBounds: Bounds, titleBounds: TextBounds, thresholdTitleBounds: Record<number, TextBounds>, vertical: boolean, inverted: boolean): void {
  const { side, collapsed, focusRange } = axisConfig;
  const { marginInner: titleMarginInner, marginOuter: titleMarginOuter, paddingInner: titlePaddingInner, paddingOuter: titlePaddingOuter, text: title } = axisConfig.title;
  const { marginInner: tickLabelMarginInner, marginOuter: tickLabelMarginOuter, paddingInner: tickLabelPaddingInner, paddingOuter: tickLabelPaddingOuter } = axisConfig.tickLabel;
  const before = side === SIDE_START;
  const notAfter = (before && !collapsed) || (!before && collapsed);

  axisLayoutInfo.tickLabelParallel = axisTickInfo.tickLabelParallel;
  axisLayoutInfo.tickLabelSize = vertical ? rotatedTickBounds.width : rotatedTickBounds.height;
  axisLayoutInfo.tickLabelSpace = axisTickInfo.tickLabelParallel ? tickBounds.width : tickBounds.height;
  axisLayoutInfo.titleSize = getAxisTitleSize(axisConfig, titleBounds);
  axisLayoutInfo.totalTickLabelSize = getAxisTotalTickLabelSize(axisConfig, rotatedTickBounds, vertical);
  axisLayoutInfo.totalTitleSize = getAxisTotalTitleSize(axisConfig, titleBounds);
  axisLayoutInfo.tickHeight = tickBounds.height;
  axisLayoutInfo.vertical = vertical;
  axisLayoutInfo.tickLabelAnchor = axisTickInfo.tickLabelAnchor;

  let { size: tickLabelSize } = axisConfig.tickLabel;
  if (tickLabelSize === AUTO) {
    tickLabelSize = axisLayoutInfo.tickLabelSize;
  }
  // The rotated label box sits inside its band, flush with the plot side: the anchor is offset by the
  // box's extent on the outer side of the anchor (rotatedTickBounds is anchor-relative), which for
  // unrotated text is half its height (or its anchored width) and for a 90° label nothing at all.
  const rotatedOuterExtent = vertical ? -rotatedTickBounds.x : -rotatedTickBounds.y;
  const rotatedInnerExtent = (vertical ? rotatedTickBounds.width : rotatedTickBounds.height) - rotatedOuterExtent;
  const tickTextOffset = notAfter ? tickLabelSize - rotatedInnerExtent : rotatedOuterExtent;

  const { totalTickLabelSize, totalTitleSize, width, height } = axisLayoutInfo;

  let titleTextX = 0;
  let titleTextY = 0;
  let titleTextAngle = 0;
  const theTitleOffset = notAfter ? totalTitleSize : 0;
  const tickMarginOffset = notAfter ? tickLabelMarginOuter + tickLabelPaddingOuter : tickLabelMarginInner + tickLabelPaddingInner;
  const tickOffset = theTitleOffset + tickMarginOffset;

  const tickTextX = vertical ? tickOffset + tickTextOffset : 0;
  const tickTextY = vertical ? 0 : tickOffset + tickTextOffset;

  axisLayoutInfo.tickTextX = tickTextX;
  axisLayoutInfo.tickTextY = tickTextY;

  // Both boxes offset across the axis and span its full length; the outer side
  // comes first locally, so the title leads for a notAfter axis (matching tickOffset/titleOffset).
  // The inner/outer margin sides follow notAfter too, so a collapsed axis's boxes wrap its text.
  const titleBoxOffset = notAfter ? 0 : totalTickLabelSize;
  const tickLabelBoxOffset = notAfter ? totalTitleSize : 0;

  const titleLayoutInfo = axisLayoutInfo.titleLayoutInfo = title === NONE ? emptyLayoutInfo : createInnerOuterSpacingLayoutInfo({
    x: vertical ? titleBoxOffset : 0,
    y: vertical ? 0 : titleBoxOffset,
    width: vertical ? totalTitleSize : width,
    height: vertical ? height : totalTitleSize,
  }, vertical, inverted, notAfter, titleMarginInner, titleMarginOuter, titlePaddingInner, titlePaddingOuter);

  const tickLabelLayoutInfo = axisLayoutInfo.tickLabelLayoutInfo = createInnerOuterSpacingLayoutInfo({
    x: vertical ? tickLabelBoxOffset : 0,
    y: vertical ? 0 : tickLabelBoxOffset,
    width: vertical ? totalTickLabelSize : width,
    height: vertical ? height : totalTickLabelSize,
  }, vertical, inverted, notAfter, tickLabelMarginInner, tickLabelMarginOuter, tickLabelPaddingInner, tickLabelPaddingOuter);

  const { applyToTitle: focusRangeApplyToTitle } = focusRange;
  const focusRangeTitle = focusRangeApplyToTitle && title !== NONE;
  const focusMarginInner = tickLabelMarginInner;
  const focusMarginOuter = focusRangeApplyToTitle ? titleMarginOuter : tickLabelMarginOuter;
  const focusPaddingInner = tickLabelPaddingInner;
  const focusPaddingOuter = focusRangeApplyToTitle ? titlePaddingOuter : tickLabelPaddingOuter;
  axisLayoutInfo.focusRangeLayoutInfo = axisConfig.focusRange.visible === false ? emptyLayoutInfo : createInnerOuterSpacingLayoutInfo({
    x: focusRangeTitle ? Math.min(titleLayoutInfo.x, tickLabelLayoutInfo.x) : tickLabelLayoutInfo.x,
    y: focusRangeTitle ? Math.min(titleLayoutInfo.y, tickLabelLayoutInfo.y) : tickLabelLayoutInfo.y,
    width: vertical ? (focusRangeApplyToTitle ? titleLayoutInfo.width + tickLabelLayoutInfo.width : tickLabelLayoutInfo.width) : width,
    height: !vertical ? (focusRangeApplyToTitle ? titleLayoutInfo.height + tickLabelLayoutInfo.height : tickLabelLayoutInfo.height) : height,
  }, vertical, inverted, notAfter, focusMarginInner, focusMarginOuter, focusPaddingInner, focusPaddingOuter);

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

  let tickMarkX1 = 0;
  let tickMarkY1 = 0;
  let tickMarkX2 = 0;
  let tickMarkY2 = 0;
  if (axisConfig.tickMark.visible) {
    const { marginInner: tickMarkMargin, size: tickMarkSize } = axisConfig.tickMark;
    const tickMarkOffset = notAfter ? (vertical ? width : height) - tickMarkMargin : tickMarkMargin;
    tickMarkX1 = vertical ? tickMarkOffset : 0;
    tickMarkX2 = vertical ? (notAfter ? tickMarkX1 - tickMarkSize : tickMarkX1 + tickMarkSize) : 0;
    tickMarkY1 = vertical ? 0 : tickMarkOffset;
    tickMarkY2 = vertical ? 0 : (notAfter ? tickMarkY1 - tickMarkSize : tickMarkY1 + tickMarkSize);
  }
  axisLayoutInfo.tickMarkX1 = tickMarkX1;
  axisLayoutInfo.tickMarkY1 = tickMarkY1;
  axisLayoutInfo.tickMarkX2 = tickMarkX2;
  axisLayoutInfo.tickMarkY2 = tickMarkY2;

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

function getTickLabelAnchor(axisConfig: AxisConfigBase, vertical: boolean, tickLabelParallel: boolean): Anchor {
  if (axisConfig.tickLabel.anchor === AUTO) {
    if (!tickLabelParallel) {
      const { side, collapsed } = axisConfig;
      const { rotation: tickLabelRotation } = axisConfig.tickLabel;
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
    return axisConfig.tickLabel.anchor;
  }
}

export interface AxisMetrics {
  axisTickInfos: AxisTickInfos;
  categoryAxisRotatedTickBounds: Bounds;
  valueAxisRotatedTickBounds: Record<string, Bounds>;
  valueAxisSizes: Record<string, number>;
  categoryAxisSize: number;
  valueAxisVisibleSeriesCounts: Record<string, number>;
  categoryAxesOffset: BeforeAfter;
  valueAxesOffset: BeforeAfter;
}

// Independent of the plot extents, so ChartLayout computes it once for the width pre-pass and the full layout pass.
export function getAxisMetrics(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, chartData: ChartDataForLayout | null): AxisMetrics {
  const { plot: plotConfig, categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs } = mochartConfig;
  const { categoryAxisTitleBounds, valueAxisTitleBounds } = chartTextBoundsData;
  const { inverted } = plotConfig;
  const valueAxisVisibleSeriesCounts = chartData ? chartData.seriesData.axisSeriesCounts : {};

  const axisTickInfos = getAxisTickInfos(plotConfig, categoryAxisConfig, valueAxisConfigs);

  const categoryAxisRotatedTickBounds = getCategoryAxisRotatedTickBounds(mochartConfig, chartTextBoundsData, axisTickInfos);
  const valueAxisRotatedTickBounds = getValueAxisRotatedTickBounds(mochartConfig, chartTextBoundsData, axisTickInfos);

  const categoryAxisSize = getCategoryAxisSize(categoryAxisConfig, categoryAxisRotatedTickBounds, categoryAxisTitleBounds, inverted);
  const valueAxisSizes = getValueAxisSizes(valueAxisConfigs, valueAxisVisibleSeriesCounts, valueAxisRotatedTickBounds, valueAxisTitleBounds, !inverted);

  const valueAxesOffset = getCategoryAxisBeforeAfter(categoryAxisConfig, categoryAxisSize);
  const categoryAxesOffset = getValueAxisBeforeAfter(valueAxisConfigs, valueAxisSizes);

  return {
    axisTickInfos,
    categoryAxisRotatedTickBounds,
    valueAxisRotatedTickBounds,
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
    axisTickInfos, categoryAxisRotatedTickBounds, valueAxisRotatedTickBounds, valueAxisSizes, categoryAxisSize,
    valueAxisVisibleSeriesCounts, categoryAxesOffset, valueAxesOffset
  } = axisMetrics;
  const categoryInnerExtent = getInnerExtent(categoryExtent, categoryAxesOffset);
  const valueInnerExtent = getInnerExtent(seriesExtent, valueAxesOffset);

  const valueAxesCollapsedAfter = getCollapsedAfterSizeConsumption(mochartConfig.valueAxes, valueAxisSizes);

  const seriesLayoutInfo = createLayoutInfo(categoryY + categoryAxesOffset.before,
    valueY + valueAxesOffset.before, categoryInnerExtent, valueInnerExtent, inverted);

  const categoryAxisLayoutInfo = createCategoryAxisLayoutInfo(mochartConfig, chartTextBoundsData, categoryAxisRotatedTickBounds, axisTickInfos, categoryY, valueY, categoryInnerExtent, valueInnerExtent, categoryAxesOffset, categoryAxisSize);
  const valueAxisLayoutInfos = createValueAxisLayoutInfos(mochartConfig, chartTextBoundsData, chartData, valueAxisRotatedTickBounds, axisTickInfos, categoryY, valueY, categoryInnerExtent, valueInnerExtent, categoryAxesOffset, valueAxesOffset, valueAxisSizes, valueAxisVisibleSeriesCounts, valueAxesCollapsedAfter);

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
