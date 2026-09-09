import type { MochartConfig } from '@mochart/core';

import type { DataObject } from './types';

/**
 * The set of data properties the chart config actually reads, or null when the
 * config is invalid (no reliable property set — callers should show all data).
 */
export function collectUsedDataProperties(mochartConfig: MochartConfig): Set<string> | null {
  if (!mochartConfig.validation.valid) {
    return null;
  }
  const used = new Set<string>();
  const { categoryAxis: categoryAxisConfig, series: seriesConfigs } = mochartConfig;
  addProperty(used, categoryAxisConfig.property);
  addProperty(used, categoryAxisConfig.keyProperty);
  for (const seriesConfig of seriesConfigs) {
    addProperty(used, seriesConfig.property);
    addProperty(used, seriesConfig.rangeProperty);
    addProperty(used, seriesConfig.markerProperty);
    addProperty(used, seriesConfig.colorProperty);
    addProperty(used, seriesConfig.labelProperty);
    addProperty(used, seriesConfig.tooltipProperty);
    addProperty(used, seriesConfig.errorLowProperty);
    addProperty(used, seriesConfig.errorHighProperty);
  }
  return used;
}

function addProperty(used: Set<string>, property: string | null | undefined): void {
  if (property) {
    used.add(property);
  }
}

export function filterDataProperties(data: DataObject[], usedProperties: Set<string>): DataObject[] {
  return data.map(row => {
    const filtered: DataObject = {};
    for (const key of Object.keys(row)) {
      if (usedProperties.has(key)) {
        filtered[key] = row[key];
      }
    }
    return filtered;
  });
}

/**
 * Rebuild full rows from a filtered (used-properties-only) view: properties the
 * view hid are restored from fullRows; edits made in the view win. Rows are
 * matched by their category value when it identifies rows uniquely (so deleting
 * or reordering view rows keeps hidden columns with their row), falling back to
 * the row index (which covers in-place category edits).
 */
export function restoreHiddenDataProperties(viewRows: DataObject[], fullRows: DataObject[], usedProperties: Set<string>, categoryProperty?: string | null): DataObject[] {
  let fullRowsByCategory: Map<unknown, DataObject> | null = null;
  if (categoryProperty) {
    const byCategory = new Map<unknown, DataObject>();
    let unique = true;
    for (const fullRow of fullRows) {
      const value = fullRow[categoryProperty];
      if (value === undefined || byCategory.has(value)) {
        unique = false;
        break;
      }
      byCategory.set(value, fullRow);
    }
    fullRowsByCategory = unique ? byCategory : null;
  }
  return viewRows.map((row, index) => {
    let fullRow: DataObject | undefined;
    if (fullRowsByCategory !== null && categoryProperty) {
      const key = row[categoryProperty];
      if (key !== undefined) {
        fullRow = fullRowsByCategory.get(key);
      }
    }
    fullRow ??= fullRows[index];
    if (!fullRow) {
      return row;
    }
    const merged: DataObject = { ...row };
    for (const key of Object.keys(fullRow)) {
      if (!usedProperties.has(key) && !(key in merged)) {
        merged[key] = fullRow[key];
      }
    }
    return merged;
  });
}
