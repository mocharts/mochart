import { MISSING_VALUE } from '../utils/utils';

import type { CategoryValue, DataProvider, DataValue, NumericValues } from '../types/data';

const emptyValues: readonly CategoryValue[] = [];

/** A snapshot of the config's category property values, which define the category count; an absent property reads as no categories (getDataErrors diagnoses it). */
export function readCategoryValues(dataProvider: DataProvider, categoryProperty: string): readonly CategoryValue[] {
  // copied so a provider mutated in place (zero-copy providers) can't change the category count under rendered chart data
  // the cast trusts the values getDataErrors checks against the axis type
  return (dataProvider.getPropertyValues(categoryProperty)?.slice() ?? emptyValues) as readonly CategoryValue[];
}

/** One snapshot of exactly categoryCount of a property's values; null reads as undefined so the chart keeps a single missing sentinel. */
export function readAlignedValues(dataProvider: DataProvider, property: string, categoryCount: number): Exclude<DataValue, null>[] {
  const propertyValues = dataProvider.getPropertyValues(property);
  const values: Exclude<DataValue, null>[] = [];
  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
    const value = propertyValues?.[categoryIndex];
    values.push(value === null ? undefined : value);
  }
  return values;
}

/** The numeric read for series properties: null and undefined become the chart's missing value (NaN, which an input NaN already is); the cast trusts getDataErrors' numeric validator for the rest. */
export function readNumericValues(dataProvider: DataProvider, property: string, categoryCount: number): NumericValues {
  const propertyValues = dataProvider.getPropertyValues(property);
  const values: NumericValues = [];
  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
    const value = propertyValues?.[categoryIndex];
    values.push(value === null || value === undefined ? MISSING_VALUE : value as number);
  }
  return values;
}
