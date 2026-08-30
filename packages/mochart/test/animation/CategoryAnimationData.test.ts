import { describe, it, expect } from 'vitest';
import { getCategoryData, getCategoryDataWithNumericValues } from '../../src/data/CategoryData';
import {
  getInitialCategoryDeltaData,
  getCategoryDeltaData,
  indexOfCategoryValue,
  getMergedNumericValues,
  mergedIndexForNewIndex,
  oldIndexForNewIndex,
  newIndexForMergedIndex,
  newIndexForOldIndex,
  hasCategoryAdditions,
  hasCategoryRemovals,
  hasCategoryReorder,
  hasCategoryChanges,
  hasNumericValueOffsets,
  getNumericValueOffsets,
  getNumericValuesWithoutOffsets,
  getExpansionCategoryValueDeltaData,
  getContractionCategoryValueDeltaData,
  createCategoryOrderDeltaData,
  setCategoryOrderDeltaFactors
} from '../../src/animation/CategoryAnimationData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';

import type { CategoryDeltaData } from '../../src/types/animation';
import type { CategoryData, CategoryValue } from '../../src/types/data';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

const ordinalString = makeConfig({
  categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
  series: [{ property: 'a', renderer: 'bar' }]
});
const ordinalKeyed = makeConfig({
  categoryAxis: { property: 'label', keyProperty: 'c', type: 'string', scale: 'ordinal' },
  series: [{ property: 'a', renderer: 'bar' }]
});
const linearNumber = makeConfig({
  categoryAxis: { property: 'c', type: 'number', scale: 'linear' },
  series: [{ property: 'a', renderer: 'bar' }]
});
const linearDate = makeConfig({
  categoryAxis: { property: 'c', type: 'date', scale: 'linear' },
  series: [{ property: 'a', renderer: 'bar' }]
});
const ordinalDate = makeConfig({
  categoryAxis: { property: 'c', type: 'date', scale: 'ordinal' },
  series: [{ property: 'a', renderer: 'bar' }]
});

function categoryDataFor(config: EnhancedMochartConfig, values: readonly CategoryValue[]): CategoryData {
  return getCategoryData(config.categoryAxis, new ArrayOfObjectsDataProvider(values.map(c => ({ c, a: 1 }))));
}

function deltaFor(config: EnhancedMochartConfig, oldValues: readonly CategoryValue[], newValues: readonly CategoryValue[]): CategoryDeltaData {
  return getCategoryDeltaData(config.categoryAxis, categoryDataFor(config, oldValues), categoryDataFor(config, newValues));
}

const T0 = Date.UTC(2026, 0, 1);
const DAY = 24 * 60 * 60 * 1000;
const day = (index: number) => new Date(T0 + index * DAY);

describe('getInitialCategoryDeltaData', () => {
  it('treats every value as added with identity indices and zero outer counts', () => {
    const delta = getInitialCategoryDeltaData(ordinalString.categoryAxis, categoryDataFor(ordinalString, ['a', 'b', 'c']));
    expect(delta.values.old).toEqual([]);
    expect(delta.values.merged).toEqual(['a', 'b', 'c']);
    expect(delta.values.added).toEqual(['a', 'b', 'c']);
    expect(delta.values.removed).toEqual([]);
    expect(delta.values.new).toEqual(['a', 'b', 'c']);
    expect(delta.values.displayMerged).toEqual(['a', 'b', 'c']);
    expect(delta.indices).toEqual({ old: [], new: [0, 1, 2], added: [0, 1, 2], removed: [], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 0, after: 0 } });
    expect(hasCategoryChanges(delta)).toBe(true);
  });
});

describe('getCategoryDeltaData with an ordinal axis (order-preserving merge)', () => {
  it('reports no changes when the values are identical', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], ['a', 'b']);
    expect(delta.values.merged).toEqual(['a', 'b']);
    expect(delta.values.added).toEqual([]);
    expect(delta.values.removed).toEqual([]);
    expect(delta.indices).toEqual({ old: [0, 1], new: [0, 1], added: [], removed: [], reordered: false });
    expect(hasCategoryChanges(delta)).toBe(false);
  });

  it('uses the new order verbatim when values are only added', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], ['a', 'x', 'b', 'y']);
    expect(delta.values.merged).toEqual(['a', 'x', 'b', 'y']);
    expect(delta.values.added).toEqual(['x', 'y']);
    expect(delta.values.removed).toEqual([]);
    expect(delta.indices).toEqual({ old: [0, 2], new: [0, 1, 2, 3], added: [1, 3], removed: [], reordered: false });
    // 'y' sits after the last kept value; nothing was added before the first kept value
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 1 }, removed: { before: 0, after: 0 } });
    expect(hasCategoryAdditions(delta)).toBe(true);
    expect(hasCategoryRemovals(delta)).toBe(false);
  });

  // Regression: the first/last kept merged position was read off the ends of a reordered old→merged
  // mapping, so an interior addition counted as both "before" and "after" the kept range.
  it('does not count an interior addition as outer when the kept values are reordered', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['c', 'd', 'a', 'b']);
    expect(delta.values.merged).toEqual(['c', 'd', 'a', 'b']);
    expect(delta.indices.old).toEqual([2, 3, 0]);
    expect(delta.indices.reordered).toBe(true);
    expect(delta.outerCounts.added).toEqual({ before: 0, after: 0 });
  });

  it('keeps a removed middle value after its preceding kept neighbour', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'c']);
    expect(delta.values.merged).toEqual(['a', 'b', 'c']);
    expect(delta.values.removed).toEqual(['b']);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [0, 2], added: [], removed: [1], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 0, after: 0 } });
    expect(hasCategoryRemovals(delta)).toBe(true);
    expect(hasCategoryReorder(delta)).toBe(false);
  });

  it('keeps a removed leading value before its following kept neighbour', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['b', 'c']);
    expect(delta.values.merged).toEqual(['a', 'b', 'c']);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [1, 2], added: [], removed: [0], reordered: false });
    // the removed value is before the first surviving value
    expect(delta.outerCounts.removed).toEqual({ before: 1, after: 0 });
  });

  it('keeps a removed trailing value after its preceding kept neighbour', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'b']);
    expect(delta.values.merged).toEqual(['a', 'b', 'c']);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [0, 1], added: [], removed: [2], reordered: false });
    expect(delta.outerCounts.removed).toEqual({ before: 0, after: 1 });
  });

  it('keeps consecutive removed values together in their original order', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c', 'd'], ['a', 'd']);
    expect(delta.values.merged).toEqual(['a', 'b', 'c', 'd']);
    expect(delta.values.removed).toEqual(['b', 'c']);
    expect(delta.indices).toEqual({ old: [0, 1, 2, 3], new: [0, 3], added: [], removed: [1, 2], reordered: false });
  });

  it('places a removed value before the value that replaced it', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(delta.values.merged).toEqual(['a', 'b', 'x', 'c']);
    expect(delta.values.added).toEqual(['x']);
    expect(delta.values.removed).toEqual(['b']);
    expect(delta.indices).toEqual({ old: [0, 1, 3], new: [0, 2, 3], added: [2], removed: [1], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 0, after: 0 } });
  });

  it('places a removed leading value after a new leading value, next to its kept neighbour', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], ['x', 'b']);
    expect(delta.values.merged).toEqual(['x', 'a', 'b']);
    expect(delta.indices).toEqual({ old: [1, 2], new: [0, 2], added: [0], removed: [1], reordered: false });
    // 'x' is before the first kept value; 'a' is not before the first new value 'x'
    expect(delta.outerCounts).toEqual({ added: { before: 1, after: 0 }, removed: { before: 0, after: 0 } });
  });

  it('appends the new values after the old ones when every value is replaced', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], ['x', 'y']);
    expect(delta.values.merged).toEqual(['a', 'b', 'x', 'y']);
    expect(delta.values.added).toEqual(['x', 'y']);
    expect(delta.values.removed).toEqual(['a', 'b']);
    expect(delta.indices).toEqual({ old: [0, 1], new: [2, 3], added: [2, 3], removed: [0, 1], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 2 }, removed: { before: 2, after: 0 } });
  });

  it('keeps the old values when everything is removed and nothing added', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], []);
    expect(delta.values.merged).toEqual(['a', 'b']);
    expect(delta.values.removed).toEqual(['a', 'b']);
    expect(delta.indices).toEqual({ old: [0, 1], new: [], added: [], removed: [0, 1], reordered: false });
    // no new values, so there is nothing to count the removals against
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 0, after: 0 } });
  });

  it('adds everything when starting from no values', () => {
    const delta = deltaFor(ordinalString, [], ['a', 'b']);
    expect(delta.values.merged).toEqual(['a', 'b']);
    expect(delta.values.added).toEqual(['a', 'b']);
    expect(delta.indices).toEqual({ old: [], new: [0, 1], added: [0, 1], removed: [], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 0, after: 0 } });
  });

  it('flags a pure reorder and merges to the new order', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['c', 'a', 'b']);
    expect(delta.values.merged).toEqual(['c', 'a', 'b']);
    expect(delta.values.added).toEqual([]);
    expect(delta.values.removed).toEqual([]);
    expect(delta.indices).toEqual({ old: [1, 2, 0], new: [0, 1, 2], added: [], removed: [], reordered: true });
    expect(hasCategoryReorder(delta)).toBe(true);
    expect(hasCategoryChanges(delta)).toBe(true);
  });

  it('flags a reorder combined with a removal and keeps the removed value by its old neighbour', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['c', 'a']);
    expect(delta.values.merged).toEqual(['c', 'a', 'b']);
    expect(delta.values.removed).toEqual(['b']);
    expect(delta.indices).toEqual({ old: [1, 2, 0], new: [0, 1], added: [], removed: [2], reordered: true });
    expect(delta.outerCounts.removed).toEqual({ before: 0, after: 1 });
  });

  it('does not flag a reorder when only additions and removals shift the indices', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['x', 'a', 'c', 'y']);
    expect(delta.values.merged).toEqual(['x', 'a', 'b', 'c', 'y']);
    expect(delta.indices.old).toEqual([1, 2, 3]);
    expect(delta.indices.reordered).toBe(false);
    expect(delta.outerCounts).toEqual({ added: { before: 1, after: 1 }, removed: { before: 0, after: 0 } });
  });

  it('merges Date values by time, so fresh Date instances match', () => {
    const delta = deltaFor(ordinalDate, [day(0), day(1), day(2)], [day(0), day(2), day(3)]);
    expect(delta.values.merged.map(v => (v as Date).getTime())).toEqual([0, 1, 2, 3].map(i => day(i).getTime()));
    expect(delta.values.added).toEqual([day(3)]);
    expect(delta.values.removed).toEqual([day(1)]);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [0, 2, 3], added: [3], removed: [1], reordered: false });
  });
});

describe('getCategoryDeltaData at large category counts', () => {
  // Regression: the outer-count helpers spread the per-category index arrays into Math.min/Math.max,
  // which overflows the call stack somewhere above ~150k categories
  it('handles 200k categories without a stack overflow', () => {
    const values = Array.from({ length: 200000 }, (_, i) => 'c' + i);
    const delta = deltaFor(ordinalString, values, values.slice(0, values.length - 1));
    expect(delta.values.removed).toEqual(['c199999']);
    expect(delta.values.added).toEqual([]);
    expect(delta.outerCounts.removed).toEqual({ before: 0, after: 1 });
  });
});

describe('getCategoryDeltaData with a linear axis (sorted merge)', () => {
  it('interleaves removed values into the new values by value', () => {
    const delta = deltaFor(linearNumber, [1, 2, 3, 4], [2, 3, 5]);
    expect(delta.values.merged).toEqual([1, 2, 3, 4, 5]);
    expect(delta.values.added).toEqual([5]);
    expect(delta.values.removed).toEqual([1, 4]);
    expect(delta.indices).toEqual({ old: [0, 1, 2, 3], new: [1, 2, 4], added: [4], removed: [0, 3], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 1 }, removed: { before: 1, after: 0 } });
  });

  it('reuses the new values when nothing was removed', () => {
    const newData = categoryDataFor(linearNumber, [1, 2, 3]);
    const delta = getCategoryDeltaData(linearNumber.categoryAxis, categoryDataFor(linearNumber, [2]), newData);
    expect(delta.values.merged).toBe(newData.values.key);
    expect(delta.indices).toEqual({ old: [1], new: [0, 1, 2], added: [0, 2], removed: [], reordered: false });
    expect(delta.outerCounts.added).toEqual({ before: 1, after: 1 });
  });

  it('keeps the old values when everything is removed and nothing added', () => {
    const oldData = categoryDataFor(linearNumber, [1, 2]);
    const delta = getCategoryDeltaData(linearNumber.categoryAxis, oldData, categoryDataFor(linearNumber, []));
    expect(delta.values.merged).toBe(oldData.values.key);
    expect(delta.indices).toEqual({ old: [0, 1], new: [], added: [], removed: [0, 1], reordered: false });
  });

  it('sorts a full replacement by value rather than appending', () => {
    const delta = deltaFor(linearNumber, [1, 3, 5], [2, 4]);
    expect(delta.values.merged).toEqual([1, 2, 3, 4, 5]);
    expect(delta.indices).toEqual({ old: [0, 2, 4], new: [1, 3], added: [1, 3], removed: [0, 2, 4], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 0 }, removed: { before: 1, after: 1 } });
  });

  // Regression: the merge assumed ascending data, so a sliding window over a descending axis (accepted by
  // the validator) put the removed values at the wrong end and flagged a reorder
  it('follows a descending axis when interleaving removed values', () => {
    const delta = deltaFor(linearNumber, [10, 9, 8], [9, 8, 7]);
    expect(delta.values.merged).toEqual([10, 9, 8, 7]);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [1, 2, 3], added: [3], removed: [0], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 1 }, removed: { before: 1, after: 0 } });
  });

  it('follows a descending date axis by instant', () => {
    const delta = deltaFor(linearDate, [day(3), day(2), day(1)], [day(2).toISOString(), day(1).toISOString(), day(0).toISOString()]);
    expect(delta.values.merged.map(v => new Date(v as string | Date).getTime())).toEqual([3, 2, 1, 0].map(i => day(i).getTime()));
    expect(delta.indices.reordered).toBe(false);
  });

  it('takes the direction from the old values when the new set is too short to tell', () => {
    const delta = deltaFor(linearNumber, [10, 9, 8], [9]);
    expect(delta.values.merged).toEqual([10, 9, 8]);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [1], added: [], removed: [0, 2], reordered: false });
  });

  it('sorts Date values by time across fresh instances', () => {
    const delta = deltaFor(linearDate, [day(0), day(1), day(2)], [day(1), day(3)]);
    expect(delta.values.merged.map(v => (v as Date).getTime())).toEqual([0, 1, 2, 3].map(i => day(i).getTime()));
    expect(delta.values.removed).toEqual([day(0), day(2)]);
    expect(delta.values.added).toEqual([day(3)]);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [1, 3], added: [3], removed: [0, 2], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 1 }, removed: { before: 1, after: 0 } });
  });

  it('matches one instant across Date, ISO string and epoch representations', () => {
    const delta = deltaFor(linearDate, [day(0), day(1), day(2)], [day(0).toISOString(), day(1).getTime(), day(3)]);
    expect(delta.values.removed).toEqual([day(2)]);
    expect(delta.values.added).toEqual([day(3)]);
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [0, 1, 3], added: [3], removed: [2], reordered: false });
    expect(oldIndexForNewIndex(delta, 1)).toBe(1);
    expect(newIndexForOldIndex(delta, 0)).toBe(0);
    expect(newIndexForOldIndex(delta, 2)).toBe(-1);
    expect(newIndexForMergedIndex(delta, 3)).toBe(2);
  });

  it('interleaves a removed Date among ISO string new values by instant', () => {
    const delta = deltaFor(linearDate, [day(0), day(1), day(2)], [day(0).toISOString(), day(1).toISOString(), day(3).toISOString()]);
    expect(delta.values.merged.map(v => new Date(v as string | Date).getTime())).toEqual([0, 1, 2, 3].map(i => day(i).getTime()));
    expect(delta.indices).toEqual({ old: [0, 1, 2], new: [0, 1, 3], added: [3], removed: [2], reordered: false });
    expect(delta.outerCounts).toEqual({ added: { before: 0, after: 1 }, removed: { before: 0, after: 0 } });
  });
});

describe('indexOfCategoryValue', () => {
  it('matches date category values by instant on a date axis', () => {
    expect(indexOfCategoryValue(linearDate.categoryAxis, [day(0), day(1)], day(1).toISOString())).toBe(1);
    expect(indexOfCategoryValue(ordinalDate.categoryAxis, [day(0).getTime(), day(1).toISOString()], day(0))).toBe(0);
    expect(indexOfCategoryValue(linearDate.categoryAxis, [day(0)], day(2))).toBe(-1);
  });

  it('matches by string form on other axes', () => {
    expect(indexOfCategoryValue(ordinalString.categoryAxis, ['a', 'b'], 'b')).toBe(1);
    expect(indexOfCategoryValue(ordinalKeyed.categoryAxis, [1, 2], '2')).toBe(1);
  });
});

describe('displayMerged', () => {
  const displayDataFor = (rows: { c: string; label: string }[]) =>
    getCategoryData(ordinalKeyed.categoryAxis, new ArrayOfObjectsDataProvider(rows.map(row => ({ ...row, a: 1 }))));

  it('reuses the new display values when nothing was removed', () => {
    const newData = displayDataFor([{ c: 'a', label: 'A2' }, { c: 'x', label: 'X' }]);
    const delta = getCategoryDeltaData(ordinalKeyed.categoryAxis, displayDataFor([{ c: 'a', label: 'A' }]), newData);
    expect(delta.values.displayMerged).toBe(newData.values.display);
  });

  it('keeps removed display labels and takes the new label for kept values', () => {
    const delta = getCategoryDeltaData(
      ordinalKeyed.categoryAxis,
      displayDataFor([{ c: 'a', label: 'A' }, { c: 'b', label: 'B' }, { c: 'c', label: 'C' }]),
      displayDataFor([{ c: 'a', label: 'A2' }, { c: 'c', label: 'C2' }])
    );
    expect(delta.values.merged).toEqual(['a', 'b', 'c']);
    expect(delta.values.displayMerged).toEqual(['A2', 'B', 'C2']);
  });

  it('falls back to the merged key values without a key property', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'c']);
    expect(delta.values.displayMerged).toEqual(['a', 'b', 'c']);
  });
});

describe('index lookups', () => {
  const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'x', 'c']);
  // merged: a b x c

  it('maps new indices onto the merged list', () => {
    expect(mergedIndexForNewIndex(delta, 0)).toBe(0);
    expect(mergedIndexForNewIndex(delta, 1)).toBe(2);
    expect(mergedIndexForNewIndex(delta, 2)).toBe(3);
  });

  // all three lookups answer -1 for an index the list does not hold; startFocusTween reads the
  // undefined this used to return as "no override" and focuses the unmapped index instead
  it('answers -1 for an out-of-range index in every direction', () => {
    expect(mergedIndexForNewIndex(delta, 3)).toBe(-1);
    expect(mergedIndexForNewIndex(delta, 99)).toBe(-1);
    expect(oldIndexForNewIndex(delta, 99)).toBe(-1);
    expect(newIndexForMergedIndex(delta, 99)).toBe(-1);
    expect(newIndexForOldIndex(delta, 99)).toBe(-1);
  });

  it('maps between old and new indices, with -1 for added and removed values', () => {
    expect(oldIndexForNewIndex(delta, 0)).toBe(0);
    expect(oldIndexForNewIndex(delta, 1)).toBe(-1);
    expect(oldIndexForNewIndex(delta, 2)).toBe(2);
    expect(newIndexForOldIndex(delta, 1)).toBe(-1);
    expect(newIndexForOldIndex(delta, 2)).toBe(2);
  });

  it('maps merged indices back to new indices, with -1 for removed values', () => {
    expect(newIndexForMergedIndex(delta, 1)).toBe(-1);
    expect(newIndexForMergedIndex(delta, 2)).toBe(1);
    expect(newIndexForMergedIndex(delta, 3)).toBe(2);
  });
});

describe('getMergedNumericValues', () => {
  it('starts kept ordinal values at their old positions and fills the rest by merged index', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'x', 'c']);
    // merged a b x c: c starts at its old slot 2 (shared with x) and tweens to 3
    expect(getMergedNumericValues(ordinalString.categoryAxis, [0, 1, 2], delta)).toEqual([0, 1, 2, 2]);
  });

  it('carries mid-animation ordinal offsets through to the merged positions', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(getMergedNumericValues(ordinalString.categoryAxis, [0, 1.5, 2.25], delta)).toEqual([0, 1.5, 2, 2.25]);
  });

  it('starts reordered ordinal values at their old positions', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['c', 'a', 'b']);
    // merged c a b: old positions a=0 b=1 c=2 land at merged indices 1 2 0
    expect(getMergedNumericValues(ordinalString.categoryAxis, [0, 1, 2], delta)).toEqual([2, 0, 1]);
  });

  it('returns null for a linear axis', () => {
    const delta = deltaFor(linearNumber, [1, 2], [1, 3]);
    expect(getMergedNumericValues(linearNumber.categoryAxis, [1, 2], delta)).toBeNull();
  });
});

describe('ordinal numeric offsets', () => {
  const withNumeric = (config: EnhancedMochartConfig, values: readonly CategoryValue[], numeric: number[]): CategoryData => {
    const data = categoryDataFor(config, values);
    return { ...data, values: { ...data.values, numeric } };
  };

  it('detects and inverts per-index offsets on an ordinal axis', () => {
    const data = withNumeric(ordinalString, ['a', 'b', 'c'], [0, 1.5, 2]);
    expect(hasNumericValueOffsets(ordinalString.categoryAxis, data)).toBe(true);
    expect(getNumericValueOffsets(ordinalString.categoryAxis, data)).toEqual([0, -0.5, 0]);
    expect(getNumericValuesWithoutOffsets(data)).toEqual([0, 1, 2]);
  });

  it('reports no offsets when ordinal values sit on their indices', () => {
    const data = categoryDataFor(ordinalString, ['a', 'b', 'c']);
    expect(hasNumericValueOffsets(ordinalString.categoryAxis, data)).toBe(false);
    expect(getNumericValueOffsets(ordinalString.categoryAxis, data)).toBeNull();
  });

  it('never reports offsets for a linear axis', () => {
    const data = categoryDataFor(linearNumber, [10, 20]);
    expect(hasNumericValueOffsets(linearNumber.categoryAxis, data)).toBe(false);
    expect(getNumericValueOffsets(linearNumber.categoryAxis, data)).toBeNull();
  });
});

describe('ordinal expansion and contraction category deltas', () => {
  const domain: [number, number] = [0, 4];

  it('expands kept values from their old positions to their merged positions on additions', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'x', 'c']);
    const prev = { categoryData: categoryDataFor(ordinalString, ['a', 'b', 'c']) };
    const next = { categoryData: categoryDataFor(ordinalString, ['a', 'x', 'c']) };
    const result = getExpansionCategoryValueDeltaData(ordinalString.categoryAxis, delta, prev, next, domain);
    expect(result).toEqual({ start: [0, 1, 2], deltas: [0, 0, 1], deltaPercentage: 1 / 4, end: [0, 1, 3] });
  });

  it('has no expansion delta without additions', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'c']);
    const prev = { categoryData: categoryDataFor(ordinalString, ['a', 'b', 'c']) };
    const next = { categoryData: categoryDataFor(ordinalString, ['a', 'c']) };
    expect(getExpansionCategoryValueDeltaData(ordinalString.categoryAxis, delta, prev, next, domain)).toBeNull();
  });

  it('contracts the new values from their merged positions to their final positions on removals', () => {
    const delta = deltaFor(ordinalString, ['a', 'b', 'c'], ['a', 'c']);
    // the value phase ends with the new values sitting at their merged indices (a=0, c=2)
    const next = { categoryData: categoryDataFor(ordinalString, ['a', 'c']) };
    const prev = { categoryData: getCategoryDataWithNumericValues(next.categoryData, delta.indices.new) };
    const result = getContractionCategoryValueDeltaData(ordinalString.categoryAxis, delta, prev, next, domain);
    expect(result).toEqual({ start: [0, 2], deltas: [0, -1], deltaPercentage: 1 / 4, end: [0, 1] });
  });

  it('has no contraction delta without removals', () => {
    const delta = deltaFor(ordinalString, ['a', 'c'], ['a', 'b', 'c']);
    const next = { categoryData: categoryDataFor(ordinalString, ['a', 'b', 'c']) };
    const prev = { categoryData: getCategoryDataWithNumericValues(next.categoryData, delta.indices.new) };
    expect(getContractionCategoryValueDeltaData(ordinalString.categoryAxis, delta, prev, next, domain)).toBeNull();
  });

  // every sibling pacing denominator is guarded the same way; a collapsed domain paces nothing.
  // Defensive: the callers skip the delta entirely when the domain does not move, so no update
  // reaches this with a zero domain today.
  it('paces at zero rather than dividing by a collapsed domain', () => {
    const delta = deltaFor(ordinalString, ['a', 'b'], ['a']);
    const next = { categoryData: categoryDataFor(ordinalString, ['a']) };
    const prev = { categoryData: getCategoryDataWithNumericValues(next.categoryData, delta.indices.new) };
    const result = getContractionCategoryValueDeltaData(ordinalString.categoryAxis, delta, prev, next, [0, 0]);
    expect(result!.deltaPercentage).toBe(0);
  });

  it('has no deltas for a linear axis', () => {
    const delta = deltaFor(linearNumber, [1, 2, 3], [1, 3, 4]);
    const prev = { categoryData: categoryDataFor(linearNumber, [1, 2, 3]) };
    const next = { categoryData: categoryDataFor(linearNumber, [1, 3, 4]) };
    expect(getExpansionCategoryValueDeltaData(linearNumber.categoryAxis, delta, prev, next, domain)).toBeNull();
    expect(getContractionCategoryValueDeltaData(linearNumber.categoryAxis, delta, prev, next, domain)).toBeNull();
  });
});

describe('createCategoryOrderDeltaData', () => {
  it('measures ordinal order offsets against the end render domain', () => {
    const start = { categoryData: getCategoryDataWithNumericValues(categoryDataFor(ordinalString, ['a', 'b', 'c']), [0, 1.5, 2]) };
    const end = { categoryData: categoryDataFor(ordinalString, ['a', 'b', 'c']) };
    const offsets = getNumericValueOffsets(ordinalString.categoryAxis, start.categoryData)!;
    const result = createCategoryOrderDeltaData(ordinalString, start, end, offsets);
    expect(result.start).toEqual([0, 1.5, 2]);
    expect(result.deltas).toEqual([0, -0.5, 0]);
    expect(result.deltaPercentage).toBe(0.5 / Number(end.categoryData.renderAxisDomain[1]));
    expect(result.end).toEqual([0, 1, 2]);
  });

  it('is empty without offsets or on a linear axis', () => {
    const ordinal = { categoryData: categoryDataFor(ordinalString, ['a', 'b']) };
    const linear = { categoryData: categoryDataFor(linearNumber, [1, 2]) };
    expect(createCategoryOrderDeltaData(ordinalString, ordinal, ordinal, null)).toEqual({ deltaPercentage: 0, deltaFactor: 0, deltas: [] });
    expect(createCategoryOrderDeltaData(linearNumber, linear, linear, [0, 1])).toEqual({ deltaPercentage: 0, deltaFactor: 0, deltas: [] });
  });

  it('sets the delta factor from the phase percentage, leaving zero deltas alone', () => {
    const scaled = { deltaPercentage: 0.25, deltaFactor: 0, deltas: [1] };
    setCategoryOrderDeltaFactors(scaled, 0.5);
    expect(scaled.deltaFactor).toBe(2);
    const empty = { deltaPercentage: 0, deltaFactor: 0, deltas: [] };
    setCategoryOrderDeltaFactors(empty, 0.5);
    expect(empty.deltaFactor).toBe(0);
  });
});
