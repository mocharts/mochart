import { getChartDataWithData, getChartDataWithCategoryData, getChartDataWithValues, getChartDataWithSeriesDomains, getChartDataWithRenderAxisDomains, getChartDataWithSeriesData } from '../data/ChartData';

import { getCategoryDataWithNumericValues, getCategoryDataWithRenderAxisDomain } from '../data/CategoryData';

import { getSeriesDataWithSeriesValues, getSeriesDataWithRenderAxisDomains } from '../data/SeriesData';

import { domainKeys, positionOrComputedKeys, extraAndCopyKeys } from '../data/constants';

import { TYPE_DATE, SCALE_LINEAR } from '../config/core/constants';

import { enhanceValueObjects } from './SeriesAnimationData';

import type { CategoryAxisConfig } from '../types/config';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { DomainKey, ExtraCopyKey, ExtraKey, PositionOrComputedKey } from '../data/constants';
import type { SeriesValueObjects as DataSeriesValueObjects } from '../types/data';
import type {
  AnimationChartData,
  AxisDeltaData,
  AxisDomain,
  AxisDomains,
  ChartAnimationData,
  DomainDelta,
  DomainDeltaMap,
  NumericArrayDelta,
  NumericDomain,
  NumericValues,
  NumericValuesDelta,
  SeriesDomainDelta,
  SeriesDomainDeltaMap,
  SeriesDomainObject,
  SeriesDomainObjects,
  SeriesValueDelta,
  SeriesValueDeltaMap,
  SeriesValueObject,
  SeriesValueObjects
} from '../types/animation';

function requireAxisDeltaData(axisDeltaData: ChartAnimationData['axisExpansionData']): AxisDeltaData {
  if (axisDeltaData.start === null || axisDeltaData.end === null || axisDeltaData.deltas === null) {
    throw new Error('Cannot interpolate an empty axis transition');
  }
  return axisDeltaData as AxisDeltaData;
}

// getChartData for delta percentage functions
export function getChartDataForAxisDelta(
  mochartConfig: EnhancedMochartConfig,
  chartAnimationData: ChartAnimationData,
  expand: boolean,
  percentage: number
): AnimationChartData {
  const axisDeltaData = requireAxisDeltaData(expand ? chartAnimationData.axisExpansionData : chartAnimationData.axisContractionData);
  if (percentage === 0) {
    return axisDeltaData.start;
  }
  else if (percentage === 1) {
    return axisDeltaData.end;
  }
  else {
    const deltaPercentage = axisDeltaData.deltaPercentage * percentage;
    const categoryAxisDomain = getCategoryAxisDomainForDelta(mochartConfig.categoryAxis, axisDeltaData.start.categoryData.renderAxisDomain as AxisDomain, axisDeltaData.end.categoryData.renderAxisDomain as AxisDomain,
      axisDeltaData.deltas.domain.axis.category, deltaPercentage, percentage);
    const rawValueAxisDomains = getAxisDomainsForDeltas(axisDeltaData.start.seriesData.raw.renderAxisDomains, axisDeltaData.end.seriesData.raw.renderAxisDomains,
      axisDeltaData.deltas.domain.axis.value.raw, deltaPercentage, percentage);
    const filteredValueAxisDomains = getAxisDomainsForDeltas(axisDeltaData.start.seriesData.filtered.renderAxisDomains, axisDeltaData.end.seriesData.filtered.renderAxisDomains,
      axisDeltaData.deltas.domain.axis.value.filtered, deltaPercentage, percentage);
    const numericCategoryValues = getNumericCategoryValuesForDelta(axisDeltaData, deltaPercentage, percentage);
    const rawSeriesDomains = getSeriesDomainsForDeltas(axisDeltaData.start.seriesData.raw.domains, axisDeltaData.end.seriesData.raw.domains,
      axisDeltaData.deltas.domain.series.raw, deltaPercentage, percentage);
    const filteredSeriesDomains = getSeriesDomainsForDeltas(axisDeltaData.start.seriesData.filtered.domains, axisDeltaData.end.seriesData.filtered.domains,
      axisDeltaData.deltas.domain.series.filtered, deltaPercentage, percentage);
    let chartData: AnimationChartData = getChartDataWithRenderAxisDomains(axisDeltaData.start, categoryAxisDomain, rawValueAxisDomains, filteredValueAxisDomains);
    chartData = getChartDataWithSeriesDomains(chartData, rawSeriesDomains, filteredSeriesDomains);
    if (numericCategoryValues !== null) {
      chartData = getChartDataWithCategoryData(chartData, getCategoryDataWithNumericValues(chartData.categoryData, numericCategoryValues));
    }
    return chartData;
  }
}

function getNumericCategoryValuesForDelta(axisDeltaData: AxisDeltaData, deltaPercentage: number, percentage: number): number[] | null {
  const categoryValueDeltaData = axisDeltaData.deltas.values.category;
  if (categoryValueDeltaData !== null) {
    if (categoryValueDeltaData.deltaPercentage >= deltaPercentage) {
      const deltaFactorPercentage = categoryValueDeltaData.deltaFactor! * percentage;
      const startCategoryValues = categoryValueDeltaData.start;
      const categoryValueDeltas = categoryValueDeltaData.deltas;
      const categoryValues: number[] = [];
      const count = startCategoryValues.length;
      for (let i=0; i<count; i++) {
        categoryValues.push(startCategoryValues[i] + deltaFactorPercentage * categoryValueDeltas[i]);
      }
      return categoryValues;
    }
    else {
      return categoryValueDeltaData.end;
    }
  }
  else {
    return null;
  }
}

function getCategoryAxisDomainForDelta(
  categoryAxisConfig: CategoryAxisConfig,
  startAxisDomain: AxisDomain,
  endAxisDomain: AxisDomain,
  axisDelta: DomainDelta,
  deltaPercentage: number,
  percentage: number
): AxisDomain {
  if (categoryAxisConfig.type === TYPE_DATE && categoryAxisConfig.scale === SCALE_LINEAR) {
    if (axisDelta.deltaPercentage < deltaPercentage) {
      return endAxisDomain;
    }
    else {
      const startDateDomain = startAxisDomain as [Date, Date];
      const axisDomainDelta = axisDelta.delta;
      if (axisDomainDelta === null) {
        return endAxisDomain;
      }
      const deltaFactorPercentage = axisDelta.deltaFactor! * percentage;
      return [
        new Date(startDateDomain[0].getTime() + axisDomainDelta[0] * deltaFactorPercentage),
        new Date(startDateDomain[1].getTime() + axisDomainDelta[1] * deltaFactorPercentage)
      ]
    }
  }
  else {
    return getDomainForDelta(startAxisDomain as NumericDomain, endAxisDomain as NumericDomain, axisDelta, deltaPercentage, percentage);
  }
}

function getDomainForDelta(startDomain: NumericDomain, endDomain: NumericDomain, domainDelta: DomainDelta, deltaPercentage: number, percentage: number): NumericDomain {
  if (domainDelta.deltaPercentage < deltaPercentage) {
    return endDomain;
  }
  else {
    if (domainDelta.delta === null) {
      return endDomain;
    }
    const deltaFactorPercentage = domainDelta.deltaFactor! * percentage;
    return [
      startDomain[0] + domainDelta.delta[0] * deltaFactorPercentage,
      startDomain[1] + domainDelta.delta[1] * deltaFactorPercentage
    ]
  }
}

function getAxisDomainsForDeltas(
  startAxisDomains: AxisDomains,
  endAxisDomains: AxisDomains,
  axisDeltaObject: DomainDeltaMap,
  deltaPercentage: number,
  percentage: number
): AxisDomains {
  if (axisDeltaObject.deltaPercentage < deltaPercentage) {
    return endAxisDomains;
  }
  else {
    const axisDomains: AxisDomains = Object.create(null);
    const deltas = axisDeltaObject.deltas;
    if (deltas === null) {
      return endAxisDomains;
    }
    const axisIds = Object.keys(startAxisDomains);
    for (const axisId of axisIds) {
      axisDomains[axisId] = getDomainForDelta(startAxisDomains[axisId] as NumericDomain, endAxisDomains[axisId] as NumericDomain, deltas[axisId], deltaPercentage, percentage);
    }
    return axisDomains;
  }
}

function getSeriesDomainsForDeltas(
  startSeriesDomains: SeriesDomainObjects,
  endSeriesDomains: SeriesDomainObjects,
  domainDeltaObject: SeriesDomainDeltaMap,
  deltaPercentage: number,
  percentage: number
): SeriesDomainObjects {
  if (domainDeltaObject.deltaPercentage < deltaPercentage) {
    return endSeriesDomains;
  }
  else {
    const seriesDomains: SeriesDomainObjects = Object.create(null);
    const deltas = domainDeltaObject.deltas;
    if (deltas === null) {
      return endSeriesDomains;
    }
    const seriesIds = Object.keys(startSeriesDomains);
    for (const seriesId of seriesIds) {
      seriesDomains[seriesId] = getSeriesDomainForDelta(startSeriesDomains[seriesId], endSeriesDomains[seriesId], deltas[seriesId], deltaPercentage, percentage);
    }
    return seriesDomains;
  }
}

function getSeriesDomainForDelta(
  startSeriesDomainObject: SeriesDomainObject,
  endSeriesDomainObject: SeriesDomainObject,
  domainDelta: SeriesDomainDelta,
  deltaPercentage: number,
  percentage: number
): SeriesDomainObject {
  if (domainDelta.deltaPercentage < deltaPercentage) {
    return endSeriesDomainObject;
  }
  else {
    const seriesDomainObject: SeriesDomainObject = {};
    for (const key of domainKeys) {
      setKeyedSeriesDomainForDelta(seriesDomainObject, key, startSeriesDomainObject, endSeriesDomainObject, domainDelta, deltaPercentage, percentage);
    }
    return seriesDomainObject;
  }
}

function setKeyedSeriesDomainForDelta(
  seriesDomainObject: SeriesDomainObject,
  valueKey: DomainKey,
  startSeriesDomainObject: SeriesDomainObject,
  endSeriesDomainObject: SeriesDomainObject,
  domainDelta: SeriesDomainDelta,
  deltaPercentage: number,
  percentage: number
): void {
  seriesDomainObject[valueKey] = getDomainForDelta(startSeriesDomainObject[valueKey] as NumericDomain, endSeriesDomainObject[valueKey] as NumericDomain, domainDelta[valueKey], deltaPercentage, percentage)
}

export function getChartDataForValueDelta(
  mochartConfig: EnhancedMochartConfig,
  chartAnimationData: ChartAnimationData,
  percentage: number
): AnimationChartData {
  const valueDeltaData = chartAnimationData.valueChangeData;
  if (percentage === 0) {
    return valueDeltaData.start;
  }
  else if (percentage === 1) {
    return valueDeltaData.end;
  }
  else {
    const deltaPercentage = valueDeltaData.deltaPercentage * percentage;
    const rawValues = getValueObjectsForDelta(valueDeltaData.start.seriesData.raw.values as unknown as SeriesValueObjects, valueDeltaData.end.seriesData.raw.values as unknown as SeriesValueObjects, valueDeltaData.deltas.raw, deltaPercentage, percentage);
    const filteredValues = getFilteredValueObjectsForDelta(valueDeltaData.start.seriesData.filtered.values as unknown as SeriesValueObjects, valueDeltaData.end.seriesData.filtered.values as unknown as SeriesValueObjects, valueDeltaData.deltas.filtered, rawValues, deltaPercentage, percentage);
    
    enhanceValueObjects(rawValues);
    enhanceValueObjects(filteredValues);

    let chartData: AnimationChartData;
    if (valueDeltaData.deltas.categoryOrder.deltaPercentage !== 0) {
      chartData = getChartDataWithData(valueDeltaData.start,
        getCategoryDataWithNumericValues(valueDeltaData.start.categoryData, getCategoryNumericValuesForDelta(valueDeltaData.deltas.categoryOrder, deltaPercentage, percentage)),
        getSeriesDataWithSeriesValues(valueDeltaData.start.seriesData, rawValues as unknown as DataSeriesValueObjects, filteredValues as unknown as DataSeriesValueObjects));
    }
    else {
      chartData = getChartDataWithValues(valueDeltaData.start, rawValues as unknown as DataSeriesValueObjects, filteredValues as unknown as DataSeriesValueObjects);
    }
    // combined-domain axes: the render domain moves with the values instead of via the union phases
    const domainDeltas = valueDeltaData.deltas.domain;
    if (domainDeltas.raw.deltaPercentage !== 0 || domainDeltas.filtered.deltaPercentage !== 0) {
      const rawRenderAxisDomains = getAxisDomainsForDeltas(valueDeltaData.start.seriesData.raw.renderAxisDomains,
        valueDeltaData.end.seriesData.raw.renderAxisDomains, domainDeltas.raw, deltaPercentage, percentage);
      const filteredRenderAxisDomains = getAxisDomainsForDeltas(valueDeltaData.start.seriesData.filtered.renderAxisDomains,
        valueDeltaData.end.seriesData.filtered.renderAxisDomains, domainDeltas.filtered, deltaPercentage, percentage);
      chartData = getChartDataWithSeriesData(chartData,
        getSeriesDataWithRenderAxisDomains(chartData.seriesData, rawRenderAxisDomains, filteredRenderAxisDomains));
    }
    // a combined-domain category axis (e.g. a sliding window) slides its render domain with the values too
    if (domainDeltas.category.deltaPercentage !== 0) {
      const categoryRenderAxisDomain = getCategoryAxisDomainForDelta(mochartConfig.categoryAxis,
        valueDeltaData.start.categoryData.renderAxisDomain as AxisDomain, valueDeltaData.end.categoryData.renderAxisDomain as AxisDomain,
        domainDeltas.category, deltaPercentage, percentage);
      chartData = getChartDataWithCategoryData(chartData,
        getCategoryDataWithRenderAxisDomain(chartData.categoryData, categoryRenderAxisDomain));
    }
    return chartData;
  }
}

function getCategoryNumericValuesForDelta(categoryOrderDeltaData: NumericArrayDelta, deltaPercentage: number, percentage: number): number[] {
  if (categoryOrderDeltaData.start === undefined || categoryOrderDeltaData.end === undefined) {
    throw new Error('Cannot interpolate an empty category-order transition');
  }
  if (categoryOrderDeltaData.deltaPercentage < deltaPercentage) {
    return categoryOrderDeltaData.end;
  }
  else {
    return getValuesForDelta(categoryOrderDeltaData.start, categoryOrderDeltaData.deltas, percentage * categoryOrderDeltaData.deltaFactor!);
  }
}

function getValueObjectsForDelta(
  startValueObjects: SeriesValueObjects,
  endValueObjects: SeriesValueObjects,
  valueDeltaObjectData: SeriesValueDeltaMap,
  deltaPercentage: number,
  percentage: number
): SeriesValueObjects {
  if (valueDeltaObjectData.deltaPercentage < deltaPercentage) {
    return endValueObjects;
  }
  else {
    const valueDeltaObjects = valueDeltaObjectData.deltas;
    const valueObjects: SeriesValueObjects = Object.create(null);
    const seriesIds = Object.keys(startValueObjects);
    for (const seriesId of seriesIds) {
      valueObjects[seriesId] = getValueObjectForDelta(startValueObjects[seriesId], endValueObjects[seriesId], valueDeltaObjects[seriesId], deltaPercentage, percentage);
    }
    return valueObjects;
  }
}

function getFilteredValueObjectsForDelta(
  startValueObjects: SeriesValueObjects,
  endValueObjects: SeriesValueObjects,
  valueDeltaObjectData: SeriesValueDeltaMap,
  rawValueObjects: SeriesValueObjects,
  deltaPercentage: number,
  percentage: number
): SeriesValueObjects {
  if (valueDeltaObjectData.deltaCopied === true) {
    return rawValueObjects;
  }
  else if (valueDeltaObjectData.deltaPercentage < deltaPercentage) {
    return endValueObjects;
  }
  else {
    const valueDeltaObjects = valueDeltaObjectData.deltas;
    const valueObjects: SeriesValueObjects = Object.create(null);
    const seriesIds = Object.keys(startValueObjects);
    for (const seriesId of seriesIds) {
      valueObjects[seriesId] = getFilteredValueObjectForDelta(startValueObjects[seriesId], endValueObjects[seriesId], valueDeltaObjects[seriesId], rawValueObjects[seriesId], deltaPercentage, percentage);
    }
    return valueObjects;
  }
}

function getValueObjectForDelta(
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  deltaPercentage: number,
  percentage: number
): SeriesValueObject {
  if (valueDeltaObject.deltaPercentage < deltaPercentage) {
    return endValueObject;
  }
  else {
    const valueObject = {} as SeriesValueObject;
    for (const key of positionOrComputedKeys) {
      setValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, key, deltaPercentage, percentage);
    }
    for (const { extraKey, copyKey } of extraAndCopyKeys) {
      setExtraValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, extraKey, copyKey, deltaPercentage, percentage);
    }
    return valueObject;
  }
}

function setExtraValueSeriesValuesForDelta(
  valueObject: SeriesValueObject,
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  valueKey: ExtraKey,
  valueCopyKey: ExtraCopyKey,
  deltaPercentage: number,
  percentage: number
): void {
  valueObject[valueCopyKey] = startValueObject[valueCopyKey];
  const copiedValueKey = valueObject[valueCopyKey];
  if (typeof copiedValueKey === 'string') {
    valueObject[valueKey] = valueObject[copiedValueKey] as NumericValues | null;
  }
  else {
    setValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, valueKey, deltaPercentage, percentage);
  }
}

function getFilteredValueObjectForDelta(
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  rawValueObject: SeriesValueObject,
  deltaPercentage: number,
  percentage: number
): SeriesValueObject {
  if (valueDeltaObject.deltaCopied === true) {
    return rawValueObject;
  }
  else if (valueDeltaObject.deltaPercentage < deltaPercentage) {
    return endValueObject;
  }
  else {
    const valueObject = {} as SeriesValueObject;
    for (const key of positionOrComputedKeys) {
      setFilteredValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, rawValueObject, key, deltaPercentage, percentage);
    }
    for (const { extraKey, copyKey } of extraAndCopyKeys) {
      setFilteredExtraValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, rawValueObject, extraKey, copyKey, deltaPercentage, percentage);
    }
    return valueObject;
  }
}

function setFilteredExtraValueSeriesValuesForDelta(
  valueObject: SeriesValueObject,
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  rawValueObject: SeriesValueObject,
  valueKey: ExtraKey,
  valueCopyKey: ExtraCopyKey,
  deltaPercentage: number,
  percentage: number
): void {
  valueObject[valueCopyKey] = startValueObject[valueCopyKey];
  const copiedValueKey = valueObject[valueCopyKey];
  if (typeof copiedValueKey === 'string') {
    valueObject[valueKey] = valueObject[copiedValueKey] as NumericValues | null;
  }
  else {
    setFilteredValueSeriesValuesForDelta(valueObject, startValueObject, endValueObject, valueDeltaObject, rawValueObject, valueKey, deltaPercentage, percentage);
  }
}

function setValueSeriesValuesForDelta(
  valueObject: SeriesValueObject,
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  valueKey: PositionOrComputedKey | ExtraKey,
  deltaPercentage: number,
  percentage: number
): void {
  const valueDelta = valueDeltaObject[valueKey] as NumericValuesDelta;
  if (valueDelta.deltas === null || valueDelta.deltaPercentage < deltaPercentage) {
    valueObject[valueKey] = endValueObject[valueKey];
  }
  else {
    valueObject[valueKey] = getValuesForDelta(
      startValueObject[valueKey] as NumericValues,
      valueDelta.deltas,
      valueDelta.deltaFactor! * percentage
    );
  }
}

function setFilteredValueSeriesValuesForDelta(
  valueObject: SeriesValueObject,
  startValueObject: SeriesValueObject,
  endValueObject: SeriesValueObject,
  valueDeltaObject: SeriesValueDelta,
  rawValueObject: SeriesValueObject,
  valueKey: PositionOrComputedKey | ExtraKey,
  deltaPercentage: number,
  percentage: number
): void {
  const valueDelta = valueDeltaObject[valueKey] as NumericValuesDelta;
  if (valueDelta.deltaCopied === true) {
    valueObject[valueKey] = rawValueObject[valueKey];
  }
  else if (valueDelta.deltas === null || valueDelta.deltaPercentage < deltaPercentage) {
    valueObject[valueKey] = endValueObject[valueKey];
  }
  else {
    valueObject[valueKey] = getValuesForDelta(
      startValueObject[valueKey] as NumericValues,
      valueDelta.deltas,
      valueDelta.deltaFactor! * percentage
    );
  }
}

function getValuesForDelta(startValues: number[], valueDeltas: number[], percentage: number): number[];
function getValuesForDelta(startValues: NumericValues, valueDeltas: number[], percentage: number): NumericValues;
function getValuesForDelta(startValues: NumericValues, valueDeltas: number[], percentage: number): NumericValues {
  const values = startValues.slice();
  const count = startValues.length;
  for (let i=0; i<count; i++) {
    if (valueDeltas[i] !== 0) {
      values[i] = values[i]! + valueDeltas[i] * percentage;
    }
  }
  return values;
}
