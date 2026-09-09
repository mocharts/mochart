// Pie-mode (pie/donut/gauge) demo helpers. Slices are series and the data is
// a single row, so the category-editing machinery of the xy demos has nothing to
// operate on; these helpers back the pie-specific UI instead: the single-mode
// slice panel (select a slice, edit its value, play a filter/restore
// sequence) and the multi-mode filtering stepper.

import type { MochartConfig } from '@mochart/core';

import type { DataObject, FilteredSeriesIds } from './types';

export interface PieSliceInfo {
  /** The series id — what focus, legend filtering and filtering key on. */
  id: string;
  /** The display title (legend text). */
  title: string;
  /** The data property holding the slice's value. */
  property: string;
}

/** The editable slices of a pie-mode config: one per series, in config order. */
export function getPieSlices(mochartConfig: MochartConfig): PieSliceInfo[] {
  return mochartConfig.series.map(seriesConfig => ({
    id: seriesConfig.id,
    title: seriesConfig.title ?? seriesConfig.id,
    property: seriesConfig.property as string
  }));
}

/**
 * Apply a slice value edit to the working row. The single write path for slice
 * edits: percent labels and tooltip shares are derived by the chart from the
 * current slice values (pie label.type / tooltip.valueType), so an edit only
 * has to set the value it edits.
 */
export function applyPieSliceValue(row: DataObject, property: string, value: number): void {
  row[property] = value;
}

/**
 * The step cycle of the multi-mode pie stepper: one step per slice, so
 * filtering runs from none up to all but one — at least one slice always
 * remains.
 */
export function getPieStepCycle(sliceIds: string[]): number {
  return Math.max(1, sliceIds.length);
}

/**
 * The multi-mode pie stepper: chart `chartIndex` at step `step` filters the
 * last `(step + chartIndex) mod cycle` slices, so every chart in the grid
 * shows a different-sized view of the same pie and stepping/playing animates
 * them all concurrently. The cycle caps filtering so at least one slice
 * always remains.
 */
export function getPieStepFilteredIds(sliceIds: string[], chartIndex: number, step: number): FilteredSeriesIds {
  const cycle = getPieStepCycle(sliceIds);
  const count = (((step + chartIndex) % cycle) + cycle) % cycle;
  const filtered: FilteredSeriesIds = {};
  for (let i = sliceIds.length - count; i < sliceIds.length; i++) {
    filtered[sliceIds[i]] = true;
  }
  return filtered;
}

/**
 * Fold a chart's reported filter map back into the user's own map. A pie-mode
 * multi chart is shown the union of the user map and the stepper's per-chart
 * overlay, and it reports the whole updated union on a legend toggle — only
 * the delta against what that chart was shown belongs in the user map, or the
 * overlay leaks into every chart's user filtering and can never step back out.
 */
export function applyReportedSeriesFilter(userFilteredSeriesIds: FilteredSeriesIds, shownFilteredSeriesIds: FilteredSeriesIds, reportedFilteredSeriesIds: FilteredSeriesIds): FilteredSeriesIds {
  const next: FilteredSeriesIds = { ...userFilteredSeriesIds };
  for (const id of Object.keys({ ...shownFilteredSeriesIds, ...reportedFilteredSeriesIds })) {
    const shown = shownFilteredSeriesIds[id] === true;
    const reported = reportedFilteredSeriesIds[id] === true;
    if (reported && !shown) {
      next[id] = true;
    }
    else if (!reported && shown) {
      delete next[id];
    }
  }
  return next;
}

/**
 * The single-mode slice sequence: filter the slices one at a time from the
 * last down to one remaining, then restore them in reverse, ending fully
 * restored. Returned as the filter map to show at each 2s tick.
 */
export function getPieSequenceSteps(sliceIds: string[]): FilteredSeriesIds[] {
  const maxFiltered = Math.max(0, sliceIds.length - 1);
  const steps: FilteredSeriesIds[] = [];
  const cumulative = (count: number): FilteredSeriesIds => {
    const filtered: FilteredSeriesIds = {};
    for (let i = sliceIds.length - count; i < sliceIds.length; i++) {
      filtered[sliceIds[i]] = true;
    }
    return filtered;
  };
  for (let count = 1; count <= maxFiltered; count++) {
    steps.push(cumulative(count));
  }
  for (let count = maxFiltered - 1; count >= 0; count--) {
    steps.push(cumulative(count));
  }
  return steps;
}
