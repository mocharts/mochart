import { getCategoryDomainForValues } from './DomainData';
import { calculateValueAxisDomain } from './SeriesData';
import { getWithMutations } from '../utils/WithMutations';
import { AUTO, SCALE_ORDINAL } from '../config/core/constants';
import type { ChartData, ClippedEdges, DomainValue, NullableDomain } from '../types/data';
import type { EnhancedMochartConfig } from '../types/enhanced';

export const noClippedEdges: ClippedEdges = { top: false, right: false, bottom: false, left: false };

// keyed on the parsed category values array, which value-tween frames reuse by reference,
// so the per-frame rescan of every category collapses to a lookup
const categoryDomainCache = new WeakMap<readonly DomainValue[], NullableDomain<DomainValue>>();

function getCachedCategoryDomain(values: readonly DomainValue[]): NullableDomain<DomainValue> {
  let domain = categoryDomainCache.get(values);
  if (domain === undefined) {
    domain = getCategoryDomainForValues(values);
    categoryDomainCache.set(values, domain);
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
  }

  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  // an ordinal category axis validates min/max to "auto", so it can never clip
  if (categoryAxisConfig.scale !== SCALE_ORDINAL) {
    const drawnDomain = getCachedCategoryDomain(chartData.categoryData.values.parsed as readonly DomainValue[]);
    setClippedEdges(clippedEdges, mochartConfig, categoryAxisConfig, toNumericDomain(drawnDomain),
      toNumericDomain(chartData.categoryData.axisDomain), true);
  }

  return clippedEdges;
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
