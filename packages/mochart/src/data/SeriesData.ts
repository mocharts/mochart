import { nullDomain, getDomainForValues, mergeDomain } from './DomainData.js';
import { getAxisDomain, getRenderAxisDomain } from './AxisDomainData.js';
import { readNumericValues } from './PropertyData.js';
import { AUTO, NONE, RENDERER_AREA, RENDERER_BAR, SCALE_LOG } from '../config/core/constants.js';

import { keyPlain, keyPrior, valueKeys, positionKeys, positionOrComputedKeys, extraKeys, extraCopyKeys } from './constants.js';

import { createArrayFilledWithZero, arrayToMap, mapMap, idAccessor, isMissingValue, MISSING_VALUE } from '../utils/utils.js';
import type { DataProvider, CategoryData, CategoryValue, NullableDomain, NumericValues, SeriesData, SeriesDataSet, SeriesDomainObject, SeriesDomainObjects, SeriesValueObject, SeriesValueObjects } from '../types/data.js';
import type { EnhancedMochartConfig, EnhancedSeriesConfig, EnhancedSeriesGroupConfig, EnhancedSeriesStackConfig, EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { ExtraCopyKey, ExtraKey, PositionKey, ValueKey } from './constants.js';

type SeriesContainerConfig = EnhancedValueAxisConfig | EnhancedSeriesStackConfig | EnhancedSeriesGroupConfig;
type SeriesBundle = { data: SeriesDataSet };

export function getSeriesData(mochartConfig: EnhancedMochartConfig, dataProvider: DataProvider, filteredSeriesMap: Record<string, unknown>, categoryData: CategoryData): SeriesData {
  const keyCategoryValues = categoryData.values.key;

  const { series: seriesConfigs, seriesStacks: seriesStackConfigs, valueAxes: valueAxisConfigs } = mochartConfig;

  const rawSeriesBundle = getRawSeriesBundle(valueAxisConfigs, seriesConfigs, seriesStackConfigs, keyCategoryValues, dataProvider);
  const seriesFilteredFlags = getSeriesFilteredFlags(seriesConfigs, filteredSeriesMap);
  const filteredSeriesBundle = getFilteredSeriesBundle(valueAxisConfigs, seriesConfigs, seriesStackConfigs, keyCategoryValues, rawSeriesBundle, seriesFilteredFlags);

  const seriesBases = getSeriesBases(seriesConfigs, rawSeriesBundle.data.domains, filteredSeriesBundle.data.domains,
    rawSeriesBundle.data.renderAxisDomains, filteredSeriesBundle.data.renderAxisDomains);
  const axisSeriesCounts = getSeriesContainerVisibleSeriesCounts(valueAxisConfigs, seriesFilteredFlags);
  warnLogAxisValues(valueAxisConfigs, rawSeriesBundle.data.values);

  return {
    seriesBases,
    axisSeriesCounts,
    raw: rawSeriesBundle.data,
    filteredFlags: seriesFilteredFlags,
    filtered: filteredSeriesBundle.data
  };
}

// whether each log axis's warning is standing, per value axis config: it repeats only after the values clear
const warnedLogAxes = new WeakMap<object, boolean>();

/** Warns once when a log axis has series values at or below 0, which it draws as missing, since nothing else says why a point is gone. */
function warnLogAxisValues(valueAxisConfigs: EnhancedValueAxisConfig[], valueObjects: SeriesValueObjects): void {
  for (const valueAxisConfig of valueAxisConfigs) {
    if (valueAxisConfig.scale !== SCALE_LOG) {
      continue;
    }
    const seriesIds = valueAxisConfig.seriesConfigs!
      .filter(({ id }) => {
        // a range with one end above 0 is still drawn, its other end cut off at the plot edge
        const { plain, range } = valueObjects[id];
        return plain !== null && plain.some((value, i) => value <= 0 && !(range !== null && range[i]! > 0));
      })
      .map(({ id }) => id);
    const standing = seriesIds.length > 0;
    if (standing && warnedLogAxes.get(valueAxisConfig) !== true) {
      console.warn('mochart value axis ' + valueAxisConfig.id + ' is a log axis, so it draws series values at or below 0 as missing, in series: ' + seriesIds.join(', '));
    }
    warnedLogAxes.set(valueAxisConfig, standing);
  }
}

export function getSeriesDataWithRenderAxisDomains(seriesData: SeriesData, rawRenderAxisDomains: SeriesDataSet['renderAxisDomains'], filteredRenderAxisDomains: SeriesDataSet['renderAxisDomains']): SeriesData {
  const raw = Object.assign({}, seriesData.raw, { renderAxisDomains: rawRenderAxisDomains });
  const filtered = Object.assign({}, seriesData.filtered, { renderAxisDomains: filteredRenderAxisDomains });
  return Object.assign({}, seriesData, { raw, filtered });
}

export function getSeriesDataWithSeriesBases(seriesData: SeriesData, seriesBases: SeriesData['seriesBases']): SeriesData {
  return Object.assign({}, seriesData, { seriesBases });
}

export function getSeriesDataWithSeriesCounts(seriesData: SeriesData, valueAxisSeriesCounts: Record<string, number>): SeriesData {
  return Object.assign({}, seriesData, { axisSeriesCounts: valueAxisSeriesCounts });
}

export function getSeriesDataWithFilteredFlags(seriesData: SeriesData, filteredFlags: Record<string, boolean>): SeriesData {
  return Object.assign({}, seriesData, { filteredFlags });
}

export function getSeriesDataWithSeriesValues(seriesData: SeriesData, values: SeriesValueObjects, filteredValues: SeriesValueObjects): SeriesData;
export function getSeriesDataWithSeriesValues(seriesData: SeriesData, values: Record<string, Partial<SeriesValueObject>>, filteredValues: Record<string, Partial<SeriesValueObject>>): SeriesData;
export function getSeriesDataWithSeriesValues(seriesData: SeriesData, values: Record<string, Partial<SeriesValueObject>>, filteredValues: Record<string, Partial<SeriesValueObject>>): SeriesData {
  const raw = Object.assign({}, seriesData.raw, { values: values as SeriesValueObjects });
  const filtered = Object.assign({}, seriesData.filtered, { values: filteredValues as SeriesValueObjects });
  return Object.assign({}, seriesData, { raw, filtered });
}

export function getSeriesDataWithDomains(seriesData: SeriesData, domains: SeriesDomainObjects, filteredDomains: SeriesDomainObjects): SeriesData {
  const raw = Object.assign({}, seriesData.raw, { domains: domains });
  const filtered = Object.assign({}, seriesData.filtered, { domains: filteredDomains });
  return Object.assign({}, seriesData, { raw, filtered });
}

// series data functions
function getRawSeriesBundle(valueAxisConfigs: EnhancedValueAxisConfig[], seriesConfigs: EnhancedSeriesConfig[], seriesStackConfigs: EnhancedSeriesStackConfig[], keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider): SeriesBundle {
  const valueObjects = createEmptySeriesValueObjects(seriesConfigs);
  setPlainSeriesValues(seriesConfigs, keyCategoryValues, dataProvider, valueObjects);
  setRangeSeriesValues(seriesConfigs, keyCategoryValues, dataProvider, valueObjects);
  setErrorSeriesValues(seriesConfigs, keyCategoryValues, dataProvider, valueObjects);
  setStackSeriesValues(seriesConfigs, seriesStackConfigs, keyCategoryValues, valueObjects);
  setExtraSeriesValues(seriesConfigs, keyCategoryValues, dataProvider, valueObjects);
  setMinMax(valueObjects);
  const domainObjects = getSeriesDomainObjects(valueObjects, seriesConfigs);
  const axisDomains = getValueAxisDomains(valueAxisConfigs, domainObjects);
  return {
    data: {
      axisDomains,
      renderAxisDomains: getRenderValueAxisDomains(valueAxisConfigs, axisDomains),
      domains: domainObjects,
      values: valueObjects
    }
  };
}

function getFilteredSeriesBundle(valueAxisConfigs: EnhancedValueAxisConfig[], seriesConfigs: EnhancedSeriesConfig[], seriesStackConfigs: EnhancedSeriesStackConfig[], keyCategoryValues: readonly CategoryValue[], rawSeriesValuesBundle: SeriesBundle, seriesFilteredFlags: Record<string, boolean>): SeriesBundle {
  const valueObjects = createEmptySeriesValueObjects(seriesConfigs);
  for (const key of positionKeys) {
    setFilteredSeriesValues(valueObjects, rawSeriesValuesBundle.data.values, key, seriesFilteredFlags);
  }
  setFilteredStackSeriesValues(seriesConfigs, seriesStackConfigs, keyCategoryValues, valueObjects, rawSeriesValuesBundle.data.values);
  setFilteredExtraSeriesValues(rawSeriesValuesBundle.data.values, valueObjects, seriesFilteredFlags);
  setMinMax(valueObjects);
  const domainObjects = getSeriesDomainObjects(valueObjects, seriesConfigs);
  const axisDomains = getValueAxisDomains(valueAxisConfigs, domainObjects);
  return {
    data: {
      axisDomains,
      renderAxisDomains: getRenderValueAxisDomains(valueAxisConfigs, axisDomains),
      domains: domainObjects,
      values: valueObjects
    }
  };
}

function createEmptySeriesValueObjects(seriesConfigs: EnhancedSeriesConfig[]): SeriesValueObjects {
  return arrayToMap(seriesConfigs, idAccessor, () => ({
    plain: null, range: null, errorLow: null, errorHigh: null, stack: null, prior: null, marker: null, label: null, color: null, tooltip: null,
    markerCopyKey: null, labelCopyKey: null, colorCopyKey: null, tooltipCopyKey: null, min: null, max: null
  }));
}

/** The values of one series, aligned to the category values. */
function getSeriesValuesForProperty(seriesProperty: string, keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider): NumericValues {
  return readNumericValues(dataProvider, seriesProperty, keyCategoryValues.length);
}

function setPlainSeriesValues(seriesConfigs: EnhancedSeriesConfig[], keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider, valueObjects: SeriesValueObjects): void {
  for (const seriesConfig of seriesConfigs) {
    valueObjects[seriesConfig.id].plain = getSeriesValuesForProperty(seriesConfig.property!, keyCategoryValues, dataProvider);
  }
}

function setRangeSeriesValues(seriesConfigs: EnhancedSeriesConfig[], keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider, valueObjects: SeriesValueObjects): void {
  for (const seriesConfig of seriesConfigs) {
    if (seriesConfig.rangeProperty !== NONE) {
      valueObjects[seriesConfig.id].range = getSeriesValuesForProperty(seriesConfig.rangeProperty, keyCategoryValues, dataProvider);
    }
    else {
      valueObjects[seriesConfig.id].range = null;
    }
  }
}

function setErrorSeriesValues(seriesConfigs: EnhancedSeriesConfig[], keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider, valueObjects: SeriesValueObjects): void {
  for (const seriesConfig of seriesConfigs) {
    valueObjects[seriesConfig.id].errorLow = seriesConfig.errorLowProperty !== NONE ?
      getSeriesValuesForProperty(seriesConfig.errorLowProperty, keyCategoryValues, dataProvider) : null;
    valueObjects[seriesConfig.id].errorHigh = seriesConfig.errorHighProperty !== NONE ?
      getSeriesValuesForProperty(seriesConfig.errorHighProperty, keyCategoryValues, dataProvider) : null;
  }
}

function setExtraSeriesValues(seriesConfigs: EnhancedSeriesConfig[], keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider, valueObjects: SeriesValueObjects): void {
  let valueObject: SeriesValueObject;
  for (const seriesConfig of seriesConfigs) {
    valueObject = valueObjects[seriesConfig.id];
    const existingProperties: Record<string, ValueKey> = Object.create(null); // null proto: keyed by data property names
    existingProperties[seriesConfig.property!] = 'plain';
    if (seriesConfig.rangeProperty !== NONE) {
      existingProperties[seriesConfig.rangeProperty] = 'range';
    }
    if (seriesConfig.errorLowProperty !== NONE) {
      existingProperties[seriesConfig.errorLowProperty] = 'errorLow';
    }
    if (seriesConfig.errorHighProperty !== NONE) {
      existingProperties[seriesConfig.errorHighProperty] = 'errorHigh';
    }
    setExtraProperty(seriesConfig.markerProperty !== NONE, seriesConfig.markerProperty, 'marker', 'markerCopyKey',
      valueObject, existingProperties, keyCategoryValues, dataProvider);
    setExtraProperty(seriesConfig.colorProperty !== NONE, seriesConfig.colorProperty, 'color', 'colorCopyKey',
      valueObject, existingProperties, keyCategoryValues, dataProvider);
    setExtraProperty(seriesConfig.labelProperty !== NONE, seriesConfig.labelProperty, 'label', 'labelCopyKey',
      valueObject, existingProperties, keyCategoryValues, dataProvider);
    setExtraProperty(seriesConfig.tooltipProperty !== NONE, seriesConfig.tooltipProperty, 'tooltip', 'tooltipCopyKey',
      valueObject, existingProperties, keyCategoryValues, dataProvider);
  }
}

function setExtraProperty(hasProperty: boolean, property: string | null, valueKey: ExtraKey, valueCopyKey: ExtraCopyKey, valueObject: SeriesValueObject, existingProperties: Record<string, ValueKey>, keyCategoryValues: readonly CategoryValue[], dataProvider: DataProvider): void {
  if (hasProperty) {
    const definedProperty = property!;
    const existingProperty = existingProperties[definedProperty];
    if (existingProperty) {
      valueObject[valueKey] = valueObject[existingProperty];
      valueObject[valueCopyKey] = existingProperty;
    }
    else {
      valueObject[valueKey] = getSeriesValuesForProperty(definedProperty, keyCategoryValues, dataProvider);
      valueObject[valueCopyKey] = null;
      existingProperties[definedProperty] = valueKey;
    }
  }
  else {
    valueObject[valueKey] = null;
    valueObject[valueCopyKey] = null;
  }
}

function setFilteredExtraSeriesValues(rawValueObjects: SeriesValueObjects, valueObjects: SeriesValueObjects, seriesFilteredFlags: Record<string, boolean>): void {
  const seriesIds = Object.keys(rawValueObjects);

  let rawValueObject, valueObject;
  for (const seriesId of seriesIds) {
    rawValueObject = rawValueObjects[seriesId];
    valueObject = valueObjects[seriesId];
    if (seriesFilteredFlags[seriesId] === true) {
      for (const extraKey of extraKeys) {
        valueObject[extraKey] = null;
      }
    }
    else {
      for (const extraKey of extraKeys) {
        valueObject[extraKey] = rawValueObject[extraKey];
      }
    }
    for (const extraCopyKey of extraCopyKeys) {
      valueObject[extraCopyKey] = rawValueObject[extraCopyKey];
    }
  }
}

function setStackSeriesValues(seriesConfigs: EnhancedSeriesConfig[], seriesStackConfigs: EnhancedSeriesStackConfig[], keyCategoryValues: readonly CategoryValue[], valueObjects: SeriesValueObjects): void {
  let valueObject: SeriesValueObject;
  for (const seriesConfig of seriesConfigs) {
    valueObject = valueObjects[seriesConfig.id];
    valueObject.stack = null;
    valueObject.prior = null;
  }
  for (const seriesStackConfig of seriesStackConfigs) {
    const categoryCount = keyCategoryValues.length;
    const positiveStackValues = createArrayFilledWithZero(categoryCount);
    const negativeStackValues = createArrayFilledWithZero(categoryCount);
    const stackSeriesConfigs = seriesStackConfig.seriesConfigs!;
    for (const seriesConfig of stackSeriesConfigs) {
      const values = valueObjects[seriesConfig.id][keyPlain]!;
      setStackSingleSeriesValues(valueObjects[seriesConfig.id], positiveStackValues, negativeStackValues, values);
    }
  }
}

// a non-finite value (missing is NaN) would poison the running total for every later series in the stack
function isStackableValue(value: number): boolean {
  return Number.isFinite(value);
}

function setStackSingleSeriesValues(valueObject: SeriesValueObject, positiveStackValues: number[], negativeStackValues: number[], values: NumericValues): void {
  const count = values.length;
  let priorValues: NumericValues = [];
  const stackValues: NumericValues = [];
  let value: number, tempValue: number | undefined;
  for (let i=0; i<count; i++) {
    value = values[i];
    if (!isStackableValue(value)) {
      priorValues.push(positiveStackValues[i]);
      stackValues.push(MISSING_VALUE);
    }
    else if (value >= 0) {
      tempValue = positiveStackValues[i];
      priorValues.push(tempValue);
      positiveStackValues[i] = tempValue = tempValue + value;
      stackValues.push(tempValue);
    }
    else {
      tempValue = negativeStackValues[i];
      priorValues.push(tempValue);
      negativeStackValues[i] = tempValue = tempValue + value;
      stackValues.push(tempValue);
    }
  }
  if (tempValue === undefined) { // no values were stacked, so don't set the prior values
    priorValues = stackValues;
  }
  valueObject.stack = stackValues;
  valueObject.prior = priorValues;
}

function getStackPriorValues(positiveStackValues: number[], negativeStackValues: number[], values: NumericValues): NumericValues {
  const priorValues: NumericValues = [];
  let value: number;
  const count = values.length;
  for (let i = 0; i < count; i++) {
    value = values[i];
    if (!isStackableValue(value) || value >= 0) {
      priorValues.push(positiveStackValues[i]);
    }
    else {
      priorValues.push(negativeStackValues[i]);
    }
  }
  return priorValues;
}

function incrementStackValues(positiveStackValues: number[], negativeStackValues: number[], values: NumericValues): void {
  const count = values.length;
  for (let i=0; i<count; i++) {
    const value = values[i];
    if (isStackableValue(value)) {
      if (value > 0) {
        positiveStackValues[i]+= value;
      }
      else if (value < 0) {
        negativeStackValues[i]+= value;
      }
    }
  }
}

function setFilteredStackSeriesValues(seriesConfigs: EnhancedSeriesConfig[], seriesStackConfigs: EnhancedSeriesStackConfig[], keyCategoryValues: readonly CategoryValue[], filteredValueObjects: SeriesValueObjects, rawValueObjects: SeriesValueObjects): void {
  let filteredValueObject: SeriesValueObject;
  for (const seriesConfig of seriesConfigs) {
    filteredValueObject = filteredValueObjects[seriesConfig.id];
    filteredValueObject.stack = null;
    filteredValueObject.prior = null;
  }
  for (const seriesStackConfig of seriesStackConfigs) {
    let filteredSeriesFound = false;
    const categoryCount = keyCategoryValues.length;
    const positiveStackValues = createArrayFilledWithZero(categoryCount);
    const negativeStackValues = createArrayFilledWithZero(categoryCount);
    const stackSeriesConfigs = seriesStackConfig.seriesConfigs!;
    let rawValueObject: SeriesValueObject;
    for (const seriesConfig of stackSeriesConfigs) {
      filteredValueObject = filteredValueObjects[seriesConfig.id];
      const values = filteredValueObject[keyPlain];
      if (values !== null) {
        if (filteredSeriesFound) {
          setStackSingleSeriesValues(filteredValueObject, positiveStackValues, negativeStackValues, values);
        }
        else {
          incrementStackValues(positiveStackValues, negativeStackValues, values);
          rawValueObject = rawValueObjects[seriesConfig.id];
          filteredValueObject.stack = rawValueObject.stack;
          filteredValueObject.prior = rawValueObject.prior;
        }
      }
      else {
        filteredSeriesFound = true;
        rawValueObject = rawValueObjects[seriesConfig.id];
        filteredValueObject.prior = getStackPriorValues(positiveStackValues, negativeStackValues, rawValueObject[keyPlain]!);
      }
    }
  }
}

export function setMinMax(valueObjects: Record<string, Partial<SeriesValueObject>>): void {
  const seriesIds = Object.keys(valueObjects);
  let valueObject;
  for (const seriesId of seriesIds) {
    valueObject = valueObjects[seriesId];
    if (valueObject.stack !== null) {
      valueObject.max = valueObject.stack;
      valueObject.min = valueObject.prior;
    }
    else {
      valueObject.max = valueObject.plain;
      valueObject.min = valueObject.range;
    }
  }
}

function getSeriesDomainObjects(seriesValueObjects: SeriesValueObjects, seriesConfigs: EnhancedSeriesConfig[]): SeriesDomainObjects {
  const seriesDomainObjects: SeriesDomainObjects = Object.create(null);

  for (const seriesConfig of seriesConfigs) {
    const positiveOnly = seriesConfig.valueAxisConfig?.scale === SCALE_LOG;
    seriesDomainObjects[seriesConfig.id] = getSeriesDomainObject(seriesValueObjects[seriesConfig.id], positiveOnly);
  }
  return seriesDomainObjects;
}

function getSeriesDomainObject(seriesValueObject: SeriesValueObject, positiveOnly: boolean): SeriesDomainObject {
  const seriesDomainObject: SeriesDomainObject = {};
  for (const key of valueKeys) {
    if (key !== keyPrior) {
      // only values placed on the axis lose their non-positive ones: marker sizes, colors and labels keep theirs
      setSeriesDomain(seriesDomainObject, seriesValueObject, key, positiveOnly && isPositionOrComputedKey(key));
    }
  }
  let domain = nullDomain;
  if (seriesValueObject.plain !== null) {
    if (seriesValueObject.stack !== null) {
      domain = mergeDomain(seriesDomainObject.stack, seriesValueObject.prior !== null ? getDomainForValues(seriesValueObject.prior) : nullDomain);
    }
    else {
      domain = seriesValueObject.range !== null ? mergeDomain(seriesDomainObject.plain, seriesDomainObject.range) : seriesDomainObject.plain;
      // error bounds join the domain so whiskers never clip (stacked series can't configure them)
      if (seriesValueObject.errorLow !== null) {
        domain = mergeDomain(domain, seriesDomainObject.errorLow);
      }
      if (seriesValueObject.errorHigh !== null) {
        domain = mergeDomain(domain, seriesDomainObject.errorHigh);
      }
    }
  }
  seriesDomainObject.domain = domain;
  return seriesDomainObject;
}

function isPositionOrComputedKey(key: ValueKey): boolean {
  return (positionOrComputedKeys as readonly ValueKey[]).includes(key);
}

function setSeriesDomain(seriesDomainObject: SeriesDomainObject, seriesValuesObject: SeriesValueObject, valueKey: ValueKey, positiveOnly: boolean): void {
  if (seriesValuesObject[valueKey] !== null) {
    seriesDomainObject[valueKey] = getDomainForValues(seriesValuesObject[valueKey], positiveOnly);
  }
  else {
    seriesDomainObject[valueKey] = nullDomain;
  }
}

function getSeriesFilteredFlags(seriesConfigs: EnhancedSeriesConfig[], filteredSeriesMap: Record<string, unknown>): Record<string, boolean> {
  const seriesFilteredFlags: Record<string, boolean> = Object.create(null);
  for (const seriesConfig of seriesConfigs) {
    const filterId = seriesConfig.followSeries !== NONE ? seriesConfig.followSeries : seriesConfig.id;
    // own-key check: the map may be a host-provided plain object, so ids like constructor must not hit Object.prototype
    // only true filters: a controlled map may carry false for the series it wants shown
    seriesFilteredFlags[seriesConfig.id] = Object.prototype.hasOwnProperty.call(filteredSeriesMap, filterId) &&
      filteredSeriesMap[filterId] === true;
  }
  return seriesFilteredFlags;
}

function setFilteredSeriesValues(valueObjects: SeriesValueObjects, rawValueObjects: SeriesValueObjects, valueKey: PositionKey, seriesFilteredFlags: Record<string, boolean>): void {
  const seriesIds = Object.keys(valueObjects);
  for (const seriesId of seriesIds) {
    if (seriesFilteredFlags[seriesId] === true) {
      valueObjects[seriesId][valueKey] = null;
    }
    else {
      valueObjects[seriesId][valueKey] = rawValueObjects[seriesId][valueKey];
    }
  }
}

function getValueAxisDomains(valueAxisConfigs: EnhancedValueAxisConfig[], seriesDomainObjects: SeriesDomainObjects): Record<string, NullableDomain> {
  return arrayToMap(valueAxisConfigs, idAccessor,
                    valueAxisConfig => getValueAxisDomain(valueAxisConfig, seriesDomainObjects));
}

function getRenderValueAxisDomains(valueAxisConfigs: EnhancedValueAxisConfig[], axisDomains: Record<string, NullableDomain>): Record<string, NullableDomain> {
  return arrayToMap(valueAxisConfigs, idAccessor,
                    valueAxisConfig => getRenderAxisDomain(valueAxisConfig, axisDomains[valueAxisConfig.id]) as NullableDomain);
}

function getValueAxisDomain(valueAxisConfig: EnhancedValueAxisConfig, seriesDomainObjects: SeriesDomainObjects): NullableDomain {
  return getAxisDomain(valueAxisConfig, () => calculateValueAxisDomain(valueAxisConfig, seriesDomainObjects)) as NullableDomain;
}

export function calculateValueAxisDomain(valueAxisConfig: EnhancedValueAxisConfig, seriesDomainObjects: SeriesDomainObjects): NullableDomain {
  const axisDomain: NullableDomain = [null, null];
  const seriesConfigs = valueAxisConfig.seriesConfigs!;
  for (const seriesConfig of seriesConfigs) {
    const seriesDomain = seriesDomainObjects[seriesConfig.id].domain;
    if (seriesDomain[0] !== null && (axisDomain[0] === null || seriesDomain[0] < axisDomain[0])) {
      axisDomain[0] = seriesDomain[0];
    }
    if (seriesDomain[1] !== null && (axisDomain[1] === null || seriesDomain[1] > axisDomain[1])) {
      axisDomain[1] = seriesDomain[1];
    }
  }
  return axisDomain;
}

export function getSeriesBases(seriesConfigs: EnhancedSeriesConfig[], rawSeriesDomains: SeriesDomainObjects, filteredSeriesDomains: SeriesDomainObjects,
  rawValueAxisDomains: Record<string, NullableDomain>, filteredValueAxisDomains: Record<string, NullableDomain>): Record<string, number | null> {
  return arrayToMap(seriesConfigs, idAccessor, seriesConfig => {
    const valueAxisConfig = seriesConfig.valueAxisConfig!;
    if (valueAxisConfig.base !== NONE) {
      return valueAxisConfig.base;
    }
    const adjust = valueAxisConfig.adjustForFiltering;
    const axisDomain = (adjust ? filteredValueAxisDomains : rawValueAxisDomains)[valueAxisConfig.id];
    // an un-ranged bar or area is drawn from the axis end, so it has to animate to the same place
    const drawnFromTheAxisEnd = (seriesConfig.renderer === RENDERER_BAR || seriesConfig.renderer === RENDERER_AREA) &&
      seriesConfig.rangeProperty === NONE;
    if (drawnFromTheAxisEnd) {
      return axisDomain[0];
    }
    if (valueAxisConfig.min !== AUTO) {
      return valueAxisConfig.min as number;
    }
    const dataMin = calculateValueAxisDomain(valueAxisConfig, adjust ? filteredSeriesDomains : rawSeriesDomains)[0];
    return dataMin !== null ? dataMin : axisDomain[0];
  })
}

export function getSeriesContainerVisibleSeriesCounts(seriesContainerConfigs: SeriesContainerConfig[], filteredSeriesFlags: Record<string, boolean>): Record<string, number> {
  return arrayToMap(seriesContainerConfigs, idAccessor, seriesContainerConfig =>
    getSeriesContainerVisibleSeriesCount(seriesContainerConfig, filteredSeriesFlags))
}

function getSeriesContainerVisibleSeriesCount(seriesContainerConfig: SeriesContainerConfig, filteredSeriesFlags: Record<string, boolean>): number {
  let seriesCount = 0;
  const seriesConfigs = seriesContainerConfig.seriesConfigs!;
  for (const seriesConfig of seriesConfigs) {
    if (filteredSeriesFlags[seriesConfig.id] === false) {
      seriesCount++;
    }
  }
  return seriesCount;
}

function getCategorySeriesValueObject(seriesValueObject: SeriesValueObject, categoryIndex: number): Partial<Record<ValueKey, number | null | undefined>> {
  const categorySeriesValueObject: Partial<Record<ValueKey, number | null | undefined>> = {};
  let keyValues: NumericValues | null;
  for (const key of valueKeys) {
    keyValues = seriesValueObject[key];
    if (keyValues !== undefined) {
      if (keyValues === null) {
        categorySeriesValueObject[key] = null;
      }
      else {
        // per-category value objects feed tooltips, labels and callbacks, where a missing value stays undefined
        const value = keyValues[categoryIndex];
        categorySeriesValueObject[key] = isMissingValue(value) ? undefined : value;
      }
    }
  }
  return categorySeriesValueObject;
}

export function getSeriesValueObjects(seriesData: SeriesData, categoryIndex: number) {
  const { seriesBases, axisSeriesCounts, filteredFlags, raw, filtered } = seriesData;

  return {
    seriesBases,
    axisSeriesCounts,
    filteredFlags,
    raw:  {
      axisDomains: raw.axisDomains,
      renderAxisDomains: raw.renderAxisDomains,
      domains: raw.domains,
      values: mapMap(raw.values, seriesValueObject => getCategorySeriesValueObject(seriesValueObject, categoryIndex))
    },
    filtered: {
      axisDomains: filtered.axisDomains,
      renderAxisDomains: filtered.renderAxisDomains,
      domains: filtered.domains,
      values: mapMap(filtered.values, seriesValueObject => getCategorySeriesValueObject(seriesValueObject, categoryIndex))
    }
  }
}
