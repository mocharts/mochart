import { scaleLinear, scaleTime, scaleUtc } from 'd3-scale';
import { format } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';

import { getWithMutations } from '../utils/WithMutations';
import { isCollapsedDomain, isExplicitCollapsedDomain } from './AxisDomainData';
import { areArraysAndEqual, arrayToMap, idAccessor } from '../utils/utils';
import { AUTO, NONE, SCALE_ORDINAL, SCALE_LINEAR, TYPE_DATE, TYPE_NUMBER, ANCHOR_START, ANCHOR_END, ANCHOR_MIDDLE } from '../config/core/constants';
import type { AxisConfigBase, CategoryAxisConfig, PlotConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisData, AxisScale, AxisTick, AxisValue, ChartData, CategoryAxisData, CategoryAxisDomain, CategorySpacingInfo, CategoryValue, CategoryValues, NullableDomain, ValueAxisData, TickLabelFormatter } from '../types/data';
import type { AxisLayoutInfo, ChartLayoutInfo, CategoryAxisLayoutInfo } from '../types/layout';

const autoTickLabelFormatNumber = 's';
// per-value form: without a tick step to take the precision from, the trailing zeros must be trimmed
const autoOrdinalTickLabelFormatNumber = '~s';
const autoTickLabelFormatDate = '%c';

const enableOrdinalExperimentalMode = true;

export function getAxisData(mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {

  const categoryAxisData = getCategoryAxisData(mochartConfig.categoryAxis, chartLayoutInfo.categoryAxisLayoutInfo, chartData);
  const valueAxisData = getValueAxisData(mochartConfig.plot, mochartConfig.valueAxes, chartLayoutInfo.valueAxisLayoutInfos, chartData);

  return {
    category: categoryAxisData,
    value: valueAxisData
  };
}

function isScaleFunction(value: unknown): value is AxisScale {
  return typeof value === 'function' && 'domain' in value && 'range' in value;
}

// a date scale's domain() hands back fresh Date objects, so identity comparison never matches
function areDomainsEqual(oldDomain: unknown, newDomain: unknown): boolean {
  if (!Array.isArray(oldDomain) || !Array.isArray(newDomain) || oldDomain.length !== newDomain.length) {
    return false;
  }
  return oldDomain.every((value, i) => value instanceof Date && newDomain[i] instanceof Date
    ? value.getTime() === (newDomain[i] as Date).getTime()
    : value === newDomain[i]);
}

export function scaleMutator(oldValue: unknown, newValue: unknown): unknown {
  if (isScaleFunction(oldValue) && isScaleFunction(newValue)) {
    if (areDomainsEqual(oldValue.domain(), newValue.domain()) && areArraysAndEqual(oldValue.range(), newValue.range())) {
      return oldValue;
    }
    else {
      return newValue;
    }
  }
  else {
    return newValue;
  }
}

export function getAxisDataWithMutations(axisData: AxisData | null, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  return getWithMutations(axisData, getAxisData(mochartConfig, chartLayoutInfo, chartData), scaleMutator);
}

export function getAxisDataForCategoryChange(axisData: AxisData, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  const categoryAxisData = getCategoryAxisData(mochartConfig.categoryAxis, chartLayoutInfo.categoryAxisLayoutInfo, chartData);
  return getWithMutations(axisData, Object.assign({}, axisData, { category: categoryAxisData }), scaleMutator);
}

export function getAxisDataForSeriesChange(axisData: AxisData, mochartConfig: EnhancedMochartConfig, chartLayoutInfo: ChartLayoutInfo, chartData: ChartData | null): AxisData {
  const valueAxisData = getValueAxisData(mochartConfig.plot, mochartConfig.valueAxes, chartLayoutInfo.valueAxisLayoutInfos, chartData);
  return getWithMutations(axisData, Object.assign({}, axisData, { value: valueAxisData }), scaleMutator);
}

function getCategoryAxisData(categoryAxisConfig: CategoryAxisConfig, axisLayoutInfo: CategoryAxisLayoutInfo, chartData: ChartData | null): CategoryAxisData | null {
  let categoryAxisData: CategoryAxisData | null = null;
  if (chartData) {
    const { categoryData } = chartData;
    const spacingInfo = getCategorySpacingInfo(categoryAxisConfig, categoryData.renderAxisDomain, axisLayoutInfo.categoryExtent);
    const axisScale = getCategoryAxisScale(categoryAxisConfig, categoryData.renderAxisDomain, spacingInfo);
    const positions = getCategoryValuePositions(categoryAxisConfig, axisScale, categoryData.values);
    // a collapsed domain (one category, or explicit min === max) draws its single tick at the value, not at the widened render bounds
    const tickDomain = isCollapsedDomain(categoryData.axisDomain) ? categoryData.axisDomain : categoryData.renderAxisDomain;
    const axisTickData = getCategoryAxisTickData(categoryAxisConfig, axisLayoutInfo, axisScale, tickDomain, categoryData.values.parsed, positions);
    const maxTickLabelLength = getMaxTickLabelLength(categoryAxisConfig, categoryData.values.parsed, axisTickData, spacingInfo);

    categoryAxisData = {
      axisScale, axisTickData, maxTickLabelLength, valueData: { spacingInfo, positions }
    };
  }
  return categoryAxisData;
}

function getValueAxisData(plotConfig: PlotConfig, valueAxisConfigs: EnhancedValueAxisConfig[], axisLayoutInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], chartData: ChartData | null): ValueAxisData | null {
  let valueAxisData: ValueAxisData | null = null;
  if (chartData) {
    const vertical = !plotConfig.inverted;
    const { seriesData } = chartData;
    const axisScales = getValueAxisScales(valueAxisConfigs, seriesData.raw.renderAxisDomains, seriesData.filtered.renderAxisDomains, axisLayoutInfoArray, vertical);
    const axisTickData = getValueAxisTickData(valueAxisConfigs, axisLayoutInfoArray, seriesData, axisScales, vertical);

    valueAxisData = {
      axisScales, axisTickData
    };
  }
  return valueAxisData;
}

export function getCategorySpacingInfo(categoryAxisConfig: CategoryAxisConfig, categoryAxisDomain: CategoryAxisDomain, categoryAxisExtent: number): CategorySpacingInfo {
  let minPosition = 0;
  let maxPosition = categoryAxisExtent;
  const categoryAxisDomainExtent = categoryAxisDomain[0] === null || categoryAxisDomain[1] === null ? 0 : Math.abs(+categoryAxisDomain[1] - +categoryAxisDomain[0]);
  const categoryCountPadding = categoryAxisConfig.categoryCountPadding;
  let categoryValueExtent;
  if (categoryAxisDomainExtent === 0 && categoryCountPadding === 0) {
    categoryValueExtent = maxPosition;
  }
  else if (categoryCountPadding > 0) {
    categoryValueExtent = maxPosition / (categoryAxisDomainExtent + categoryCountPadding); // category extent is smaller, ex: to allow for bar widths
    minPosition+= categoryValueExtent / 2.0; // shift the visual range of the scale, ex: so the first and last bars aren't sliced in half
    maxPosition-= categoryValueExtent / 2.0;
  }
  else {
    categoryValueExtent = maxPosition / categoryAxisDomainExtent;
  }
  categoryValueExtent =  Math.max(categoryAxisConfig.minCategoryValueExtent, Math.floor(categoryValueExtent * (1.0 - categoryAxisConfig.categoryPaddingFraction.outer)));
  const categoryValueOffset = Math.floor(categoryValueExtent / 2.0);
  return {
    categoryRange: [minPosition, maxPosition] as [number, number],
    categoryValueExtent,
    categoryValueOffset
  };
}

function getCategoryValuePositions(categoryAxisConfig: CategoryAxisConfig, scale: AxisScale, valueData: CategoryValues): number[] {
  const positions: number[] = [];
  const values = categoryAxisConfig.scale === SCALE_ORDINAL ? valueData.numeric : valueData.parsed;
  const count = values.length;
  for (let i=0; i<count; i++) {
    positions.push(scale(values[i] as number | Date));
  }
  return positions;
}

function getCategoryAxisScale(axisConfig: CategoryAxisConfig, axisDomain: CategoryAxisDomain, categorySpacingInfo: CategorySpacingInfo): AxisScale {
  const axisScale = (axisConfig.type === TYPE_DATE && axisConfig.scale === SCALE_LINEAR) ? (axisConfig.dateUTC ? scaleUtc() : scaleTime()) : scaleLinear();
  axisScale.domain(axisDomain);
  axisScale.range(reversedRange(categorySpacingInfo.categoryRange, axisConfig.reversed));
  return axisScale;
}

// reversing the range, not the domain: the domain stays ascending so bases, thresholds, ticks and
// the animation deltas are all untouched (an ordinal category axis reverses its category order too)
function reversedRange(range: [number, number], reversed: boolean): [number, number] {
  return reversed ? [range[1], range[0]] : range;
}

function getValueAxisScales(valueAxisConfigs: EnhancedValueAxisConfig[], rawAxisDomainArray: Record<string, NullableDomain>, filteredAxisDomainArray: Record<string, NullableDomain>, axisLayountInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], vertical: boolean): Record<string, AxisScale> {
  return arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    const axisId = valueAxisConfig.id;
    return getValueAxisScale(valueAxisConfig, rawAxisDomainArray[axisId], filteredAxisDomainArray[axisId], axisLayountInfoArray[axisId], vertical);
  });
}

function getValueAxisScale(axisConfig: EnhancedValueAxisConfig, rawAxisDomain: NullableDomain, filteredAxisDomain: NullableDomain, axisLayoutInfo: AxisLayoutInfo, vertical: boolean): AxisScale {
  return getValueAxisScaleForDomain(axisConfig, axisLayoutInfo, axisConfig.adjustForFiltering ? filteredAxisDomain : rawAxisDomain, vertical);
}

function getValueAxisScaleForDomain(axisConfig: EnhancedValueAxisConfig, axisLayoutInfo: AxisLayoutInfo, axisDomain: NullableDomain, vertical: boolean): AxisScale {
  const axisScale = scaleLinear();
  axisScale.domain(axisDomain);
  const range: [number, number] = vertical ? [axisLayoutInfo.valueExtent, 0] : [0, axisLayoutInfo.valueExtent];
  axisScale.range(reversedRange(range, axisConfig.reversed));
  return axisScale;
}

function createLinearTickObject(scaleTickValue: AxisValue, axisScale: AxisScale, tickLabelFormatter: TickLabelFormatter, isHidden: (tick: Omit<AxisTick, 'hidden'>) => boolean): AxisTick {
  const tickObjectWithoutHidden: Omit<AxisTick, 'hidden'> = {
    label: tickLabelFormatter(scaleTickValue),
    position: axisScale(scaleTickValue),
    value: scaleTickValue
  };
  return { ...tickObjectWithoutHidden, hidden: isHidden(tickObjectWithoutHidden) };
}

function createOrdinalTickObject(scaleTickValue: number, categoryValues: readonly CategoryValue[], categoryPositions: number[], tickLabelFormatter: TickLabelFormatter, isHidden: (tick: Omit<AxisTick, 'hidden'>) => boolean): AxisTick {
  const tickObjectWithoutHidden: Omit<AxisTick, 'hidden'> = {
    label: tickLabelFormatter(categoryValues[scaleTickValue]),
    position: categoryPositions[scaleTickValue],
    value: categoryValues[scaleTickValue]
  };
  return { ...tickObjectWithoutHidden, hidden: isHidden(tickObjectWithoutHidden) };
}

export function getCategoryAxisTickData(axisConfig: CategoryAxisConfig, axisLayoutInfo: CategoryAxisLayoutInfo, axisScale: AxisScale, axisDomain: CategoryAxisDomain, categoryValues: readonly CategoryValue[], categoryPositions: number[]): AxisTick[] {
  let ticks: AxisTick[] = [];
  // magnitude: a reversed axis has a descending range, and tick counting needs a positive extent
  const categoryAxisRangeExtent = Math.abs(axisScale.range()[1] - axisScale.range()[0]);
  const categoryAxisDomainExtent = +axisScale.domain()[1] - +axisScale.domain()[0];

  if (categoryValues.length > 0) {
    let scaleTicks: AxisValue[];
    let tickCount: number;

    if (categoryValues.length === 1) {
      if (axisConfig.scale === SCALE_ORDINAL) {
        scaleTicks = [0];
      }
      else {
        const axisMin = axisDomain[0];
        const axisMax = axisDomain[1];
        // tickDomain, not the scale: an explicit collapsed domain draws one tick at its value
        if (axisMin !== null && axisMax !== null && +axisMin !== +axisMax) {
          scaleTicks = [axisMin, axisMax];
        }
        else {
          scaleTicks = [categoryValues[0] as AxisValue];
        }
      }
      tickCount = scaleTicks.length;
    }
    else {
      let tickLabelSpace = axisLayoutInfo.tickLabelSpace;
      if (axisConfig.scale === SCALE_ORDINAL && axisConfig.tickLabel.truncation.enabled && axisLayoutInfo.tickLabelParallel) {
        tickLabelSpace = axisLayoutInfo.minTickSize;
      }
      tickCount = Math.max(1, getTickCount(axisConfig, categoryAxisRangeExtent, categoryAxisDomainExtent, tickLabelSpace));

      if (axisConfig.scale === SCALE_ORDINAL && tickCount > categoryValues.length) {
        tickCount = categoryValues.length;
      }

      if (tickCount === 1) {
        if (axisConfig.scale === SCALE_ORDINAL) {
          scaleTicks = [0];
        }
        else {
          scaleTicks = [categoryValues[0] as AxisValue];
        }
      }
      else {
        if (axisConfig.scale === SCALE_ORDINAL) {
          scaleTicks = categoryValues.map((_v, i) => i);
        }
        else {
          scaleTicks = axisScale.ticks(tickCount);
        }
      }
    }
    let tickLabelFormatter: TickLabelFormatter;
    if (axisConfig.scale === SCALE_ORDINAL) {
      tickLabelFormatter = getOrdinalScaleTickLabelFormatter(axisConfig, axisScale, scaleTicks.length, categoryValues);
    }
    else {
      tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisScale, scaleTicks.length);
    }
    if (axisConfig.scale === SCALE_ORDINAL) {
      const tickInterval = Math.ceil(categoryValues.length / tickCount);
      if (axisConfig.tickLabel.truncation.enabled && axisLayoutInfo.tickLabelParallel) {
        ticks = scaleTicks.map((scaleTick, i) => createOrdinalTickObject(scaleTick as number, categoryValues, categoryPositions, tickLabelFormatter, () => i % tickInterval !== 0));
      }
      else {
        if (axisLayoutInfo.tickLabelParallel) {
          const { before, after, categoryExtent, tickLabelSpace, tickLabelAnchor } = axisLayoutInfo;

          const beforeOffset = tickLabelAnchor === ANCHOR_START ? 0 : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : tickLabelSpace);
          const afterOffset = tickLabelAnchor === ANCHOR_START ? tickLabelSpace : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : 0);

          const minPosition = beforeOffset - before;
          const maxPosition = categoryExtent + after - afterOffset;

          ticks = scaleTicks.map((scaleTick, i) => createOrdinalTickObject(scaleTick as number, categoryValues, categoryPositions, tickLabelFormatter, ({ position }) => i % tickInterval !== 0 || position < minPosition || position > maxPosition ));
          if (categoryValues.length > 0) {
            const singleIndex = tickLabelAnchor === ANCHOR_START ? 0 : (tickLabelAnchor === ANCHOR_END ? categoryValues.length-1 : Math.floor(categoryValues.length / 2));
            ticks.push(createOrdinalTickObject(singleIndex, categoryValues, categoryPositions, tickLabelFormatter, () => ticks.some(tick => tick.hidden === false)));
          }
        }
        else {
          ticks = scaleTicks.map((scaleTick, i) => createOrdinalTickObject(scaleTick as number, categoryValues, categoryPositions, tickLabelFormatter, () => i % tickInterval !== 0));
        }
      }
    }
    else {
      const { preTicks, postTicks } = getLinearAxisExtraTicks(axisDomain, axisScale, scaleTicks);
      const tickInterval = scaleTicks.length > tickCount ? 2 : 1

      if (axisLayoutInfo.tickLabelParallel) {
        const { before, after, categoryExtent, tickLabelSpace, tickLabelAnchor } = axisLayoutInfo;

        const beforeOffset = tickLabelAnchor === ANCHOR_START ? 0 : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : tickLabelSpace);
        const afterOffset = tickLabelAnchor === ANCHOR_START ? tickLabelSpace : (tickLabelAnchor === ANCHOR_MIDDLE ? Math.ceil(tickLabelSpace / 2.0) : 0);

        const minPosition = beforeOffset - before;
        const maxPosition = categoryExtent + after - afterOffset;

        ticks = scaleTicks.map((scaleTick, i) => createLinearTickObject(scaleTick, axisScale, tickLabelFormatter, ({ position }) => i % tickInterval !== 0 || position < minPosition || position > maxPosition));
        if (categoryValues.length > 0) {
          const singleValue = tickLabelAnchor === ANCHOR_START ? axisDomain[0]! : (tickLabelAnchor === ANCHOR_END ? axisDomain[1]! : +axisDomain[0]! + (+axisDomain[1]! - +axisDomain[0]!) / 2);
          const singleTickValue = axisConfig.type === TYPE_DATE ? new Date(singleValue) : singleValue;
          ticks.push(createLinearTickObject(singleTickValue, axisScale, tickLabelFormatter, () => ticks.some(tick => tick.hidden === false)));
        }
      }
      else {
        ticks = scaleTicks.map((scaleTick, i) => createLinearTickObject(scaleTick, axisScale, tickLabelFormatter, () => i % tickInterval !== 0));
      }

      if (preTicks.length > 0) {
        ticks = preTicks.map(preTick => createLinearTickObject(preTick, axisScale, tickLabelFormatter, () => true)).concat(ticks);
      }
      if (postTicks.length > 0) {
        ticks = ticks.concat(postTicks.map(postTick => createLinearTickObject(postTick, axisScale, tickLabelFormatter, () => true)));
      }
    }
  }

  return ticks;
}

function getMaxTickLabelLength(_categoryAxisConfig: CategoryAxisConfig, categoryValues: readonly CategoryValue[], axisTickData: AxisTick[], spacingInfo: CategorySpacingInfo): number {
  return categoryValues.length / axisTickData.reduce((count, tick) => count + (tick.hidden ? 0 : 1), 0) * spacingInfo.categoryValueExtent;
}

function getValueAxisTickData(axisConfigArray: EnhancedValueAxisConfig[], axisLayoutInfoArray: ChartLayoutInfo['valueAxisLayoutInfos'], seriesData: ChartData['seriesData'], axisScaleArray: Record<string, AxisScale>, vertical: boolean): Record<string, AxisTick[]> {
  return arrayToMap(axisConfigArray, idAccessor, axisConfig => {
    const axisId = axisConfig.id;
    // explicit min === max: the single tick belongs at the configured value, not at the widened render bounds
    const explicitCollapsed = isExplicitCollapsedDomain(axisConfig, seriesData.raw.axisDomains[axisId]);
    const rawDomain = explicitCollapsed ? seriesData.raw.axisDomains[axisId] : seriesData.raw.renderAxisDomains[axisId];
    const filteredDomain = explicitCollapsed ? seriesData.filtered.axisDomains[axisId] : seriesData.filtered.renderAxisDomains[axisId];
    return getValueAxisTickDataObject(axisConfig, axisLayoutInfoArray[axisId], rawDomain, filteredDomain, seriesData.raw.renderAxisDomains[axisId], seriesData.axisSeriesCounts[axisId], axisScaleArray[axisId], vertical);
  });
}

function getValueAxisTickDataObject(axisConfig: EnhancedValueAxisConfig, axisLayoutInfo: AxisLayoutInfo, rawValueAxisDomain: NullableDomain, filteredValueAxisDomain: NullableDomain, rawRenderValueAxisDomain: NullableDomain, visibleSeriesCount: number, axisScale: AxisScale, vertical: boolean): AxisTick[] {
  let ticks: AxisTick[] = [];
  if (axisConfig.ticks !== NONE) {
    if (axisConfig.visibleWhenAllFiltered || visibleSeriesCount > 0) {
      const tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisScale, axisConfig.ticks.length);
      const [rangeStart, rangeEnd] = axisScale.range();
      const rangeMin = Math.min(rangeStart, rangeEnd);
      const rangeMax = Math.max(rangeStart, rangeEnd);
      ticks = axisConfig.ticks.map(({ value, label }) => {
        const position = axisScale(value);
        return {
          label: label ?? tickLabelFormatter(value),
          position,
          value,
          hidden: !Number.isFinite(position) || position < rangeMin || position > rangeMax
        };
      });
    }
    return ticks;
  }
  if (axisConfig.visibleWhenAllFiltered || visibleSeriesCount > 0) {
    let tickCount = axisConfig.tickCount;
    let scaleTicks: AxisValue[];
    const adjustForFiltering = axisConfig.adjustForFiltering;
    const adjustTickLabelsForFiltering = adjustForFiltering && axisConfig.tickLabel.adjustSizeForFiltering;
    const valueAxisDomain = adjustForFiltering ? filteredValueAxisDomain : rawValueAxisDomain;
    const tickBoundsValueAxisDomain = adjustTickLabelsForFiltering ? filteredValueAxisDomain : rawValueAxisDomain;
    if (valueAxisDomain[0] === valueAxisDomain[1]) {
      if (valueAxisDomain[0] === null) {
        tickCount = 0;
        scaleTicks = [];
      }
      else {
        tickCount = 1;
        scaleTicks = [valueAxisDomain[0]];
      }
    }
    else {
      const valueAxisDomainExtent = valueAxisDomain[1]! - valueAxisDomain[0]!;
      tickCount = getTickCount(axisConfig, axisLayoutInfo.valueExtent, valueAxisDomainExtent, axisLayoutInfo.tickLabelSpace);
      if (tickCount === 1) {
        scaleTicks = [valueAxisDomain[0]!];
      }
      else {
        scaleTicks = axisScale.ticks(tickCount);
      }
    }
    // the visible ticks take their precision from the scale that generated them
    const tickLabelFormatter = getLinearScaleTickLabelFormatter(axisConfig, axisScale, scaleTicks.length);
    // the hidden size ticks span the raw domain, so they keep its precision for stable label bounds
    // (always the render domain: a collapsed domain gives tickFormat a zero step and garbage precision)
    const sizeTickLabelFormatter = adjustTickLabelsForFiltering ? tickLabelFormatter
      : getLinearScaleTickLabelFormatter(axisConfig, getValueAxisScaleForDomain(axisConfig, axisLayoutInfo, rawRenderValueAxisDomain, vertical), scaleTicks.length);
    const { preTicks, postTicks } = getLinearAxisExtraTicks(tickBoundsValueAxisDomain, axisScale, scaleTicks);
    const tickInterval = scaleTicks.length > tickCount ? 2 : 1
    ticks = scaleTicks.map((scaleTick, i) => createLinearTickObject(scaleTick, axisScale, tickLabelFormatter, () => i % tickInterval !== 0));
    if (preTicks.length > 0) {
      ticks = preTicks.map(preTick => createLinearTickObject(preTick, axisScale, sizeTickLabelFormatter, () => true)).concat(ticks);
    }
    if (postTicks.length > 0) {
      ticks = ticks.concat(postTicks.map(postTick => createLinearTickObject(postTick, axisScale, sizeTickLabelFormatter, () => true)));
    }
  }
  return ticks;
}

function getLinearAxisExtraTicks(axisDomain: CategoryAxisDomain, _axisScale: AxisScale, scaleTicks: AxisValue[]): { preTicks: AxisValue[]; postTicks: AxisValue[] } {
  const preTicks: AxisValue[] = [];
  const postTicks: AxisValue[] = [];
  if (scaleTicks.length > 1) {
    const minTickValue = scaleTicks[0];
    const maxTickValue = scaleTicks[scaleTicks.length - 1];
    if (axisDomain[0] !== null && +axisDomain[0] < +minTickValue) {
      preTicks.push(axisDomain[0]);
    }
    else if (axisDomain[0] !== null && +axisDomain[0] > +maxTickValue) {
      postTicks.push(axisDomain[0]);
    }
    if (axisDomain[1] !== null && +axisDomain[1] < +minTickValue) {
      preTicks.push(axisDomain[1]);
    }
    else if (axisDomain[1] !== null && +axisDomain[1] > +maxTickValue) {
      postTicks.push(axisDomain[1]);
    }
  }
  else if (scaleTicks.length === 1) {
    if (axisDomain[0] !== null && axisDomain[1] !== null && +axisDomain[0] === +axisDomain[1]) {
      if (+scaleTicks[0] !== +axisDomain[0]) {
        if (+scaleTicks[0] < +axisDomain[0]) {
          postTicks.push(axisDomain[0]);
        }
        else {
          preTicks.push(axisDomain[0]);
        }
      }
    }
    else {
      if (axisDomain[0] !== null && +scaleTicks[0] > +axisDomain[0]) {
        preTicks.push(axisDomain[0]);
      }
      if (axisDomain[1] !== null && +scaleTicks[0] < +axisDomain[1]) {
        postTicks.push(axisDomain[1]);
      }
    }
  }
  else {
    if (axisDomain[0] !== null) {
      if (axisDomain[1] !== null && +axisDomain[0] === +axisDomain[1]) {
        preTicks.push(axisDomain[0]);
      }
      else {
        preTicks.push(axisDomain[0]);
        if (axisDomain[1] !== null) preTicks.push(axisDomain[1]);
      }
    }
  }
  return { preTicks, postTicks };
}

function getTickCount(axisConfig: AxisConfigBase, axisRangeExtent: number, axisDomainExtent: number, tickLabelSpace: number): number {
  const { tickCount, maxTickCount, minTickSpacing, minTickInterval } = axisConfig;
  let count;
  if (tickCount === AUTO) {
    // an invisible axis has no label width, so the divisor is floored at one pixel per tick
    const tickSpace = Math.max(1, tickLabelSpace + minTickSpacing);
    count = Math.max(1, Math.floor((axisRangeExtent + minTickSpacing) / tickSpace));
    if (minTickInterval > 0) {
      const intervalCount = Math.max(1, Math.floor(axisDomainExtent / minTickInterval) + 1);
      count = Math.min(intervalCount, count);
    }
    if (maxTickCount > 0) {
      count = Math.min(maxTickCount, count);
    }
  }
  else {
    count = tickCount;
  }
  return count;
}

function getLinearScaleTickLabelFormatter(axisConfig: CategoryAxisConfig | EnhancedValueAxisConfig, axisScale: AxisScale, tickCount: number): TickLabelFormatter {
  let tickLabelFormatter: TickLabelFormatter = tick => tick;
  if (axisConfig.tickLabel.format !== NONE) {
    if (axisConfig.type === TYPE_NUMBER) {
      tickCount = Math.max(1, tickCount); // axisScale.tickFormat expects > 0 ...
      if (axisConfig.tickLabel.format === AUTO) {
        tickLabelFormatter = axisScale.tickFormat(tickCount, autoTickLabelFormatNumber);
      }
      else {
        tickLabelFormatter = axisScale.tickFormat(tickCount, axisConfig.tickLabel.format);
      }
    }
    else if (axisConfig.type === TYPE_DATE) {
      if (axisConfig.tickLabel.format === AUTO && tickCount > 1) {
        tickLabelFormatter = axisScale.tickFormat();
      }
      else {
        const timeFormatter = 'dateUTC' in axisConfig && axisConfig.dateUTC ? utcFormat : timeFormat;
        if (axisConfig.tickLabel.format === AUTO) {
          const formatter = timeFormatter(autoTickLabelFormatDate);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
        else {
          const formatter = timeFormatter(axisConfig.tickLabel.format);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
      }
    }
  }
  return getTickLabelFormatterForPrefixAndSuffix(axisConfig, tickLabelFormatter);
}

function getDomainForValues(values: readonly CategoryValue[]): [AxisValue, AxisValue] {
  let min: AxisValue | null = null;
  let max: AxisValue | null = null;
  const count = values.length;
  for (let i=0; i<count; i++) {
    const value = values[i] as AxisValue;
    if (max === null || +value > +max) {
      max = value;
    }
    if (min === null || +value < +min) {
      min = value;
    }
  }
  return [min!, max!];
}

function getOrdinalScaleTickLabelFormatter(axisConfig: CategoryAxisConfig, axisScale: AxisScale, tickCount: number, values: readonly CategoryValue[]): TickLabelFormatter {
  if (tickCount <= 1) {
    return getLinearScaleTickLabelFormatter(axisConfig, axisScale, tickCount);
  }
  else {
    let tickLabelFormatter: TickLabelFormatter = tick => tick;
    if (axisConfig.tickLabel.format !== NONE) {
      if (axisConfig.type === TYPE_NUMBER) {
        const formatSpecifier = axisConfig.tickLabel.format === AUTO ? autoOrdinalTickLabelFormatNumber : axisConfig.tickLabel.format;
        // per value, not a linear tickFormat: its precision comes from the tick step, which rounds small categories to 0
        const formatter = format(formatSpecifier);
        tickLabelFormatter = tick => formatter(tick as number);
      }
      else if (axisConfig.type === TYPE_DATE) {
        const timeFormatter = axisConfig.dateUTC ? utcFormat : timeFormat;
        if (axisConfig.tickLabel.format === AUTO) {
          // Experimental code to try to create a nice uniform tick format for ordinal date scales. needs work...
          if (enableOrdinalExperimentalMode) {
            tickLabelFormatter = (axisConfig.dateUTC ? scaleUtc() : scaleTime()).domain(getDomainForValues(values)).tickFormat();
          }
          else {
            const formatter = timeFormatter(autoTickLabelFormatDate);
            tickLabelFormatter = tick => formatter(tick as Date);
          }
        }
        else {
          const formatter = timeFormatter(axisConfig.tickLabel.format);
          tickLabelFormatter = tick => formatter(tick as Date);
        }
      }
    }
    return getTickLabelFormatterForPrefixAndSuffix(axisConfig, tickLabelFormatter);
  }
}

function getTickLabelFormatterForPrefixAndSuffix(axisConfig: AxisConfigBase, tickLabelFormatter: TickLabelFormatter): TickLabelFormatter {
  if (axisConfig.tickLabel.prefix !== NONE || axisConfig.tickLabel.suffix !== NONE) {
    const oldTickLabelFormatter = tickLabelFormatter;
    if (axisConfig.tickLabel.prefix !== NONE && axisConfig.tickLabel.suffix !== NONE) {
      const prefix = axisConfig.tickLabel.prefix!;
      const suffix = axisConfig.tickLabel.suffix!;
      tickLabelFormatter = (tick: CategoryValue) => (prefix + oldTickLabelFormatter(tick) + suffix);
    }
    else if (axisConfig.tickLabel.prefix !== NONE) {
      const prefix = axisConfig.tickLabel.prefix!;
      tickLabelFormatter = (tick: CategoryValue) => (prefix + oldTickLabelFormatter(tick));
    }
    else if (axisConfig.tickLabel.suffix !== NONE) {
      const suffix = axisConfig.tickLabel.suffix!;
      tickLabelFormatter = (tick: CategoryValue) => (oldTickLabelFormatter(tick) + suffix);
    }
  }
  return tickLabelFormatter;
}
