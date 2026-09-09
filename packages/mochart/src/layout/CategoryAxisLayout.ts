import { SIDE_START } from '../config/core/constants';
import { setExtraAxisInfo, getAxisSize, getRotatedTickBounds } from './PlotLayout';
import { createInnerOuterSpacingLayoutInfo } from './SpacingLayoutInfo';
import type { Bounds, TextBounds } from '../types/geometry';
import type { CategoryAxisConfig } from '../types/config';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { AxisTickInfos, BeforeAfter, ChartTextBoundsData, CategoryAxisLayoutInfo } from '../types/layout';

function getCategoryAxisSizeConsumption(axisConfig: CategoryAxisConfig, axisSize: number, isBefore: boolean): number {
  if (axisConfig.collapsed === false && (axisConfig.side === SIDE_START) === isBefore) {
    return axisSize;
  }
  else {
    return 0;
  }
}

export function getCategoryAxisBeforeAfter(axisConfig: CategoryAxisConfig, axisSize: number): BeforeAfter {
  return {
    before: getCategoryAxisSizeConsumption(axisConfig, axisSize, true),
    after: getCategoryAxisSizeConsumption(axisConfig, axisSize, false)
  }
}

export function getCategoryAxisSize(axisConfig: CategoryAxisConfig, rotatedTickBounds: Bounds, titleBounds: TextBounds, vertical: boolean): number {
  if (axisConfig.visible) {
    return getAxisSize(axisConfig, rotatedTickBounds, titleBounds, vertical);
  }
  else {
    return 0;
  }
}

export function getCategoryAxisRotatedTickBounds(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, axisTickInfos: AxisTickInfos): Bounds {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  const { categoryAxisTickBounds } = chartTextBoundsData;
  const { categoryAxisTickInfo } = axisTickInfos;
  return getRotatedTickBounds(categoryAxisConfig, categoryAxisTickBounds, categoryAxisTickInfo);
}

export function createCategoryAxisLayoutInfo(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, categoryAxisRotatedTickBounds: Bounds, axisTickInfos: AxisTickInfos, categoryY: number, valueY: number, categoryInnerExtent: number, valueInnerExtent: number, categoryAxesOffset: BeforeAfter, categoryAxisSize: number): CategoryAxisLayoutInfo {
  const { plot: plotConfig, categoryAxis: categoryAxisConfig } = mochartConfig;
  const { categoryAxisTitleBounds, categoryAxisTickBounds, categoryAxisSizeTickBounds, categoryAxisThresholdTitleBounds } = chartTextBoundsData;
  const { categoryAxisTickInfo } = axisTickInfos;
  const { inverted } = plotConfig;
  const vertical = inverted;
  const { side, collapsed, marginInner, marginOuter, paddingInner, paddingOuter } = categoryAxisConfig;
  const before = side === SIDE_START;
  // a collapsed axis reads like the opposite side's axis, so its inner/outer margins swap with its text
  const notAfter = before !== collapsed;
  const categoryAxisOffset = before ? 0 : (collapsed ? valueInnerExtent - categoryAxisSize : valueInnerExtent);

  const categoryAxisLayoutInfo = createInnerOuterSpacingLayoutInfo({
      x: inverted ? valueY + categoryAxisOffset : categoryY + categoryAxesOffset.before,
      y: inverted ? categoryY + categoryAxesOffset.before : valueY + categoryAxisOffset,
      width: inverted ? categoryAxisSize : categoryInnerExtent,
      height: inverted ? categoryInnerExtent : categoryAxisSize
    },
    vertical, inverted, notAfter, marginInner, marginOuter, paddingInner, paddingOuter) as CategoryAxisLayoutInfo;
  setExtraAxisInfo(categoryAxisLayoutInfo, categoryAxisConfig, categoryAxisTickInfo, categoryAxisTickBounds, categoryAxisRotatedTickBounds, categoryAxisTitleBounds, categoryAxisThresholdTitleBounds, vertical, inverted);
  categoryAxisLayoutInfo.position = categoryY;
  categoryAxisLayoutInfo.before = categoryAxesOffset.before;
  categoryAxisLayoutInfo.after = categoryAxesOffset.after;
  categoryAxisLayoutInfo.minTickSize = categoryAxisSizeTickBounds.width;
  return categoryAxisLayoutInfo;
}
