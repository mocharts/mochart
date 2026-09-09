import { ArrayOfObjectsDataProvider, NONE, getDataErrors } from '@mochart/core';

import buildMochartDemoConfig from './mochartDemoConfig';
import { demoText } from './demoText';
import { getJsonErrorMessage, parseJson } from './json';
import { filterDataProperties, restoreHiddenDataProperties } from './unusedDataProperties';

import type { DataObject, DemoConfig, MochartDemoConfig } from './types';

/**
 * Compact JSON with a space after each structural comma — built structurally
 * so commas inside string values stay untouched.
 */
export function stringifyWithSpacedCommas(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(item => stringifyWithSpacedCommas(item)).join(', ') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record)
      .filter(key => record[key] !== undefined)
      .map(key => JSON.stringify(key) + ':' + stringifyWithSpacedCommas(record[key]))
      .join(', ') + '}';
  }
  const json = JSON.stringify(value);
  // JSON.stringify serializes undefined array items as null; match it
  return json === undefined ? 'null' : json;
}

export function formatData(dataJSON: unknown): string {
  if (!Array.isArray(dataJSON)) {
    return stringifyWithSpacedCommas(dataJSON);
  }
  // one row per line, matching the old regex-based layout
  return '[' + dataJSON.map(row => stringifyWithSpacedCommas(row)).join(',\n ') + ']';
}

/**
 * Format the data-tab textarea view of fullRows, hiding properties outside
 * viewUsedProperties (null = show every property).
 */
export function formatDataView(fullRows: DataObject[], viewUsedProperties: Set<string> | null): string {
  return formatData(viewUsedProperties === null ? fullRows : filterDataProperties(fullRows, viewUsedProperties));
}

export function isObject(v: unknown): boolean {
  return v !== null && v !== undefined && typeof v === 'object';
}

export function isArrayOfObjects(candidate: unknown): boolean {
  return Array.isArray(candidate) && !candidate.some(v => !isObject(v) || Array.isArray(v));
}

/** The config's category property, for category-value row matching. */
export function getCategoryProperty(config: DemoConfig): string | null {
  return (config as { categoryAxis?: { property?: string } }).categoryAxis?.property ?? null;
}

export type ParsedFullData = { full: DataObject[] } | { error: 'json'; message: string } | { error: 'data' };

/**
 * Parse edited data-tab text back to a full dataset. When the text is a
 * filtered (used-properties-only) view, properties the view hid are restored
 * by row index from fullData.
 */
export function parseFullData(text: string, fullData: DataObject[], viewUsedProperties: Set<string> | null, categoryProperty?: string | null): ParsedFullData {
  let parsed: unknown;
  try {
    parsed = parseJson(text);
  }
  catch (error) {
    return { error: 'json', message: getJsonErrorMessage(error) };
  }
  if (!isArrayOfObjects(parsed)) {
    return { error: 'data' };
  }
  const rows = parsed as DataObject[];
  return { full: viewUsedProperties === null ? rows : restoreHiddenDataProperties(rows, fullData, viewUsedProperties, categoryProperty) };
}

/** Validate rows against an already-built valid config: the shared short error message, or false when clean (details go to the console). */
function getMochartConfigDataError(mochartConfig: MochartDemoConfig['mochartConfig'], rows: DataObject[]): string | false {
  // getDataErrors reports every data problem now, wrong category property included
  const dataErrors = getDataErrors(mochartConfig, new ArrayOfObjectsDataProvider(rows));
  if (dataErrors.length > 0) {
    console.warn('Invalid Data - Content Errors: ', dataErrors.join('\n'));
    return demoText.errors.invalidDataContent;
  }
  return false;
}

/**
 * Validate a config/data pair for the chart path (initial load and applied
 * config/data edits): the dataError to show, or false when the data is clean —
 * or when the config itself is invalid, which the config error UI reports.
 */
export function getConfigDataError(config: DemoConfig, data: DataObject[]): string | false {
  const { mochartConfig } = buildMochartDemoConfig(config);
  return mochartConfig.validation.valid ? getMochartConfigDataError(mochartConfig, data) : false;
}

export type DataApplyResult =
  | { ok: true; data: DataObject[] }
  | { ok: false; errorMessage: string; callbackError: string };

/**
 * Parse and validate a data-tab edit for Apply: the footer error message and
 * the onDataError payload on failure, or the full dataset to apply on success.
 */
export function applyDataEdit(text: string, fullData: DataObject[], viewUsedProperties: Set<string> | null, config: DemoConfig): DataApplyResult {
  // rows are matched by category value when restoring hidden properties, so
  // structural view edits (delete/reorder) keep hidden columns with their row
  const parsed = parseFullData(text, fullData, viewUsedProperties, getCategoryProperty(config));
  if ('error' in parsed) {
    if (parsed.error === 'json') {
      console.warn('Invalid Data JSON: ' + parsed.message);
      return { ok: false, errorMessage: parsed.message, callbackError: demoText.errors.invalidData };
    }
    console.warn('Invalid Data - should be an array of objects');
    // same copy as the live-edit path, so Apply and live edits agree
    return { ok: false, errorMessage: demoText.errors.invalidDataArray, callbackError: demoText.errors.invalidData };
  }
  const parsedData = parsed.full;
  let error: string | null = null;
  const { mochartConfig } = buildMochartDemoConfig(config);
  if (mochartConfig.validation.valid) {
    error = getMochartConfigDataError(mochartConfig, parsedData) || null;
  }
  else {
    console.warn('Could not validate data since mochart config was not valid');
    error = demoText.errors.invalidConfigAndData;
  }
  if (error) {
    return { ok: false, errorMessage: error + demoText.errors.detailsInConsoleSuffix, callbackError: error };
  }
  return { ok: true, data: parsedData };
}

/** The native tooltip for the category index stepper label: the selected category's value. Empty when no category is selected. */
export function getCategoryIndexTitle({ mochartConfig }: MochartDemoConfig, rows: DataObject[], categoryIndex: number): string {
  const row = categoryIndex >= 0 ? rows[categoryIndex] : undefined;
  if (row === undefined) {
    return '';
  }
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  const { property } = categoryAxisConfig;
  const value = property === undefined ? undefined : row[property];
  return value === undefined || value === null ? '' : String(value);
}

/**
 * The series-values editor's JSON text for one category/series cell: the
 * position value under `p`, plus a key per optional property the series config
 * actually declares (`r`ange, `m`arker, `l`abel, `c`olor, `t`ooltip, `el`/`eh`
 * error bounds). Empty when the config has no series. Each port's
 * `applySeriesChanges` reads the same keys back.
 */
export function getSeriesValuesText({ mochartConfig }: MochartDemoConfig, rows: DataObject[], categoryIndex: number, seriesIndex: number): string {
  const { series: seriesConfigs } = mochartConfig;
  if (seriesConfigs.length === 0) {
    return '';
  }
  const row = rows[categoryIndex];
  const { property, rangeProperty, markerProperty, labelProperty, colorProperty, tooltipProperty, errorLowProperty, errorHighProperty } = seriesConfigs[seriesIndex];
  const values: Record<string, unknown> = {};
  values['p'] = row[property!];
  if (rangeProperty !== NONE) {
    values['r'] = row[rangeProperty];
  }
  if (markerProperty !== NONE) {
    values['m'] = row[markerProperty];
  }
  if (labelProperty !== NONE) {
    values['l'] = row[labelProperty];
  }
  if (colorProperty !== NONE) {
    values['c'] = row[colorProperty];
  }
  if (tooltipProperty !== NONE) {
    values['t'] = row[tooltipProperty];
  }
  if (errorLowProperty !== NONE) {
    values['el'] = row[errorLowProperty];
  }
  if (errorHighProperty !== NONE) {
    values['eh'] = row[errorHighProperty];
  }
  return JSON.stringify(values);
}

/** The native tooltip for the series index stepper label: the series title. */
export function getSeriesIndexTitle({ mochartConfig }: MochartDemoConfig, seriesIndex: number): string {
  const seriesConfig = mochartConfig.series[seriesIndex];
  return seriesConfig === undefined ? '' : (seriesConfig.title ?? seriesConfig.id);
}
