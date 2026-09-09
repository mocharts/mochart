import { getWithMutations } from '../utils/WithMutations';
import { cssBorderWidth } from '../utils/style';
import type { Bounds, Size } from '../types/geometry';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ChartLayoutInfo } from '../types/layout';

const defaultLayout: Bounds = { x: 0, y: 0, width: 50, height: 50 };

export function getTooltipLayoutInfo(mochartConfig: EnhancedMochartConfig, tooltipBounds: null): Bounds;
export function getTooltipLayoutInfo(mochartConfig: EnhancedMochartConfig, tooltipBounds: Size, layoutInfo: ChartLayoutInfo, categoryValueData: { positions: number[] }, focusedCategoryIndex: number,
                                     tooltipCategoryPercentage: number, tooltipSeriesPercentage: number): Bounds;
export function getTooltipLayoutInfo(mochartConfig: EnhancedMochartConfig, tooltipBounds: Size | null, layoutInfo?: ChartLayoutInfo, categoryValueData?: { positions: number[] }, focusedCategoryIndex = -1,
                                     tooltipCategoryPercentage = 0, tooltipSeriesPercentage = 0): Bounds {
  if (tooltipBounds === null) {
    return defaultLayout;
  }
  const { tooltip: tooltipConfig, plot: plotConfig } = mochartConfig;
  const snappedOffset = tooltipConfig.snapToCategory ? categoryValueData!.positions[focusedCategoryIndex] : undefined;
  if (tooltipConfig.snapToCategory && snappedOffset === undefined) {
    return defaultLayout;
  }
  const { chartContentLayoutInfo, seriesLayoutInfo, containerLayoutInfo } = layoutInfo!;
  let { width, height } = tooltipBounds;
  // A null border width leaves the css unset, so the border occupies nothing — and neither does a border with no color.
  const { strokeColor, strokeWidth } = tooltipConfig.backgroundStyle;
  const borderWidth = cssBorderWidth(strokeColor, strokeWidth);
  const { padding } = tooltipConfig;
  width += 2 * borderWidth + padding.left + padding.right;
  height += 2 * borderWidth + padding.top + padding.bottom;
  const categoryOffset = snappedOffset !== undefined ? snappedOffset : tooltipCategoryPercentage * seriesLayoutInfo.categoryExtent;
  const seriesOffset = tooltipSeriesPercentage * seriesLayoutInfo.valueExtent;

  let tooltipLayoutInfo = {
    x: chartContentLayoutInfo.x + seriesLayoutInfo.x + (plotConfig.inverted ? seriesOffset : categoryOffset) - width / 2.0,
    y: chartContentLayoutInfo.y + seriesLayoutInfo.y + (plotConfig.inverted ? categoryOffset : seriesOffset) - height / 2.0,
    width,
    height
  };

  if (tooltipConfig.keepInside) {
    tooltipLayoutInfo = fitRectangleWithinRectangle(
      {
        ...seriesLayoutInfo,
        x: chartContentLayoutInfo.x + seriesLayoutInfo.x,
        y: chartContentLayoutInfo.y + seriesLayoutInfo.y
      },
      tooltipLayoutInfo);
  }
  else {
    tooltipLayoutInfo = fitRectangleWithinRectangle(containerLayoutInfo, tooltipLayoutInfo);
  }

  return tooltipLayoutInfo;
}

export function fitRectangleWithinRectangle({x: bx, y: by, width: bwidth, height: bheight}: Bounds, { x, y, width, height }: Bounds): Bounds {
  // min last, so a rectangle larger than the bounds stays pinned to the near edge instead of
  // being pushed out past the opposite one
  x = Math.max(bx, Math.min(x, bx + bwidth - width));
  y = Math.max(by, Math.min(y, by + bheight - height));
  return { x, y, width, height };
}

export function getTooltipLayoutInfoWithMutations(oldTooltipLayoutInfo: Bounds | null, newTooltipLayoutInfo: Bounds): Bounds {
  return getWithMutations(oldTooltipLayoutInfo, newTooltipLayoutInfo);
}
