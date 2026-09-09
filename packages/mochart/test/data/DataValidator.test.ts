import { describe, it, expect } from 'vitest';
import { getDataErrors } from '../../src/data/DataValidator';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';
import { ObjectOfArraysDataProvider } from '../../src/data/DataProvider';
import type { DataProvider } from '../../src/types/data';

function stringConfig() {
  return makeConfig({
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  });
}

describe('getDataErrors', () => {
  it('returns no errors for well-formed data', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: 20 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('returns no errors when the config itself is invalid', () => {
    const invalid = makeConfig({});
    expect(invalid.validation.valid).toBe(false);
    const provider = new ArrayOfObjectsDataProvider([{ month: 'Jan', sales: 10 }]);
    expect(getDataErrors(invalid, provider)).toEqual([]);
  });

  it('returns no errors for a null data provider', () => {
    expect(getDataErrors(stringConfig(), null)).toEqual([]);
  });

  // Regression: a provider missing its accessor used to pass validation and throw inside getChartData
  it('names the required member a provider does not implement', () => {
    const config = stringConfig();
    const stateOnly = { getLoading: () => false } as unknown as DataProvider;
    expect(getDataErrors(config, stateOnly)).toEqual(['data provider must implement: getPropertyValues']);
  });

  // the one accessor serves every property, with a different type expected per config role
  it('accepts string category values and numeric keys from the same accessor that must return numbers for series properties', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const valuesByProperty: Record<string, readonly unknown[]> = { id: [1, 2], label: ['Jan', 'Feb'], y: [5, 6] };
    const provider = { getPropertyValues: (property: string) => valuesByProperty[property] } as unknown as DataProvider;
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('flags non-numeric series values', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: 'oops' }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'series values must be numeric or missing for property: sales'
    ]);
  });

  it('allows undefined series values', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb' } // sales is undefined
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('allows null series values', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: null }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  // a NaN is what a failed upstream parse or computation leaves behind; it reads as missing, like null
  it('allows NaN series values', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: NaN }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('still flags an infinite series value', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: Infinity }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'series values must be numeric or missing for property: sales'
    ]);
  });

  it('flags a series property absent from the data', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan' },
        { month: 'Feb' }
      ]);
    expect(getDataErrors(config, provider)).toEqual(['no values found for property: sales']);
  });

  it('allows an absent series property when the series sets allowAbsentDataProperties', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'sales', rangeProperty: 'high', labelProperty: 'lbl', allowAbsentDataProperties: true }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan' },
        { month: 'Feb' }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('keeps flagging other series and present-but-misaligned properties under allowAbsentDataProperties', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [
        { property: 'sales', allowAbsentDataProperties: true },
        { property: 'cost' }
      ]
    });
    const provider = new ObjectOfArraysDataProvider({ month: ['Jan', 'Feb', 'Mar'], sales: [10, 20] });
    expect(getDataErrors(config, provider)).toEqual([
      'property sales has 2 values but there are 3 categories',
      'no values found for property: cost'
    ]);
  });

  it('flags a series property whose length does not match the category values', () => {
    const config = stringConfig();
    const provider = new ObjectOfArraysDataProvider({ month: ['Jan', 'Feb', 'Mar'], sales: [10, 20] });
    expect(getDataErrors(config, provider)).toEqual([
      'property sales has 2 values but there are 3 categories'
    ]);
  });

  it('flags a key property whose length does not match the category values', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const provider = new ObjectOfArraysDataProvider({ id: [1], label: ['Jan', 'Feb'], y: [5, 6] });
    expect(getDataErrors(config, provider)).toEqual([
      'property id has 1 values but there are 2 categories'
    ]);
  });

  it('flags key values that are not strings or numbers', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const provider = new ObjectOfArraysDataProvider({ id: [1, new Date(0)], label: ['Jan', 'Feb'], y: [5, 6] });
    expect(getDataErrors(config, provider)).toEqual([
      'category key values must be number or string for property: id'
    ]);
  });

  it('flags duplicate key values but allows repeated category values when keyed', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const repeated = new ObjectOfArraysDataProvider({ id: [1, 2], label: ['Jan', 'Jan'], y: [5, 6] });
    expect(getDataErrors(config, repeated)).toEqual([]);
    const duplicateKeys = new ObjectOfArraysDataProvider({ id: [1, 1], label: ['Jan', 'Feb'], y: [5, 6] });
    expect(getDataErrors(config, duplicateKeys)).toEqual([
      'category key values must be unique for property: id, duplicates: 1'
    ]);
  });

  it('flags duplicate category values', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10 },
        { month: 'Jan', sales: 20 }
      ]);
    expect(getDataErrors(config, provider)).toEqual(['category values must be unique, duplicates: Jan']);
  });

  it('flags category values that do not match a numeric axis type', () => {
    const config = makeConfig({
      categoryAxis: { property: 'x', type: 'number', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { x: 1, y: 5 },
        { x: 'not-a-number', y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual(['category values must all match the specified type for property: x']);
  });

  it('validates extra series properties (range, marker, color, label)', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [
        { property: 'sales', renderer: 'bar', rangeProperty: 'high', markerProperty: 'mk', colorProperty: 'c', labelProperty: 'lbl' }
      ]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10, high: 12, mk: 1, c: 2, lbl: 'bad' }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'series values must be numeric or missing for property: lbl'
    ]);
  });

  it('validates error bound properties', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [
        { property: 'sales', errorLowProperty: 'lo', errorHighProperty: 'hi' }
      ]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { month: 'Jan', sales: 10, lo: 'bad', hi: 12 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'series values must be numeric or missing for property: lo'
    ]);
  });

  it('accepts date category values on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: '2020-01-01', y: 5 },
        { d: '2020-02-01', y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('flags non-date category values on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: '2020-01-01', y: 5 },
        { d: 'not-a-date', y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual(['category values must all match the specified type for property: d']);
  });

  // Regression: ISO week/ordinal strings passed the type check but parsed to Invalid Date, so two
  // distinct values were reported as duplicates (both keyed "NaN") and a single one produced NaN categories
  it('flags ISO week and ordinal date strings that Date cannot parse', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    for (const rows of [[{ d: '2024-W05', y: 5 }, { d: '2024-W06', y: 6 }], [{ d: '2024-045', y: 5 }]]) {
      expect(getDataErrors(config, new ArrayOfObjectsDataProvider(rows)))
        .toEqual(['category values must all match the specified type for property: d']);
    }
  });

  it('accepts Date instance category values on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: new Date('2020-01-01T00:00:00Z'), y: 5 },
        { d: new Date('2020-02-01T00:00:00Z'), y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('flags invalid Date instances on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: new Date('2020-01-01T00:00:00Z'), y: 5 },
        { d: new Date(NaN), y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual(['category values must all match the specified type for property: d']);
  });

  it('flags duplicate Date category values', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: new Date('2020-01-01T00:00:00Z'), y: 5 },
        { d: new Date('2020-01-01T00:00:00Z'), y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'category values must be unique, duplicates: ' + String(new Date('2020-01-01T00:00:00Z'))
    ]);
  });

  it('flags one instant given as a Date, an ISO string and an epoch number as duplicates on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: new Date(0), y: 5 },
        { d: '1970-01-01T00:00:00.000Z', y: 6 },
        { d: 0, y: 7 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'category values must be unique, duplicates: ' + String(new Date(0))
    ]);
  });

  it('keys keyProperty ids by their string form, not as dates', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', keyProperty: 'id', type: 'date', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { id: 0, d: '2020-01-01', y: 5 },
        { id: '1970-01-01T00:00:00.000Z', d: '2020-01-02', y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('does not flag Date values that differ only in milliseconds as duplicates', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: new Date('2020-01-01T00:00:00.000Z'), y: 5 },
        { d: new Date('2020-01-01T00:00:00.500Z'), y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('accepts negative epoch number category values on a date axis', () => {
    const config = makeConfig({
      categoryAxis: { property: 'd', type: 'date', scale: 'linear' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { d: -86400000, y: 5 }, // 1969-12-31
        { d: 0, y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('validates the category values against the axis type when keyed', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    // the keys are numbers (valid), but one category value is not a string
    const provider = new ArrayOfObjectsDataProvider(
      [
        { id: 1, label: 'Jan', y: 5 },
        { id: 2, label: 99, y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'category values must all match the specified type for property: label'
    ]);
  });

  it('accepts valid keyed category values', () => {
    const config = makeConfig({
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
      series: [{ property: 'y' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { id: 1, label: 'Jan', y: 5 },
        { id: 2, label: 'Feb', y: 6 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('returns no errors for an invalid (errored) data provider', () => {
    const config = stringConfig();
    const errored = {
      getPropertyValues: () => undefined,
      getError: () => 'broken'
    } as unknown as DataProvider;
    expect(getDataErrors(config, errored)).toEqual([]);
  });

  // the config is the only naming authority: data lacking its category property
  // is one loud error, and nothing else is checkable without the category values
  it('flags a category property absent from the data and stops there', () => {
    const config = stringConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [
        { day: 'Jan', sales: 10 },
        { day: 'Feb', sales: 20 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'no category values found for property: month'
    ]);
  });

  it('accepts a minimal single-method custom provider', () => {
    const config = stringConfig();
    const valuesByProperty: Record<string, readonly unknown[]> = { month: ['Jan', 'Feb'], sales: [10, 20] };
    const bare = { getPropertyValues: (property: string) => valuesByProperty[property] } as unknown as DataProvider;
    expect(getDataErrors(config, bare)).toEqual([]);
  });

  it('flags out-of-order category values on a linear scale with a line series', () => {
    const config = makeConfig({
      categoryAxis: { property: 'x', type: 'number', scale: 'linear' },
      series: [{ property: 'y', renderer: 'line' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [{ x: 1, y: 10 }, { x: 3, y: 20 }, { x: 2, y: 30 }]);
    expect(getDataErrors(config, provider)).toEqual([
      'category values must be in order on a linear category scale, out-of-order values: 2'
    ]);
  });

  it('allows descending category values on a linear scale', () => {
    const config = makeConfig({
      categoryAxis: { property: 'x', type: 'number', scale: 'linear' },
      series: [{ property: 'y', renderer: 'line' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [{ x: 3, y: 10 }, { x: 2, y: 20 }, { x: 1, y: 30 }]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('allows out-of-order category values for bar and marker-only series', () => {
    const provider = new ArrayOfObjectsDataProvider(
      [{ x: 1, y: 10 }, { x: 3, y: 20 }, { x: 2, y: 30 }]);
    for (const renderer of ['bar', 'none']) {
      const config = makeConfig({
        categoryAxis: { property: 'x', type: 'number', scale: 'linear' },
        series: [{ property: 'y', renderer }]
      });
      expect(getDataErrors(config, provider)).toEqual([]);
    }
  });

  it('allows out-of-order category values on an ordinal scale', () => {
    const config = makeConfig({
      categoryAxis: { property: 'x', type: 'number', scale: 'ordinal' },
      series: [{ property: 'y', renderer: 'line' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [{ x: 1, y: 10 }, { x: 3, y: 20 }, { x: 2, y: 30 }]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('exempts keyProperty configs from the order check (DST repeated-hour idiom)', () => {
    const config = makeConfig({
      categoryAxis: { property: 'clock', keyProperty: 'stamp', type: 'date', scale: 'linear' },
      series: [{ property: 'y', renderer: 'line' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { stamp: '2017-11-05T01:00:00-04:00', clock: '2017-11-05T01:00:00Z', y: 10 },
        { stamp: '2017-11-05T01:30:00-04:00', clock: '2017-11-05T01:30:00Z', y: 20 },
        { stamp: '2017-11-05T01:00:00-05:00', clock: '2017-11-05T01:00:00Z', y: 30 },
        { stamp: '2017-11-05T01:30:00-05:00', clock: '2017-11-05T01:30:00Z', y: 40 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([]);
  });

  it('flags out-of-order date category values on a linear scale', () => {
    const config = makeConfig({
      categoryAxis: { property: 'day', type: 'date', scale: 'linear' },
      series: [{ property: 'y', renderer: 'area' }]
    });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { day: '2026-01-01', y: 10 },
        { day: '2026-01-03', y: 20 },
        { day: '2026-01-02', y: 30 }
      ]);
    expect(getDataErrors(config, provider)).toEqual([
      'category values must be in order on a linear category scale, out-of-order values: 2026-01-02'
    ]);
  });
});

// A mistyped series property is an absent property, reported the same way by
// both providers instead of silently rendering as all-missing values.
describe('getDataErrors with a mistyped property', () => {
  it('reports identically for both providers', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ property: 'vlaue' }]
    });
    const arrays = new ObjectOfArraysDataProvider({ month: ['Jan', 'Feb'], value: [1, 2] });
    const rows = new ArrayOfObjectsDataProvider([{ month: 'Jan', value: 1 }, { month: 'Feb', value: 2 }]);
    const arrayErrors = getDataErrors(config, arrays as never);
    expect(arrayErrors).toEqual(['no values found for property: vlaue']);
    expect(arrayErrors).toEqual(getDataErrors(config, rows as never));
  });
});
