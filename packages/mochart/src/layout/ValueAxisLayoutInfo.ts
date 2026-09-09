import { arrayToMap, idAccessor } from '../utils/utils';
import { SIDE_START } from '../config/core/constants';
import { getAxisSize, setExtraAxisInfo, getRotatedTickBounds } from './PlotLayout';
import { createInnerOuterSpacingLayoutInfo } from './SpacingLayoutInfo';
import type { Bounds, TextBounds } from '../types/geometry';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisLayoutInfo, AxisTickInfos, BeforeAfter, ChartDataForLayout, ChartTextBoundsData } from '../types/layout';

export const emptyLayoutInfo: Bounds = {
  x: 0, y: 0, width: 0, height: 0
};

function getValueAxisSizeConsumption(axisConfigs: EnhancedValueAxisConfig[], axisSizes: Record<string, number>, isBefore: boolean): number {
  let totalSize = 0;
  for (const axisConfig of axisConfigs) {
    if (axisConfig.collapsed === false && (axisConfig.side === SIDE_START) === isBefore) {
      totalSize+= axisSizes[axisConfig.id];
    }
  }
  return Math.ceil(totalSize);
}

export function getValueAxisBeforeAfter(axisConfigs: EnhancedValueAxisConfig[], axisSizes: Record<string, number>): BeforeAfter {
  return {
    before: getValueAxisSizeConsumption(axisConfigs, axisSizes, true),
    after: getValueAxisSizeConsumption(axisConfigs, axisSizes, false)
  };
}

export function getValueAxisSizes(axisConfigs: EnhancedValueAxisConfig[], axisDataCounts: Record<string, number>, rotatedTickBoundsMap: Record<string, Bounds>, titleBoundsMap: Record<string, TextBounds>, vertical: boolean): Record<string, number> {
  return arrayToMap(axisConfigs, idAccessor, axisConfig => {
    if (axisConfig.visible && (axisConfig.visibleWhenAllFiltered || axisDataCounts[axisConfig.id] > 0)) {
      return getAxisSize(axisConfig, rotatedTickBoundsMap[axisConfig.id], titleBoundsMap[axisConfig.id], vertical);
    }
    else {
      return 0;
    }
  });
}

export function createValueAxisLayoutInfos(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, _chartData: ChartDataForLayout | null, valueAxisRotatedTickBounds: Record<string, Bounds>, axisTickInfos: AxisTickInfos, categoryY: number, valueY: number, categoryInnerExtent: number, valueInnerExtent: number, categoryAxesOffset: BeforeAfter, valueAxesOffset: BeforeAfter, valueAxisSizes: Record<string, number>, _valueAxisVisibleSeriesCounts: Record<string, number>, valueAxesCollapsedAfter: number): Record<string, AxisLayoutInfo> {
  const { plot: plotConfig, valueAxes: valueAxisConfigs } = mochartConfig;
  const { valueAxisTitleBounds, valueAxisTickBounds, valueAxisThresholdTitleBounds } = chartTextBoundsData;
  const { valueAxisTickInfos } = axisTickInfos;
  const { inverted } = plotConfig;
  const vertical = !inverted;
  let currentSeriesOffsetBefore = 0;
  let currentSeriesOffsetAfter = 0;
  let currentSeriesCollapsedOffsetBefore = 0;
  let currentSeriesCollapsedOffsetAfter = 0;
  return arrayToMap<EnhancedValueAxisConfig, AxisLayoutInfo>(valueAxisConfigs, idAccessor, valueAxisConfig => {
    const { id, side, collapsed, marginInner, marginOuter, paddingInner, paddingOuter } = valueAxisConfig;
    const before = side === SIDE_START;
    // a collapsed axis reads like the opposite side's axis, so its inner/outer margins swap with its text
    const notAfter = before !== collapsed;
    // Hidden/filtered axes still get a full layout info — their size is already
    // 0 (getValueAxisSizes), but their series scales need setExtraAxisInfo.
    let valueAxisOffset = categoryY;
    if (collapsed) {
      valueAxisOffset += categoryAxesOffset.before + (before ? currentSeriesCollapsedOffsetBefore : currentSeriesCollapsedOffsetAfter + categoryInnerExtent - valueAxesCollapsedAfter);
    }
    else {
      valueAxisOffset += (before ? currentSeriesOffsetBefore : currentSeriesOffsetAfter + categoryAxesOffset.before + categoryInnerExtent);
    }
    const valueAxisSize = valueAxisSizes[id];
    const valueAxisLayoutInfo = createInnerOuterSpacingLayoutInfo({
      x: inverted ? valueY + valueAxesOffset.before : valueAxisOffset,
      y: inverted ? valueAxisOffset : valueY + valueAxesOffset.before,
      width: inverted ? valueInnerExtent : valueAxisSize,
      height: inverted ? valueAxisSize : valueInnerExtent
    },
      vertical, inverted, notAfter, marginInner, marginOuter, paddingInner, paddingOuter) as AxisLayoutInfo;
    setExtraAxisInfo(valueAxisLayoutInfo, valueAxisConfig, valueAxisTickInfos[id], valueAxisTickBounds[id], valueAxisRotatedTickBounds[id], valueAxisTitleBounds[id], valueAxisThresholdTitleBounds[id], vertical, inverted);
    if (collapsed) {
      currentSeriesCollapsedOffsetBefore += before === true ? valueAxisSize : 0;
      currentSeriesCollapsedOffsetAfter += before === false ? valueAxisSize : 0;
    }
    else {
      currentSeriesOffsetBefore += before === true ? valueAxisSize : 0;
      currentSeriesOffsetAfter += before === false ? valueAxisSize : 0;
    }
    return valueAxisLayoutInfo;
  });
}

export function getValueAxisRotatedTickBounds(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, axisTickInfos: AxisTickInfos): Record<string, Bounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const { valueAxisTickBounds } = chartTextBoundsData;
  const { valueAxisTickInfos } = axisTickInfos;
  return arrayToMap(valueAxisConfigs, idAccessor,
    valueAxisConfig => getRotatedTickBounds(valueAxisConfig, valueAxisTickBounds[valueAxisConfig.id], valueAxisTickInfos[valueAxisConfig.id]));
}
