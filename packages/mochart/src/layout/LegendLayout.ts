import { ALIGN_LEFT, ALIGN_CENTER, AUTO } from '../config/core/constants';
import { getLegendItemBoundsList, getLegendSeriesConfigs } from '../utils/TextMeasurement';
import { leaderSeriesId } from '../utils/SeriesFocus';
import { createSpacingLayoutInfo, getSpacingLeft, getSpacingWidth, getSpacingTop, getSpacingHeight } from './SpacingLayoutInfo';
import type { Bounds, TextBounds } from '../types/geometry';
import type { LegendConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedSeriesConfig } from '../types/enhanced';
import type { ChartTextBoundsData, LayoutInfo, LegendLayoutResult, SpacingLayoutInfo } from '../types/layout';

const fallbackLegendIconSize = 14;

/** clicking the item filters or focuses its series, which is what makes the item a click target */
export function legendItemClickable(mochartConfig: EnhancedMochartConfig, seriesConfig: EnhancedSeriesConfig): boolean {
  const { legend: legendConfig } = mochartConfig;
  const { filterable } = mochartConfig.seriesById[leaderSeriesId(mochartConfig, seriesConfig.id)];
  return (legendConfig.filterOnClick && filterable) || legendConfig.focusOnClick;
}

// accessibility.minTargetSize is the floor for the item boxes, and only while clicking one does
// something; a legend nothing responds to is not a target and stays at its content size
function getLegendItemMinSize(mochartConfig: EnhancedMochartConfig): number {
  const { series: seriesConfigs, accessibility: accessibilityConfig } = mochartConfig;
  const clickable = seriesConfigs.some(seriesConfig => seriesConfig.showInLegend && legendItemClickable(mochartConfig, seriesConfig));
  return clickable ? accessibilityConfig.minTargetSize : 0;
}

// 'auto' tracks the label's font size (like the tooltip's 1em icon), falling back to the measured em box
export function resolveLegendIconSize(legendConfig: LegendConfig, legendTextBounds: TextBounds): number {
  if (legendConfig.icon.size !== AUTO) return legendConfig.icon.size;
  if (legendTextBounds.default || legendTextBounds.height <= 0) return fallbackLegendIconSize;
  const { fontSize } = legendTextBounds;
  return fontSize !== undefined && fontSize > 0 ? Math.round(fontSize) : legendTextBounds.height;
}

interface LegendItemPlacement {
  /** relative to legendMinX, so it can be used as the item's layout x directly */
  x: number;
  y: number;
  width: number;
  rawWidth: number;
}

interface LegendItemPlacements {
  items: LegendItemPlacement[];
  maxX: number;
  maxY: number;
  legendMinX: number;
  legendMinSpacingX: number;
  legendMaxWidth: number;
  legendSpacingTop: number;
  legendSpacingWidth: number;
  legendSpacingHeight: number;
  itemSpacingLeft: number;
  itemSpacingWidth: number;
  iconWidth: number;
  itemHeight: number;
  itemTextHeight: number;
}

// one placement pass shared by the height and layout passes, so both wrap identically
function placeLegendItems(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, contentBounds: Bounds, plotBounds: { x: number; width: number }): LegendItemPlacements | null {
  const { legend: legendConfig } = mochartConfig;
  if (legendConfig.visible !== true || getLegendSeriesConfigs(mochartConfig).length === 0) return null;
  const { margin, padding, alignedToAxes } = legendConfig;
  const { margin: itemMargin, padding: itemPadding } = legendConfig.item;
  const { spacing: iconSpacing } = legendConfig.icon;
  const { legendItemMaxTextBounds } = chartTextBoundsData;
  const legendItemTextRawBounds = getLegendItemBoundsList(mochartConfig, chartTextBoundsData.legendItemTextRawBounds);
  const { x: contentX, width } = contentBounds;
  const iconSize = resolveLegendIconSize(legendConfig, legendItemMaxTextBounds);

  const legendSpacingLeft = getSpacingLeft(margin, padding);
  const legendSpacingTop = getSpacingTop(margin, padding);
  const legendSpacingWidth = getSpacingWidth(margin, padding);
  const legendSpacingHeight = getSpacingHeight(margin, padding);

  const itemSpacingLeft = getSpacingLeft(itemMargin, itemPadding);
  const itemSpacingWidth = getSpacingWidth(itemMargin, itemPadding);
  const itemSpacingHeight = getSpacingHeight(itemMargin, itemPadding);

  // the click target is the item box inside the margin, so its floor carries the margin over
  const itemMinSize = getLegendItemMinSize(mochartConfig);
  const itemMinWidth = itemMinSize + getSpacingWidth(itemMargin);
  const itemMinHeight = itemMinSize + getSpacingHeight(itemMargin);

  const iconWidth = iconSize + iconSpacing;
  const iconHeight = iconSize;

  // the content frame is offset by the chart margin/padding, like the title's
  const legendMinX = alignedToAxes ? plotBounds.x : contentX;
  const legendMaxWidth = alignedToAxes ? plotBounds.width : width;

  const legendMinSpacingX = legendMinX + legendSpacingLeft;
  const legendMaxSpacingWidth = legendMaxWidth - legendSpacingWidth;
  const legendMaxSpacingX = legendMinSpacingX + legendMaxSpacingWidth;

  const itemTextMaxWidth = legendMaxSpacingWidth - itemSpacingWidth - iconWidth;
  const itemTextHeight = legendItemMaxTextBounds.height;

  const itemHeight = Math.max(Math.max(iconHeight, itemTextHeight) + itemSpacingHeight, itemMinHeight);

  const items: LegendItemPlacement[] = [];
  let x = legendMinSpacingX;
  let y = legendSpacingTop;
  let maxX = x;
  let maxY = y;
  let textWidth: number, itemWidth: number, itemRawWidth: number;
  for (const itemTextBounds of legendItemTextRawBounds) {
    textWidth = Math.max(0, Math.min(itemTextBounds.width, itemTextMaxWidth));
    itemWidth = Math.max(textWidth + iconWidth + itemSpacingWidth, itemMinWidth);
    itemRawWidth = Math.max(itemTextBounds.width + iconWidth + itemSpacingWidth, itemMinWidth);
    if (x !== legendMinSpacingX && (x + itemWidth) > legendMaxSpacingX) {
      x = legendMinSpacingX;
      y += itemHeight;
    }
    items.push({ x: x - legendMinX, y, width: itemWidth, rawWidth: itemRawWidth });
    x += itemWidth;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y + itemHeight);
  }

  return {
    items, maxX, maxY,
    legendMinX, legendMinSpacingX, legendMaxWidth,
    legendSpacingTop, legendSpacingWidth, legendSpacingHeight,
    itemSpacingLeft, itemSpacingWidth, iconWidth, itemHeight, itemTextHeight
  };
}

export function getLegendHeight(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, contentBounds: Bounds, plotWidthAndX: { x: number; width: number }): number {
  const placements = placeLegendItems(mochartConfig, chartTextBoundsData, contentBounds, plotWidthAndX);
  if (placements === null) return 0;
  const { maxY, legendSpacingTop, legendSpacingHeight } = placements;
  return maxY - legendSpacingTop + legendSpacingHeight;
}

export function getLegendLayoutInfo(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, contentBounds: Bounds, seriesLayoutInfo: LayoutInfo, legendHeight: number, legendY: number): Partial<LegendLayoutResult> {
  const placements = placeLegendItems(mochartConfig, chartTextBoundsData, contentBounds, seriesLayoutInfo);
  if (placements !== null) {
    const { legend: legendConfig } = mochartConfig;
    const { margin, padding, align } = legendConfig;
    const { margin: itemMargin, padding: itemPadding } = legendConfig.item;
    const { legendItemMaxTextBounds } = chartTextBoundsData;
    const legendItemTextRawBounds = getLegendItemBoundsList(mochartConfig, chartTextBoundsData.legendItemTextRawBounds);
    // Carry the placeholder marker into the item layouts so the rendered icon
    // uses the same fallback size as the layout pass.
    const hasDefaultBounds = legendItemTextRawBounds.some(bounds => bounds.default) || legendItemMaxTextBounds.default;
    const {
      items, maxX,
      legendMinX, legendMinSpacingX, legendMaxWidth, legendSpacingWidth,
      itemSpacingLeft, itemSpacingWidth, iconWidth, itemHeight, itemTextHeight
    } = placements;
    const itemTextWidth = legendItemMaxTextBounds.width;

    const legendItemLayoutInfos: SpacingLayoutInfo[] = [];
    const legendItemRawLayoutInfos: SpacingLayoutInfo[] = [];
    for (const { x, y, width, rawWidth } of items) {
      legendItemLayoutInfos.push(createSpacingLayoutInfo({ x, y, width, height: itemHeight }, itemMargin, itemPadding));
      legendItemRawLayoutInfos.push(createSpacingLayoutInfo({ x, y, width: rawWidth, height: itemHeight }, itemMargin, itemPadding));
    }

    const legendWidth = maxX - legendMinSpacingX + legendSpacingWidth;
    // clamped: a box too small for one item would go negative and produce an invalid clip rect
    const legendItemTextWidth = Math.max(0, legendWidth - legendSpacingWidth - itemSpacingWidth - iconWidth);

    let legendX = legendMinX;
    if (align !== ALIGN_LEFT && legendWidth < legendMaxWidth) {
      const extraWidth = legendMaxWidth - legendWidth;
      legendX += (align === ALIGN_CENTER ? (extraWidth / 2.0) : extraWidth);
    }

    const legendLayoutInfo = createSpacingLayoutInfo({ x: legendX, y: legendY, width: legendWidth, height: legendHeight, default: hasDefaultBounds }, margin, padding);
    // the font size rides along so the rendered icon resolves 'auto' the same way this pass did
    const { fontSize } = legendItemMaxTextBounds;
    const legendItemTextLayoutInfo = createSpacingLayoutInfo({
      x: itemSpacingLeft + iconWidth,
      y: 0,
      width: legendItemTextWidth,
      height: itemTextHeight,
      default: hasDefaultBounds,
      fontSize
    }, itemMargin, itemPadding);
    const legendItemTextRawLayoutInfo = createSpacingLayoutInfo({
      x: itemSpacingLeft + iconWidth,
      y: 0,
      width: itemTextWidth,
      height: itemTextHeight,
      default: hasDefaultBounds,
      fontSize
    }, itemMargin, itemPadding);

    return {
      legendLayoutInfo,
      legendItemTextLayoutInfo,
      legendItemTextRawLayoutInfo,
      legendItemLayoutInfos,
      legendItemRawLayoutInfos
    };
  }

  return {};
}
