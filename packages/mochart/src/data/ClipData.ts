import { getCategoryDomainForValues } from './DomainData.js';
import { calculateValueAxisDomain } from './SeriesData.js';
import { getWithMutations } from '../utils/WithMutations.js';
import { AUTO, SCALE_LOG, SCALE_ORDINAL } from '../config/core/constants.js';
import type { ChartData, ClippedEdges, DomainValue, NullableDomain, NumericValues, SeriesValueObject } from '../types/data.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';

export const noClippedEdges: ClippedEdges = { top: false, right: false, bottom: false, left: false };

// keyed on the parsed category values array, which value-tween frames reuse by reference,
// so the per-frame rescan of every category collapses to a lookup
const categoryDomainCache = new WeakMap<readonly DomainValue[], NullableDomain<DomainValue>>();
const positiveCategoryDomainCache = new WeakMap<readonly DomainValue[], NullableDomain<DomainValue>>();

// positiveOnly on a log axis, where a category value at or below 0 has no position and so cannot be clipped
function getCachedCategoryDomain(values: readonly DomainValue[], positiveOnly: boolean): NullableDomain<DomainValue> {
  const cache = positiveOnly ? positiveCategoryDomainCache : categoryDomainCache;
  let domain = cache.get(values);
  if (domain === undefined) {
    domain = getCategoryDomainForValues(positiveOnly ? (values as readonly number[]).filter(value => value > 0) : values);
    cache.set(values, domain);
  }
  return domain;
}

export function hasClippedEdge(clippedEdges: ClippedEdges): boolean {
  return clippedEdges.top || clippedEdges.right || clippedEdges.bottom || clippedEdges.left;
}

/** getClippedEdges keeping the old object when no edge changed, so the clip indicator can skip. */
export function getClippedEdgesWithMutations(clippedEdges: ClippedEdges | null, mochartConfig: EnhancedMochartConfig, chartData: ChartData): ClippedEdges {
  return getWithMutations(clippedEdges, getClippedEdges(mochartConfig, chartData));
}

/** Which plot edges have data hidden behind them (for the clip indicator): compares the drawn filtered values against the rendered axis domain, per frame. */
export function getClippedEdges(mochartConfig: EnhancedMochartConfig, chartData: ChartData): ClippedEdges {
  const clippedEdges = { ...noClippedEdges };

  for (const valueAxisConfig of mochartConfig.valueAxes) {
    const renderedDomain = valueAxisConfig.adjustForFiltering
      ? chartData.seriesData.filtered.axisDomains[valueAxisConfig.id]
      : chartData.seriesData.raw.axisDomains[valueAxisConfig.id];
    // the drawn extent, recomputed rather than read: with both bounds explicit the axis domain
    // never calls its calculator, so no pre-bound extent is stored anywhere
    const drawnDomain = calculateValueAxisDomain(valueAxisConfig, chartData.seriesData.filtered.domains);
    setClippedEdges(clippedEdges, mochartConfig, valueAxisConfig, drawnDomain, renderedDomain, false);
    // an end at or below 0 is drawn past the minimum end of a log axis, whatever its bounds
    if (valueAxisConfig.scale === SCALE_LOG && valueAxisConfig.seriesConfigs!.some(seriesConfig =>
      hasEndPastMinimum(chartData.seriesData.filtered.values[seriesConfig.id]))) {
      clippedEdges[getClippedEdge(mochartConfig, valueAxisConfig.reversed, false, false)] = true;
    }
  }

  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  // an ordinal category axis validates min/max to "auto", so it can never clip
  if (categoryAxisConfig.scale !== SCALE_ORDINAL) {
    const drawnDomain = getCachedCategoryDomain(chartData.categoryData.values.parsed as readonly DomainValue[], categoryAxisConfig.scale === SCALE_LOG);
    setClippedEdges(clippedEdges, mochartConfig, categoryAxisConfig, toNumericDomain(drawnDomain),
      toNumericDomain(chartData.categoryData.axisDomain), true);
  }

  return clippedEdges;
}

// keyed on the value object, which focus frames reuse by reference
const endPastMinimumCache = new WeakMap<SeriesValueObject, boolean>();

/** Whether an error bar end, or the lower end of a range whose other end is above 0, is at or below 0 and so drawn past a log axis's minimum end. */
function hasEndPastMinimum(valueObject: SeriesValueObject | undefined): boolean {
  if (valueObject === undefined || valueObject.plain === null) {
    return false;
  }
  let result = endPastMinimumCache.get(valueObject);
  if (result === undefined) {
    const { errorLow, errorHigh, min, max } = valueObject;
    const atOrBelowZero = (values: NumericValues | null, i: number) => values !== null && values[i]! <= 0;
    result = false;
    for (let i = 0; i < valueObject.plain.length && !result; i++) {
      // an error bar is drawn at a point with a position, so only its value counts; NaN compares false throughout
      result = (max !== null && max[i]! > 0 && (atOrBelowZero(errorLow, i) || atOrBelowZero(errorHigh, i))) ||
        (min !== null && max !== null && ((atOrBelowZero(min, i) && max[i]! > 0) || (atOrBelowZero(max, i) && min[i]! > 0)));
    }
    endPastMinimumCache.set(valueObject, result);
  }
  return result;
}

function setClippedEdges(clippedEdges: ClippedEdges, mochartConfig: EnhancedMochartConfig,
  axisConfig: { min: unknown; max: unknown; minOffset: number; maxOffset: number; reversed: boolean }, drawnDomain: NullableDomain,
  renderedDomain: NullableDomain, isCategoryAxis: boolean): void {
  if (drawnDomain[0] === null || renderedDomain[0] === null || renderedDomain[1] === null) {
    return;
  }
  // an explicit bound or an offset can clip: a plain auto end is computed from the data it would be hiding
  if ((axisConfig.min !== AUTO || axisConfig.minOffset !== 0) && drawnDomain[0] < renderedDomain[0]) {
    clippedEdges[getClippedEdge(mochartConfig, axisConfig.reversed, isCategoryAxis, false)] = true;
  }
  if ((axisConfig.max !== AUTO || axisConfig.maxOffset !== 0) && drawnDomain[1]! > renderedDomain[1]) {
    clippedEdges[getClippedEdge(mochartConfig, axisConfig.reversed, isCategoryAxis, true)] = true;
  }
}

/** Which screen edge an exceeded axis end lands on: `reversed` swaps the ends, `plot.inverted` swaps each axis's orientation, and a vertical value axis tops out where a vertical category axis bottoms out. */
function getClippedEdge(mochartConfig: EnhancedMochartConfig, reversed: boolean, isCategoryAxis: boolean,
  isMaxEnd: boolean): keyof ClippedEdges {
  const horizontal = isCategoryAxis ? !mochartConfig.plot.inverted : mochartConfig.plot.inverted;
  const atHighEnd = isMaxEnd !== reversed;
  if (horizontal) {
    return atHighEnd ? 'right' : 'left';
  }
  if (isCategoryAxis) {
    return atHighEnd ? 'bottom' : 'top';
  }
  return atHighEnd ? 'top' : 'bottom';
}

function toNumericDomain(domain: NullableDomain<DomainValue>): NullableDomain {
  return [numericBound(domain[0]), numericBound(domain[1])];
}

function numericBound(value: DomainValue | null): number | null {
  return value === null ? null : value instanceof Date ? value.getTime() : value;
}
