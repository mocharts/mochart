import { getDomainExtents, getMaxDomain, copyDomain } from '../data/DomainData';

import { getCategoryDataWithRenderAxisDomain, getCategoryDataWithNumericValues } from '../data/CategoryData';

import { getChartDataWithData, getChartDataWithRenderAxisDomains, getChartDataWithSeriesData } from '../data/ChartData';

import { getSeriesDataWithRenderAxisDomains, getSeriesDataWithSeriesBases, getSeriesDataWithDomains, getSeriesBases } from '../data/SeriesData';

import { domainKeys } from '../data/constants';

import { hasCategoryAdditions, getExpansionCategoryValueDeltaData, getContractionCategoryValueDeltaData } from './CategoryAnimationData';

import { mapMap } from '../utils/utils';

import { SCALE_ORDINAL, DOMAIN_CHANGE_COMBINED, DOMAIN_CHANGE_STAGED } from '../config/core/constants';
import type { DomainChange } from '../config/core/constants';
import type { AxisDomains, ChartData, CategoryAxisDomain, DomainValue, NullableDomain, SeriesData, SeriesDataSet, SeriesDomainObject, SeriesDomainObjects, SeriesValueObjects } from '../types/data';
import type { EnhancedMochartConfig, EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type {
  AxisDeltaData, CompleteNumericArrayDelta, DomainDelta, DomainDeltaMap, CategoryDeltaData,
  NumericDomain, SeriesDomainDelta, SeriesDomainDeltaMap
} from '../types/animation';

// Various constants

// factories, not shared singletons: setDeltaFactor stamps deltaFactor onto whatever these hand back
function emptyCategoryAxisDomainDelta(): DomainDelta {
  return { deltaPercentage: 0, delta: null };
}

function emptyValueAxisDomainDelta(): DomainDeltaMap {
  return { deltaPercentage: 0, deltas: null };
}

const emptySeriesDomainDelta = {
  deltaPercentage: 0,
  deltas: null
};

export const emptyAxisDeltaData = {
  start: null,
  deltaPercentage: 0,
  deltas: null,
  end: null
};

// Various utility functions

// a barely-overlapping domain change (union far taller than either endpoint) is a translation: it skips the expand/contract "pump" and interpolates its render domain during the value phase
export const TRANSLATION_UNION_RATIO = 1.5;

export function isDomainTranslation(fromDomain: NullableDomain<DomainValue>, toDomain: NullableDomain<DomainValue>): boolean {
  if (fromDomain[0] === null || fromDomain[1] === null || toDomain[0] === null || toDomain[1] === null) {
    return false;
  }
  const fromExtent = +fromDomain[1] - +fromDomain[0];
  const toExtent = +toDomain[1] - +toDomain[0];
  const maxExtent = Math.max(fromExtent, toExtent);
  if (maxExtent <= 0) { // collapsed/inverted domains stay on the existing machinery
    return false;
  }
  const unionExtent = Math.max(+fromDomain[1], +toDomain[1]) - Math.min(+fromDomain[0], +toDomain[0]);
  return unionExtent > TRANSLATION_UNION_RATIO * maxExtent;
}

/** Whether a domain change interpolates directly during the value phase, per animation.domainChange. */
export function shouldCombineDomainChange(domainChange: DomainChange, fromDomain: NullableDomain<DomainValue>, toDomain: NullableDomain<DomainValue>): boolean {
  if (domainChange === DOMAIN_CHANGE_STAGED) {
    return false;
  }
  if (fromDomain[0] === null || fromDomain[1] === null || toDomain[0] === null || toDomain[1] === null) {
    return false; // empty->data transitions stay on the existing machinery
  }
  if (domainChange === DOMAIN_CHANGE_COMBINED) {
    return +fromDomain[0] !== +toDomain[0] || +fromDomain[1] !== +toDomain[1];
  }
  return isDomainTranslation(fromDomain, toDomain);
}

/** Classified once per axis on the domains its scale displays, so raw and filtered never diverge. */
export function getCombinedDomainAxisIds(domainChange: DomainChange, valueAxisConfigs: EnhancedValueAxisConfig[], fromRawDomains: AxisDomains, fromFilteredDomains: AxisDomains, toRawDomains: AxisDomains, toFilteredDomains: AxisDomains): string[] {
  const axisIds: string[] = [];
  for (const valueAxisConfig of valueAxisConfigs) {
    const axisId = valueAxisConfig.id;
    const fromDomain = valueAxisConfig.adjustForFiltering ? fromFilteredDomains[axisId] : fromRawDomains[axisId];
    const toDomain = valueAxisConfig.adjustForFiltering ? toFilteredDomains[axisId] : toRawDomains[axisId];
    if (shouldCombineDomainChange(domainChange, fromDomain, toDomain)) {
      axisIds.push(axisId);
    }
  }
  return axisIds;
}

function resetAxisDomainsForIds(targetDomains: AxisDomains, sourceDomains: AxisDomains, axisIds: string[]): void {
  for (const axisId of axisIds) {
    targetDomains[axisId] = copyDomain(sourceDomains[axisId]);
  }
}

export function withAxisDomainsForIds(baseDomains: AxisDomains, overrideDomains: AxisDomains, axisIds: string[]): AxisDomains {
  if (axisIds.length === 0) {
    return baseDomains;
  }
  const domains: AxisDomains = Object.assign(Object.create(null), baseDomains);
  for (const axisId of axisIds) {
    domains[axisId] = overrideDomains[axisId];
  }
  return domains;
}

function resetSeriesDomainsForAxes(targetDomains: SeriesDomainObjects, sourceDomains: SeriesDomainObjects, seriesConfigs: EnhancedSeriesConfig[], axisIds: string[]): void {
  if (axisIds.length === 0) {
    return;
  }
  for (const seriesConfig of seriesConfigs) {
    if (axisIds.indexOf(seriesConfig.axis!) !== -1) {
      targetDomains[seriesConfig.id] = copySeriesDomain(sourceDomains[seriesConfig.id]);
    }
  }
}

export function withSeriesDomainsForAxes(baseDomains: SeriesDomainObjects, overrideDomains: SeriesDomainObjects, seriesConfigs: EnhancedSeriesConfig[], axisIds: string[]): SeriesDomainObjects {
  if (axisIds.length === 0) {
    return baseDomains;
  }
  const domains: SeriesDomainObjects = Object.assign(Object.create(null), baseDomains);
  for (const seriesConfig of seriesConfigs) {
    if (axisIds.indexOf(seriesConfig.axis!) !== -1) {
      domains[seriesConfig.id] = overrideDomains[seriesConfig.id];
    }
  }
  return domains;
}

// a translation (both ends moving the same way) paces on the center shift, growth/shrink on the larger end movement, so the moving edge never trails the values inside it
function getDomainDeltaMagnitude(minDelta: number, maxDelta: number): number {
  if (minDelta * maxDelta > 0) {
    return Math.abs(minDelta + maxDelta) / 2;
  }
  return Math.max(Math.abs(minDelta), Math.abs(maxDelta));
}

/** Signed per-axis domain deltas for the value phase (see getDomainDeltaMagnitude for pacing). */
export function getCombinedAxisDomainDeltas(fromDomains: AxisDomains, toDomains: AxisDomains, fromValueAxisDomainExtents: Record<string, number>): DomainDeltaMap {
  let deltaPercentage = 0;
  const deltas: Record<string, DomainDelta> = Object.create(null);
  for (const axisId of Object.keys(fromDomains)) {
    const fromDomain = fromDomains[axisId];
    const toDomain = toDomains[axisId];
    let delta: NumericDomain | null = null;
    let axisDeltaPercentage = 0;
    if (fromDomain[0] !== null && fromDomain[1] !== null && toDomain[0] !== null && toDomain[1] !== null) {
      const minDelta = +toDomain[0] - +fromDomain[0];
      const maxDelta = +toDomain[1] - +fromDomain[1];
      const magnitude = getDomainDeltaMagnitude(minDelta, maxDelta);
      if (magnitude !== 0) {
        delta = [minDelta, maxDelta];
        const extent = fromValueAxisDomainExtents[axisId];
        axisDeltaPercentage = extent > 0 ? magnitude / extent : 0;
      }
    }
    deltas[axisId] = { deltaPercentage: axisDeltaPercentage, delta };
    deltaPercentage = Math.max(deltaPercentage, axisDeltaPercentage);
  }
  return deltaPercentage === 0 ? emptyValueAxisDomainDelta() : { deltaPercentage, deltas };
}

/** Single-domain sibling of getCombinedAxisDomainDeltas for the category axis (dates coerce via +). */
export function getCombinedCategoryDomainDelta(fromDomain: CategoryAxisDomain, toDomain: CategoryAxisDomain, fromDomainExtent: number): DomainDelta {
  if (fromDomain[0] === null || fromDomain[1] === null || toDomain[0] === null || toDomain[1] === null) {
    return emptyCategoryAxisDomainDelta();
  }
  const minDelta = +toDomain[0] - +fromDomain[0];
  const maxDelta = +toDomain[1] - +fromDomain[1];
  const magnitude = getDomainDeltaMagnitude(minDelta, maxDelta);
  if (magnitude === 0 || fromDomainExtent <= 0) {
    return emptyCategoryAxisDomainDelta();
  }
  return { deltaPercentage: magnitude / fromDomainExtent, delta: [minDelta, maxDelta] };
}

function getPositiveDomainDelta(fromDomain: NullableDomain, toDomain: NullableDomain): NumericDomain {
  const domainDelta: NumericDomain = [0,0];
  const fromMin = fromDomain[0]!;
  const fromMax = fromDomain[1]!;
  const toMin = toDomain[0]!;
  const toMax = toDomain[1]!;
  if (toMin < fromMin) {
    domainDelta[0] = toMin - fromMin;
  }
  if (toMax > fromMax) {
    domainDelta[1] = toMax - fromMax;
  }
  return domainDelta;
}

function getPositiveDomainDeltaPercentage(domainDelta: NumericDomain, domainExtent: number): number {
  if (domainDelta[0] < 0 || domainDelta[1] > 0) {
    const domainDeltaExtent = Math.abs(domainDelta[0]) + domainDelta[1];
    // an inverted domain has a negative extent, which could cancel the denominator to zero
    return domainDeltaExtent / (domainDeltaExtent + Math.max(domainExtent, 0));
  }
  else {
    return 0;
  }
}

function getDomainExtentWithValueGetter(domain: CategoryAxisDomain, getValue: (value: CategoryAxisDomain[number]) => number): number {
  return getValue(domain[1]) - getValue(domain[0]);
}

export function getMaxAxisDomains(domains: AxisDomains, otherDomains: AxisDomains): AxisDomains {
  const maxDomains: AxisDomains = Object.create(null);
  const axisIds = Object.keys(domains);
  for (const axisId of axisIds) {
    maxDomains[axisId] = getMaxDomain(domains[axisId], otherDomains[axisId]);
  }
  return maxDomains;
}

function getMaxSeriesDomain(domainObject: SeriesDomainObject, otherDomainObject: SeriesDomainObject): SeriesDomainObject {
  const newDomainObject: SeriesDomainObject = {};
  for (const key of domainKeys) {
    newDomainObject[key] = getMaxDomain(domainObject[key], otherDomainObject[key]);
  }
  return newDomainObject;
}

function getMaxSeriesDomains(domainObjects: SeriesDomainObjects, otherDomainObjects: SeriesDomainObjects): SeriesDomainObjects {
  const newDomainObjects: SeriesDomainObjects = Object.create(null);
  const seriesIds = Object.keys(domainObjects);
  for (const seriesId of seriesIds) {
    newDomainObjects[seriesId] = getMaxSeriesDomain(domainObjects[seriesId], otherDomainObjects[seriesId]);
  }
  return newDomainObjects;
}

function copyValueAxisDomains(valueAxisDomains: AxisDomains): AxisDomains {
  return mapMap<NullableDomain, NullableDomain>(valueAxisDomains, x => copyDomain(x));
}

function copySeriesDomains(seriesDomainObjects: SeriesDomainObjects): SeriesDomainObjects {
  return mapMap(seriesDomainObjects, x => copySeriesDomain(x));
}

function copySeriesDomain(seriesDomainObject: SeriesDomainObject): SeriesDomainObject {
  const domainObject: SeriesDomainObject = {};
  for (const key of domainKeys) {
    domainObject[key] = copyDomain(seriesDomainObject[key]);
  }
  return domainObject;
}

// Main axis/domain animation functions

// the animation interpolates render domains only; the semantic domains (which clip detection reads) ride along unchanged
export function getTransitionAxisExpansionData(mochartConfig: EnhancedMochartConfig, prevChartData: ChartData, newChartData: ChartData, categoryDeltaData: CategoryDeltaData): AxisDeltaData {
  let finalChartData = prevChartData;
  let endChartData = prevChartData;
  let finalCategoryData = prevChartData.categoryData;
  let endCategoryData = prevChartData.categoryData;
  let finalCategoryAxisDomain = prevChartData.categoryData.renderAxisDomain;

  let categoryValueDeltaData: CompleteNumericArrayDelta | null = null;

  let startCategoryAxisDomain: CategoryAxisDomain, endCategoryAxisDomain: CategoryAxisDomain;

  const { categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs, series: seriesConfigs } = mochartConfig;

  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    if (hasCategoryAdditions(categoryDeltaData)) {
      startCategoryAxisDomain = prevChartData.categoryData.renderAxisDomain;
      endCategoryAxisDomain = [0, (categoryDeltaData.indices.old.length + categoryDeltaData.indices.added.length) - 1];
    }
    else {
      startCategoryAxisDomain = prevChartData.categoryData.renderAxisDomain;
      endCategoryAxisDomain = prevChartData.categoryData.renderAxisDomain;
    }
  }
  else {
    startCategoryAxisDomain = copyDomain(prevChartData.categoryData.renderAxisDomain);
    // a combined-domain category axis (e.g. a sliding window) sits out the union; its domain moves during the value phase
    if (shouldCombineDomainChange(mochartConfig.animation.categoryDomainChange, prevChartData.categoryData.renderAxisDomain, newChartData.categoryData.renderAxisDomain)) {
      endCategoryAxisDomain = copyDomain(startCategoryAxisDomain);
    }
    else {
      endCategoryAxisDomain = getMaxDomain(prevChartData.categoryData.renderAxisDomain, newChartData.categoryData.renderAxisDomain);
    }
    setBaseDomainForChanges(startCategoryAxisDomain, endCategoryAxisDomain);
  }

  const categoryAxisDomainDelta = getCategoryAxisDomainDelta(startCategoryAxisDomain, endCategoryAxisDomain);
  if (categoryAxisDomainDelta.deltaPercentage !== 0) {
    finalCategoryAxisDomain = endCategoryAxisDomain;
    categoryValueDeltaData = getExpansionCategoryValueDeltaData(categoryAxisConfig, categoryDeltaData, prevChartData, newChartData, endCategoryAxisDomain);

    endCategoryData = getCategoryDataWithRenderAxisDomain(prevChartData.categoryData, endCategoryAxisDomain);
    finalCategoryData = getCategoryDataWithRenderAxisDomain(prevChartData.categoryData, finalCategoryAxisDomain);

    if (categoryValueDeltaData !== null) {
      endCategoryData = getCategoryDataWithNumericValues(endCategoryData, categoryValueDeltaData.end);
      finalCategoryData = getCategoryDataWithNumericValues(finalCategoryData, categoryValueDeltaData.end);
    }
  }

  let finalSeriesData = prevChartData.seriesData;
  let endSeriesData = prevChartData.seriesData;
  let finalRawValueAxisDomains = prevChartData.seriesData.raw.renderAxisDomains;
  let finalFilteredValueAxisDomains = prevChartData.seriesData.filtered.renderAxisDomains;
  let finalSeriesBases = prevChartData.seriesData.seriesBases;
  let finalRawSeriesDomains = prevChartData.seriesData.raw.domains;
  let finalFilteredSeriesDomains = prevChartData.seriesData.filtered.domains;

  // combined-domain axes sit out both union phases: their domain moves during the value phase instead; classified on the unfilled domains so the empty-domain guard sees the nulls, like the value phase does
  const combinedAxisIds = getCombinedDomainAxisIds(mochartConfig.animation.valueDomainChange, valueAxisConfigs,
    prevChartData.seriesData.raw.renderAxisDomains, prevChartData.seriesData.filtered.renderAxisDomains,
    newChartData.seriesData.raw.renderAxisDomains, newChartData.seriesData.filtered.renderAxisDomains);
  const rawSet = getDomainDeltaSet(seriesConfigs, prevChartData.seriesData.raw, newChartData.seriesData.raw, false, combinedAxisIds);
  const filteredSet = getDomainDeltaSet(seriesConfigs, prevChartData.seriesData.filtered, newChartData.seriesData.filtered, false, combinedAxisIds);

  let endRawValueAxisDomains = rawSet.startValueAxisDomains;
  let endFilteredValueAxisDomains = filteredSet.startValueAxisDomains;
  let endRawSeriesDomains = rawSet.startSeriesDomains;
  let endFilteredSeriesDomains = filteredSet.startSeriesDomains;

  if (rawSet.valueAxisDomainDeltas.deltaPercentage !== 0) {
    endRawValueAxisDomains = getMaxAxisDomains(rawSet.startValueAxisDomains, rawSet.endValueAxisDomains);
    finalRawValueAxisDomains = withAxisDomainsForIds(
      getMaxAxisDomains(prevChartData.seriesData.raw.renderAxisDomains, newChartData.seriesData.raw.renderAxisDomains),
      prevChartData.seriesData.raw.renderAxisDomains, combinedAxisIds);
  }
  if (filteredSet.valueAxisDomainDeltas.deltaPercentage !== 0) {
    endFilteredValueAxisDomains = getMaxAxisDomains(filteredSet.startValueAxisDomains, filteredSet.endValueAxisDomains);
    finalFilteredValueAxisDomains = withAxisDomainsForIds(
      getMaxAxisDomains(prevChartData.seriesData.filtered.renderAxisDomains, newChartData.seriesData.filtered.renderAxisDomains),
      prevChartData.seriesData.filtered.renderAxisDomains, combinedAxisIds);
  }
  if (rawSet.seriesDomainDeltas.deltaPercentage !== 0) {
    endRawSeriesDomains = getMaxSeriesDomains(rawSet.startSeriesDomains, rawSet.endSeriesDomains);
    finalRawSeriesDomains = withSeriesDomainsForAxes(
      getMaxSeriesDomains(prevChartData.seriesData.raw.domains, newChartData.seriesData.raw.domains),
      prevChartData.seriesData.raw.domains, seriesConfigs, combinedAxisIds);
  }
  if (filteredSet.seriesDomainDeltas.deltaPercentage !== 0) {
    endFilteredSeriesDomains = getMaxSeriesDomains(filteredSet.startSeriesDomains, filteredSet.endSeriesDomains);
    finalFilteredSeriesDomains = withSeriesDomainsForAxes(
      getMaxSeriesDomains(prevChartData.seriesData.filtered.domains, newChartData.seriesData.filtered.domains),
      prevChartData.seriesData.filtered.domains, seriesConfigs, combinedAxisIds);
  }
  // a base follows the series domains it reads and the axis bounds it is held within, so either changing moves it
  if (rawSet.valueAxisDomainDeltas.deltaPercentage !== 0 || filteredSet.valueAxisDomainDeltas.deltaPercentage !== 0 ||
    rawSet.seriesDomainDeltas.deltaPercentage !== 0 || filteredSet.seriesDomainDeltas.deltaPercentage !== 0) {
    finalSeriesBases = getSeriesBases(seriesConfigs, finalRawSeriesDomains, finalFilteredSeriesDomains,
      finalRawValueAxisDomains, finalFilteredValueAxisDomains);
  }

  const hasDomainDelta = hasAnyDomainDelta(rawSet, filteredSet);
  if (hasDomainDelta) {
    endSeriesData = getSeriesDataWithAllDomains(endSeriesData, endRawValueAxisDomains, endFilteredValueAxisDomains, endRawSeriesDomains, endFilteredSeriesDomains);
    finalSeriesData = getSeriesDataWithAllDomains(finalSeriesData, finalRawValueAxisDomains, finalFilteredValueAxisDomains, finalRawSeriesDomains, finalFilteredSeriesDomains);
    finalSeriesData = getSeriesDataWithSeriesBases(finalSeriesData, finalSeriesBases);
  }

  if (categoryAxisDomainDelta.deltaPercentage !== 0 || hasDomainDelta) {
    finalChartData = getChartDataWithData(prevChartData, finalCategoryData, finalSeriesData);
    endChartData = getChartDataWithData(prevChartData, endCategoryData, endSeriesData);
  }

  let startChartData = getChartDataWithRenderAxisDomains(prevChartData, startCategoryAxisDomain, rawSet.startValueAxisDomains, filteredSet.startValueAxisDomains);
  startChartData = getChartDataWithSeriesData(startChartData, getSeriesDataWithDomains(startChartData.seriesData, rawSet.startSeriesDomains, filteredSet.startSeriesDomains));

  adjustFilteredAxisDomainDeltas(valueAxisConfigs, rawSet.valueAxisDomainDeltas, filteredSet.valueAxisDomainDeltas);

  // series hidden at the start of the expansion render nothing during it, so they must not stretch its duration
  const rawSeriesPacingDeltaPercentage = getVisibleSeriesPacingDeltaPercentage(rawSet.seriesDomainDeltas, prevChartData.seriesData.filtered.values);
  const filteredSeriesPacingDeltaPercentage = getVisibleSeriesPacingDeltaPercentage(filteredSet.seriesDomainDeltas, prevChartData.seriesData.filtered.values);

  return createAxisDeltaData(startChartData, endChartData, finalChartData, categoryAxisDomainDelta, rawSet.valueAxisDomainDeltas,
    filteredSet.valueAxisDomainDeltas, rawSet.seriesDomainDeltas, filteredSet.seriesDomainDeltas, rawSeriesPacingDeltaPercentage, filteredSeriesPacingDeltaPercentage, categoryValueDeltaData);
}

export function getTransitionAxisContractionData(mochartConfig: EnhancedMochartConfig, prevChartData: ChartData, newChartData: ChartData, categoryDeltaData: CategoryDeltaData): AxisDeltaData {
  let startCategoryData = newChartData.categoryData;
  let endCategoryData = newChartData.categoryData;

  let categoryValueDeltaData: CompleteNumericArrayDelta | null = null;

  const startCategoryAxisDomain = copyDomain(prevChartData.categoryData.renderAxisDomain);
  const endCategoryAxisDomain = copyDomain(newChartData.categoryData.renderAxisDomain);
  setBaseDomainForChanges(startCategoryAxisDomain, endCategoryAxisDomain);

  const { categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs, series: seriesConfigs } = mochartConfig;

  const categoryAxisDomainDelta = getCategoryAxisDomainDelta(endCategoryAxisDomain, startCategoryAxisDomain);
  if (categoryAxisDomainDelta.deltaPercentage !== 0) {
    categoryValueDeltaData = getContractionCategoryValueDeltaData(categoryAxisConfig, categoryDeltaData, prevChartData, newChartData, startCategoryAxisDomain);

    startCategoryData = getCategoryDataWithRenderAxisDomain(startCategoryData, startCategoryAxisDomain);
    endCategoryData = getCategoryDataWithRenderAxisDomain(endCategoryData, endCategoryAxisDomain);

    // the ordinal slide starts from the merged slots, so the start frame must sit there too
    if (categoryValueDeltaData !== null) {
      startCategoryData = getCategoryDataWithNumericValues(startCategoryData, categoryValueDeltaData.start);
    }
  }

  let startSeriesData = newChartData.seriesData;
  let endSeriesData = newChartData.seriesData;

  const rawSet = getDomainDeltaSet(seriesConfigs, prevChartData.seriesData.raw, newChartData.seriesData.raw, true, []);
  const filteredSet = getDomainDeltaSet(seriesConfigs, prevChartData.seriesData.filtered, newChartData.seriesData.filtered, true, []);

  if (hasAnyDomainDelta(rawSet, filteredSet)) {
    startSeriesData = getSeriesDataWithAllDomains(startSeriesData, rawSet.startValueAxisDomains, filteredSet.startValueAxisDomains, rawSet.startSeriesDomains, filteredSet.startSeriesDomains);
    endSeriesData = getSeriesDataWithAllDomains(endSeriesData, rawSet.endValueAxisDomains, filteredSet.endValueAxisDomains, rawSet.endSeriesDomains, filteredSet.endSeriesDomains);
  }

  const startChartData = getChartDataWithData(newChartData, startCategoryData, startSeriesData);
  const endChartData = getChartDataWithData(newChartData, endCategoryData, endSeriesData);

  adjustFilteredAxisDomainDeltas(valueAxisConfigs, rawSet.valueAxisDomainDeltas, filteredSet.valueAxisDomainDeltas);

  // series hidden at the end of the contraction render nothing during it, so they must not stretch its duration
  const rawSeriesPacingDeltaPercentage = getVisibleSeriesPacingDeltaPercentage(rawSet.seriesDomainDeltas, newChartData.seriesData.filtered.values);
  const filteredSeriesPacingDeltaPercentage = getVisibleSeriesPacingDeltaPercentage(filteredSet.seriesDomainDeltas, newChartData.seriesData.filtered.values);

  return invertAxisDeltas(createAxisDeltaData(startChartData, endChartData, newChartData, categoryAxisDomainDelta,
    rawSet.valueAxisDomainDeltas, filteredSet.valueAxisDomainDeltas, rawSet.seriesDomainDeltas, filteredSet.seriesDomainDeltas, rawSeriesPacingDeltaPercentage, filteredSeriesPacingDeltaPercentage, categoryValueDeltaData));
}

// one raw-or-filtered slice of the expansion/contraction pipeline: copied, base-filled start (prev) and end (new) domains plus the deltas measured from one side to the other
interface DomainDeltaSet {
  startValueAxisDomains: AxisDomains;
  endValueAxisDomains: AxisDomains;
  valueAxisDomainDeltas: DomainDeltaMap;
  startSeriesDomains: SeriesDomainObjects;
  endSeriesDomains: SeriesDomainObjects;
  seriesDomainDeltas: SeriesDomainDeltaMap;
}

function getDomainDeltaSet(seriesConfigs: EnhancedSeriesConfig[], prevDataSet: SeriesDataSet, newDataSet: SeriesDataSet, fromEnd: boolean, combinedAxisIds: string[]): DomainDeltaSet {
  const startValueAxisDomains = copyValueAxisDomains(prevDataSet.renderAxisDomains);
  const endValueAxisDomains = copyValueAxisDomains(newDataSet.renderAxisDomains);
  setAllBaseAxisDomainsForChanges(startValueAxisDomains, endValueAxisDomains);
  resetAxisDomainsForIds(endValueAxisDomains, startValueAxisDomains, combinedAxisIds);

  const startSeriesDomains = copySeriesDomains(prevDataSet.domains);
  const endSeriesDomains = copySeriesDomains(newDataSet.domains);
  setAllBaseSeriesDomainsForChanges(startSeriesDomains, endSeriesDomains);
  // series on combined-domain axes sit out the union with their axis
  resetSeriesDomainsForAxes(endSeriesDomains, startSeriesDomains, seriesConfigs, combinedAxisIds);

  const fromValueAxisDomains = fromEnd ? endValueAxisDomains : startValueAxisDomains;
  const toValueAxisDomains = fromEnd ? startValueAxisDomains : endValueAxisDomains;
  const fromSeriesDomains = fromEnd ? endSeriesDomains : startSeriesDomains;
  const toSeriesDomains = fromEnd ? startSeriesDomains : endSeriesDomains;
  const valueAxisExtents = getDomainExtents(fromValueAxisDomains);

  return {
    startValueAxisDomains, endValueAxisDomains,
    valueAxisDomainDeltas: getValueAxisDomainDeltas(fromValueAxisDomains, toValueAxisDomains, valueAxisExtents),
    startSeriesDomains, endSeriesDomains,
    seriesDomainDeltas: getSeriesDomainDeltas(seriesConfigs, fromSeriesDomains, toSeriesDomains, valueAxisExtents)
  };
}

function hasAnyDomainDelta(rawSet: DomainDeltaSet, filteredSet: DomainDeltaSet): boolean {
  return rawSet.valueAxisDomainDeltas.deltaPercentage !== 0 || filteredSet.valueAxisDomainDeltas.deltaPercentage !== 0 ||
    rawSet.seriesDomainDeltas.deltaPercentage !== 0 || filteredSet.seriesDomainDeltas.deltaPercentage !== 0;
}

function getSeriesDataWithAllDomains(seriesData: SeriesData, rawValueAxisDomains: AxisDomains, filteredValueAxisDomains: AxisDomains, rawSeriesDomains: SeriesDomainObjects, filteredSeriesDomains: SeriesDomainObjects): SeriesData {
  return getSeriesDataWithDomains(getSeriesDataWithRenderAxisDomains(seriesData, rawValueAxisDomains, filteredValueAxisDomains), rawSeriesDomains, filteredSeriesDomains);
}

// pacing max over visible series only; the map keeps every entry so end/final domain bookkeeping still covers hidden series
function getVisibleSeriesPacingDeltaPercentage(seriesDomainDeltas: SeriesDomainDeltaMap, filteredSeriesValues: SeriesValueObjects): number {
  if (seriesDomainDeltas.deltas === null) {
    return 0;
  }
  let pacingDeltaPercentage = 0;
  const seriesIds = Object.keys(seriesDomainDeltas.deltas);
  for (const seriesId of seriesIds) {
    if (filteredSeriesValues[seriesId].plain !== null) {
      pacingDeltaPercentage = Math.max(pacingDeltaPercentage, seriesDomainDeltas.deltas[seriesId].deltaPercentage);
    }
  }
  return pacingDeltaPercentage;
}

function adjustFilteredAxisDomainDeltas(valueAxisConfigs: EnhancedValueAxisConfig[], rawValueAxisDomainDeltas: DomainDeltaMap, filteredValueAxisDomainDeltas: DomainDeltaMap): void {
  if (filteredValueAxisDomainDeltas.deltaPercentage !== 0) {
    const { deltas: rawDeltas } = rawValueAxisDomainDeltas;
    const { deltas: filteredDeltas } = filteredValueAxisDomainDeltas;

    let newDeltaPercentage = 0;
    let filteredDeltaPercentage;

    for (const axisConfig of valueAxisConfigs) {
      filteredDeltaPercentage = filteredDeltas![axisConfig.id]!.deltaPercentage;
      if (filteredDeltaPercentage !== 0 && !axisConfig.adjustForFiltering) {
        filteredDeltaPercentage = filteredDeltas![axisConfig.id]!.deltaPercentage = rawDeltas !== null ? rawDeltas[axisConfig.id]!.deltaPercentage : 0;
      }
      newDeltaPercentage = Math.max(newDeltaPercentage, filteredDeltaPercentage);
    }
    filteredValueAxisDomainDeltas.deltaPercentage = newDeltaPercentage;
  }
}

// getAxisDeltaData functions
function getValueAxisDomainDeltas(fromValueAxisDomains: AxisDomains, toValueAxisDomains: AxisDomains, fromValueAxisDomainExtents: Record<string, number>): DomainDeltaMap {
  let deltaPercentage = 0;
  const deltas: Record<string, DomainDelta> = Object.create(null);

  let axisDelta, axisDeltaPercentage;
  const valueAxisIds = Object.keys(fromValueAxisDomains);
  for (const id of valueAxisIds) {
    axisDelta = getPositiveDomainDelta(fromValueAxisDomains[id], toValueAxisDomains[id]);
    axisDeltaPercentage = getPositiveDomainDeltaPercentage(axisDelta, fromValueAxisDomainExtents[id]);
    deltaPercentage = Math.max(deltaPercentage, axisDeltaPercentage);
    deltas[id] = {
      deltaPercentage: axisDeltaPercentage,
      delta: axisDelta
    };
  }
  return deltaPercentage === 0 ? emptyValueAxisDomainDelta() : {
    deltaPercentage,
    deltas
  };
}

function getCategoryAxisDomainDelta(fromCategoryAxisDomain: CategoryAxisDomain, toCategoryAxisDomain: CategoryAxisDomain): DomainDelta {
  const delta: NumericDomain = [0, 0];

  const getValue = (categoryValue: CategoryAxisDomain[number]): number => categoryValue === null ? 0 : categoryValue instanceof Date ? categoryValue.getTime() : categoryValue;

  if (getValue(toCategoryAxisDomain[0]) < getValue(fromCategoryAxisDomain[0])) {
    delta[0] = getValue(toCategoryAxisDomain[0]) - getValue(fromCategoryAxisDomain[0]);
  }
  if (getValue(toCategoryAxisDomain[1]) > getValue(fromCategoryAxisDomain[1])) {
    delta[1] = getValue(toCategoryAxisDomain[1]) - getValue(fromCategoryAxisDomain[1]);
  }

  const deltaPercentage = getPositiveDomainDeltaPercentage(delta, getDomainExtentWithValueGetter(fromCategoryAxisDomain, getValue));

  return deltaPercentage === 0 ? emptyCategoryAxisDomainDelta() : {
    deltaPercentage,
    delta
  }
}

function getSeriesDomainDeltas(seriesConfigs: EnhancedSeriesConfig[], fromDomainObjects: SeriesDomainObjects, toDomainObjects: SeriesDomainObjects, fromAxisExtents: Record<string, number>): SeriesDomainDeltaMap {
  let deltaPercentage = 0;
  const deltas: Record<string, SeriesDomainDelta> = Object.create(null);
  let domainDelta;
  for (const seriesConfig of seriesConfigs) {
    const { id } = seriesConfig;
    domainDelta = getSeriesDomainDelta(fromDomainObjects[id]!, toDomainObjects[id]!, fromAxisExtents[seriesConfig.axis!]!);
    deltaPercentage = Math.max(deltaPercentage, domainDelta.deltaPercentage);
    deltas[id] = domainDelta;
  }
  return deltaPercentage === 0 ? emptySeriesDomainDelta : {
    deltaPercentage,
    deltas
  };
}

function getSeriesDomainDelta(fromDomainObject: SeriesDomainObject, toDomainObject: SeriesDomainObject, fromAxisExtent: number): SeriesDomainDelta {
  const newDomainObject = {} as SeriesDomainDelta;
  let deltaPercentage = 0;
  let key, domainDelta, domainDeltaPercentage;
  const length = domainKeys.length;
  for (let i=0; i<length; i++) {
    key = domainKeys[i];
    domainDelta = getPositiveDomainDelta(fromDomainObject[key], toDomainObject[key]);
    domainDeltaPercentage = getPositiveDomainDeltaPercentage(domainDelta, fromAxisExtent);
    deltaPercentage = Math.max(deltaPercentage, domainDeltaPercentage);
    newDomainObject[key] ={
      deltaPercentage: domainDeltaPercentage,
      delta: domainDelta
    };
  }
  newDomainObject.deltaPercentage = deltaPercentage;
  return newDomainObject;
}

function createAxisDeltaData(startChartData: ChartData, endChartData: ChartData, finalChartData: ChartData, categoryAxisDomainDelta: DomainDelta, rawValueAxisDomainDeltas: DomainDeltaMap,
                             filteredValueAxisDomainDeltas: DomainDeltaMap, rawSeriesDomainDeltas: SeriesDomainDeltaMap, filteredSeriesDomainDeltas: SeriesDomainDeltaMap,
                             rawSeriesPacingDeltaPercentage: number, filteredSeriesPacingDeltaPercentage: number, categoryValueDeltaData: CompleteNumericArrayDelta | null): AxisDeltaData {
  const deltaPercentage = Math.max(categoryAxisDomainDelta.deltaPercentage, rawValueAxisDomainDeltas.deltaPercentage,
    filteredValueAxisDomainDeltas.deltaPercentage, rawSeriesPacingDeltaPercentage, filteredSeriesPacingDeltaPercentage,
    categoryValueDeltaData ? categoryValueDeltaData.deltaPercentage : 0);
  setDeltaFactor(categoryAxisDomainDelta, deltaPercentage);
  setCategoryValueDeltaFactor(categoryValueDeltaData, deltaPercentage);
  setAxisDeltaFactors(rawValueAxisDomainDeltas, deltaPercentage);
  setAxisDeltaFactors(filteredValueAxisDomainDeltas, deltaPercentage);
  setDomainDeltaFactors(rawSeriesDomainDeltas, deltaPercentage);
  setDomainDeltaFactors(filteredSeriesDomainDeltas, deltaPercentage);

  return {
    start: startChartData,
    deltaPercentage,
    deltas: {
      domain: {
        axis: {
          category: categoryAxisDomainDelta,
          value: {
            raw: rawValueAxisDomainDeltas,
            filtered: filteredValueAxisDomainDeltas
          }
        },
        series: {
          raw: rawSeriesDomainDeltas,
          filtered: filteredSeriesDomainDeltas
        }
      },
      values: {
        category: categoryValueDeltaData
      }
    },
    end: endChartData,
    final: finalChartData
  };
}

export function setDeltaFactor(deltaObject: { deltaPercentage: number; deltaFactor?: number }, deltaPercentage: number): void {
  if (deltaObject.deltaPercentage === 0) {
    deltaObject.deltaFactor = 0;
  }
  else {
    deltaObject.deltaFactor = deltaPercentage / deltaObject.deltaPercentage;
  }
}

function setCategoryValueDeltaFactor(deltaObject: CompleteNumericArrayDelta | null, deltaPercentage: number): void {
  if (deltaObject) {
    setDeltaFactor(deltaObject, deltaPercentage);
  }
}

export function setAxisDeltaFactors(axisDeltaObjectHolder: DomainDeltaMap, deltaPercentage: number): void {
  if (axisDeltaObjectHolder.deltas !== null) {
    const axisDeltaObjects = axisDeltaObjectHolder.deltas;
    const axisIds = Object.keys(axisDeltaObjects);
    for (const axisId of axisIds) {
      setDeltaFactor(axisDeltaObjects[axisId], deltaPercentage);
    }
  }
}

function setDomainDeltaFactors(domainDeltaObjectHolder: SeriesDomainDeltaMap, deltaPercentage: number): void {
  if (domainDeltaObjectHolder.deltas !== null) {
    const domainDeltaObjects = domainDeltaObjectHolder.deltas;
    const seriesIds = Object.keys(domainDeltaObjects);
    for (const seriesId of seriesIds) {
      setDomainDeltaFactor(domainDeltaObjects[seriesId], deltaPercentage);
    }
  }
}

function setDomainDeltaFactor(domainDeltaObject: SeriesDomainDelta, deltaPercentage: number): void {
  setDeltaFactor(domainDeltaObject, deltaPercentage);
  for (const key of domainKeys) {
    setDeltaFactor(domainDeltaObject[key], deltaPercentage);
  }
}

function invertAxisDeltas(axisDeltaData: AxisDeltaData): AxisDeltaData {
  if (axisDeltaData.deltas.domain.axis.category.delta !== null) {
    invertDomainDeltas(axisDeltaData.deltas.domain.axis.category.delta);
  }
  const rawValueAxisDeltas = axisDeltaData.deltas.domain.axis.value.raw.deltas;
  if (rawValueAxisDeltas !== null) {
    const axisIds = Object.keys(rawValueAxisDeltas);
    for (const axisId of axisIds) {
      invertDomainDeltas(rawValueAxisDeltas[axisId].delta!);
    }
  }
  const filteredValueAxisDeltas = axisDeltaData.deltas.domain.axis.value.filtered.deltas;
  if (filteredValueAxisDeltas !== null) {
    const axisIds = Object.keys(filteredValueAxisDeltas);
    for (const axisId of axisIds) {
      invertDomainDeltas(filteredValueAxisDeltas[axisId].delta!);
    }
  }
  const rawSeriesDomainDeltas = axisDeltaData.deltas.domain.series.raw.deltas;
  if (rawSeriesDomainDeltas !== null) {
    invertSeriesDomainDeltas(rawSeriesDomainDeltas);
  }
  const filteredSeriesDomainDeltas = axisDeltaData.deltas.domain.series.filtered.deltas;
  if (filteredSeriesDomainDeltas !== null) {
    invertSeriesDomainDeltas(filteredSeriesDomainDeltas);
  }
  return axisDeltaData;
}

function invertSeriesDomainDeltas(seriesDomainDeltas: Record<string, SeriesDomainDelta>): void {
  const seriesIds = Object.keys(seriesDomainDeltas);
  for (const seriesId of seriesIds) {
    invertSeriesDomainDeltaObject(seriesDomainDeltas[seriesId]);
  }
}

function invertSeriesDomainDeltaObject(seriesDomainDeltaObject: SeriesDomainDelta): void {
  for (const key of domainKeys) {
    invertDomainDeltas(seriesDomainDeltaObject[key].delta!);
  }
}

function invertDomainDeltas(domainDelta: NumericDomain): void {
  domainDelta[0] = domainDelta[0] === 0 ? 0 : -1 * domainDelta[0];
  domainDelta[1] = domainDelta[1] === 0 ? 0 : -1 * domainDelta[1];
}

function setAllBaseAxisDomainsForChanges(startAxisDomains: AxisDomains, endAxisDomains: AxisDomains): void {
  const axisIds = Object.keys(startAxisDomains);
  for (const axisId of axisIds) {
    setBaseDomainForChanges(startAxisDomains[axisId], endAxisDomains[axisId]);
  }
}

function setBaseDomainForChanges<T extends number | Date>(startAxisDomain: NullableDomain<T>, endAxisDomain: NullableDomain<T>): void {
  if (startAxisDomain[0] === null) {
    if (endAxisDomain[0] !== null) {
      startAxisDomain[0] = startAxisDomain[1] = endAxisDomain[0];
    }
  }
  else if (endAxisDomain[0] === null) {
    endAxisDomain[0] = endAxisDomain[1] = startAxisDomain[0];
  }
}

function setAllBaseSeriesDomainsForChanges(startDomainObjects: SeriesDomainObjects, endDomainObjects: SeriesDomainObjects): void {
  const seriesIds = Object.keys(startDomainObjects);
  for (const seriesId of seriesIds) {
    setBaseSeriesDomainForChanges(startDomainObjects[seriesId], endDomainObjects[seriesId]);
  }
}

function setBaseSeriesDomainForChanges(startDomainObject: SeriesDomainObject, endDomainObject: SeriesDomainObject): void {
  for (const key of domainKeys) {
    setBaseKeyedSeriesDomainForChanges(startDomainObject, endDomainObject, key);
  }
}

function setBaseKeyedSeriesDomainForChanges(startDomainObject: SeriesDomainObject, endDomainObject: SeriesDomainObject, valueKey: string): void {
  setBaseDomainForChanges(startDomainObject[valueKey], endDomainObject[valueKey]);
}
