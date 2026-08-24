import { NONE, SCALE_ORDINAL, TYPE_DATE } from '../config/core/constants';
import { getCategoryValueKey } from '../data/CategoryValue';
import { getMaxAbsoluteValue } from '../utils/utils';
import type { CategoryAxisConfig } from '../types/config';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { CategoryAxisDomain, CategoryData, CategoryValue } from '../types/data';
import type {
  CompleteNumericArrayDelta,
  CategoryDeltaData,
  CategoryMergedIndicesData,
  CategoryMergedValuesData,
  NumericArrayDelta,
  OuterChangeCounts
} from '../types/animation';

type CategoryMapKey = string;
type CategoryMapKeyAccessor = (value: CategoryValue) => CategoryMapKey;
type CategoryValueIsLess = (left: CategoryValue, right: CategoryValue) => boolean;
type CategoryIndexMap = Record<CategoryMapKey, number | undefined>;
type CategoryMergedValuesWithoutDisplay = Omit<CategoryMergedValuesData, 'displayMerged'>;
type ChartDataWithCategories = { categoryData: CategoryData };

function categoryMapKeyFor(categoryAxisConfig: CategoryAxisConfig): CategoryMapKeyAccessor {
  return value => getCategoryValueKey(categoryAxisConfig, value);
}

/** indexOf by the merge keying: date category values compare by instant, not representation or identity. */
export function indexOfCategoryValue(categoryAxisConfig: CategoryAxisConfig, values: readonly CategoryValue[], value: CategoryValue): number {
  const getMapKey = categoryMapKeyFor(categoryAxisConfig);
  const key = getMapKey(value);
  for (let i = 0; i < values.length; i++) {
    if (getMapKey(values[i]) === key) {
      return i;
    }
  }
  return -1;
}

// orders by the same coercion the merge keys use, so Date, ISO string and epoch forms of one instant compare by instant;
// the validator accepts a descending linear axis, so the sorted merge follows the data's own direction
function categoryValueIsLessFor(categoryAxisConfig: CategoryAxisConfig, categoryValuesOld: readonly CategoryValue[], categoryValuesNew: readonly CategoryValue[]): CategoryValueIsLess {
  const isLess: CategoryValueIsLess = categoryAxisConfig.type === TYPE_DATE && categoryAxisConfig.keyProperty === NONE
    ? (left, right) => new Date(left as string | number | Date).getTime() < new Date(right as string | number | Date).getTime()
    : categoryValueIsLess;
  const directional = categoryValuesNew.length > 1 ? categoryValuesNew : categoryValuesOld;
  const descending = directional.length > 1 && isLess(directional[directional.length - 1], directional[0]);
  return descending ? (left, right) => isLess(right, left) : isLess;
}

function categoryValueIsLess(left: CategoryValue, right: CategoryValue): boolean {
  if (typeof left === 'string' && typeof right === 'string') {
    return left < right;
  }
  const leftValue = left instanceof Date ? left.getTime() : Number(left);
  const rightValue = right instanceof Date ? right.getTime() : Number(right);
  return leftValue < rightValue;
}

export function getInitialCategoryDeltaData(_categoryAxisConfig: CategoryAxisConfig, newCategoryData: CategoryData): CategoryDeltaData {
  const indices = newCategoryData.values.key.map((_value, index) => index);
  return {
    values: {
      old: [],
      merged: newCategoryData.values.key,
      added: newCategoryData.values.key,
      removed: [],
      new: newCategoryData.values.key,
      displayMerged: newCategoryData.values.display
    },
    indices: {
      old: [],
      new: indices,
      added: indices,
      removed: [],
      reordered: false
    },
    outerCounts: {
      added: {
        before: 0,
        after: 0
      },
      removed: {
        before: 0,
        after: 0
      }
    }
  };
}

export function getCategoryDeltaData(categoryAxisConfig: CategoryAxisConfig, oldCategoryData: CategoryData, newCategoryData: CategoryData): CategoryDeltaData {
  // *** It is assumed that all rawCategory values are pre-sorted, unique, and not undefined
  const categoryValuesOld = oldCategoryData.values.key;
  const categoryValuesNew = newCategoryData.values.key;

  const getMapKey = categoryMapKeyFor(categoryAxisConfig);
  const isLess = categoryValueIsLessFor(categoryAxisConfig, categoryValuesOld, categoryValuesNew);
  const mergedValuesWithoutDisplay = getCategoryMergedValuesData(categoryValuesOld, categoryValuesNew, categoryAxisConfig.scale !== SCALE_ORDINAL, getMapKey, isLess);
  const mergedIndicesData = getCategoryMergedIndicesData(categoryValuesOld, categoryValuesNew, mergedValuesWithoutDisplay, getMapKey);
  const mergedOuterCounts = getCategoryMergedOuterCountsData(mergedIndicesData);
  const mergedValuesData: CategoryMergedValuesData = {
    ...mergedValuesWithoutDisplay,
    displayMerged: getCategoryMergedDisplayValues(categoryAxisConfig, oldCategoryData, newCategoryData, mergedValuesWithoutDisplay, mergedIndicesData)
  };

  return {
    values: mergedValuesData,
    indices: mergedIndicesData,
    outerCounts: mergedOuterCounts
  };
}

export function mergedIndexForNewIndex(categoryDeltaData: CategoryDeltaData, newCategoryIndex: number): number {
  return categoryDeltaData.indices.new[newCategoryIndex];
}

// the merged indices already carry the keyed old/new matching, so these need no re-keying
export function oldIndexForNewIndex(categoryDeltaData: CategoryDeltaData, newCategoryIndex: number): number {
  return categoryDeltaData.indices.old.indexOf(categoryDeltaData.indices.new[newCategoryIndex]);
}

export function newIndexForMergedIndex(categoryDeltaData: CategoryDeltaData, mergedCategoryIndex: number): number {
  return categoryDeltaData.indices.new.indexOf(mergedCategoryIndex);
}

export function newIndexForOldIndex(categoryDeltaData: CategoryDeltaData, oldCategoryIndex: number): number {
  return categoryDeltaData.indices.new.indexOf(categoryDeltaData.indices.old[oldCategoryIndex]);
}

function getCategoryMergedDisplayValues(
  categoryAxisConfig: CategoryAxisConfig,
  oldCategoryData: CategoryData,
  newCategoryData: CategoryData,
  mergedValuesData: CategoryMergedValuesWithoutDisplay,
  mergedIndicesData: CategoryMergedIndicesData
): readonly CategoryValue[] {
  let displayMerged: readonly CategoryValue[] = mergedValuesData.merged;
  if (categoryAxisConfig.keyProperty !== NONE) {
    if (mergedIndicesData.removed.length > 0) {
      const mutableDisplayMerged = mergedValuesData.merged.slice();
      setValuesForIndices(mutableDisplayMerged, oldCategoryData.values.display, mergedIndicesData.old);
      setValuesForIndices(mutableDisplayMerged, newCategoryData.values.display, mergedIndicesData.new);
      displayMerged = mutableDisplayMerged;
    }
    else {
      displayMerged = newCategoryData.values.display;
    }
  }
  return displayMerged;
}

function setValuesForIndices(targetValues: CategoryValue[], sourceValues: readonly CategoryValue[], indicesForValues: readonly number[]): void {
  if (sourceValues !== undefined) {
    const count = sourceValues.length;
    for (let i=0; i<count; i++) {
      targetValues[indicesForValues[i]] = sourceValues[i];
    }
  }
}

function getValueToNewIndexMap(values: readonly CategoryValue[], newValues: readonly CategoryValue[], getMapKey: CategoryMapKeyAccessor): CategoryIndexMap {
  const valueToNewIndexMap: CategoryIndexMap = Object.create(null); // null proto: keyed by user data category values
  let i, count = values.length;
  for (i=0; i<count; i++) {
    valueToNewIndexMap[getMapKey(values[i])] = -1;
  }
  count = newValues.length;
  for (i=0; i<count; i++) {
    if (valueToNewIndexMap[getMapKey(newValues[i])] !== undefined) {
      valueToNewIndexMap[getMapKey(newValues[i])] = i;
    }
  }
  return valueToNewIndexMap;
}

function getValueToIndexMap(values: readonly CategoryValue[], getMapKey: CategoryMapKeyAccessor): CategoryIndexMap {
  const valueToIndexMap: CategoryIndexMap = Object.create(null);
  const count = values.length;
  for (let i=0; i<count; i++) {
    valueToIndexMap[getMapKey(values[i])] = i;
  }
  return valueToIndexMap;
}

function getMappedIndicesForValues(valueToIndexMap: CategoryIndexMap, values: readonly CategoryValue[], getMapKey: CategoryMapKeyAccessor): number[] {
  const indices: number[] = [];
  const count = values.length;
  for (let i=0; i<count; i++) {
    const index = valueToIndexMap[getMapKey(values[i])];
    if (index === undefined) {
      throw new Error('Category value is missing from the merged index');
    }
    indices.push(index);
  }
  return indices;
}

function getValuesWithIndex(
  valueToIndexMap: CategoryIndexMap,
  values: readonly CategoryValue[],
  index: number | undefined,
  getMapKey: CategoryMapKeyAccessor
): CategoryValue[] {
  const matchedValues: CategoryValue[] = [];
  const count = values.length;
  for (let i=0; i<count; i++) {
    if (valueToIndexMap[getMapKey(values[i])] === index) {
      matchedValues.push(values[i]);
    }

  }
  return matchedValues;
}

export function getMergedNumericValues(categoryAxisConfig: CategoryAxisConfig, oldNumericValues: readonly number[], categoryDeltaData: CategoryDeltaData): number[] | null {
  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    const mergedCount = categoryDeltaData.values.merged.length;
    const numericValues: number[] = [];
    for (let i = 0; i < mergedCount; i++) {
      numericValues.push(i);
    }
    const oldIndices = categoryDeltaData.indices.old;
    const oldCount = oldIndices.length;
    for (let i = 0; i < oldCount; i++) {
      numericValues[oldIndices[i]] = oldNumericValues[i];
    }
    return numericValues;
  }
  else {
    return null;
  }
}

function getCategoryMergedValuesData(
  categoryValuesOld: readonly CategoryValue[],
  categoryValuesNew: readonly CategoryValue[],
  sort: boolean,
  getMapKey: CategoryMapKeyAccessor,
  isLess: CategoryValueIsLess
): CategoryMergedValuesWithoutDisplay {
  const valueToNewIndexMap = getValueToNewIndexMap(categoryValuesOld, categoryValuesNew, getMapKey);
  const added = getValuesWithIndex(valueToNewIndexMap, categoryValuesNew, undefined, getMapKey);
  const removed = getValuesWithIndex(valueToNewIndexMap, categoryValuesOld, -1, getMapKey);
  const merged = getCategoryValuesMerged(categoryValuesOld, categoryValuesNew, removed, added, valueToNewIndexMap, sort, getMapKey, isLess);

  return {
    old: categoryValuesOld,
    merged,
    added,
    removed,
    new: categoryValuesNew
  };
}

function numbersAreAscending(values: readonly number[]): boolean {
  const count = values.length;
  if (count > 1) {
    let last = values[0];
    let current;
    for (let i = 1; i < count; i++) {
      current = values[i];
      if (current < last) {
        return false;
      }
      last = current;
    }
    return true;
  }
  return true;
}

function getCategoryMergedIndicesData(
  categoryValuesOld: readonly CategoryValue[],
  categoryValuesNew: readonly CategoryValue[],
  mergedValuesData: CategoryMergedValuesWithoutDisplay,
  getMapKey: CategoryMapKeyAccessor
): CategoryMergedIndicesData {
  const valueToIndexMap = getValueToIndexMap(mergedValuesData.merged, getMapKey);
  const oldIndices = getMappedIndicesForValues(valueToIndexMap, categoryValuesOld, getMapKey);
  return {
    old: oldIndices,
    new: getMappedIndicesForValues(valueToIndexMap, categoryValuesNew, getMapKey),
    added: getMappedIndicesForValues(valueToIndexMap, mergedValuesData.added, getMapKey),
    removed: getMappedIndicesForValues(valueToIndexMap, mergedValuesData.removed, getMapKey),
    reordered: !numbersAreAscending(oldIndices)
  };
}

function getCategoryMergedOuterCountsData(mergedIndicesData: CategoryMergedIndicesData): CategoryDeltaData['outerCounts'] {
  return {
    added: getCategoryChangedOuterCountsData(mergedIndicesData.old, mergedIndicesData.added),
    removed: getCategoryChangedOuterCountsData(mergedIndicesData.new, mergedIndicesData.removed)
  }
}

function getCategoryChangedOuterCountsData(comparatorIndices: readonly number[], indices: readonly number[]): OuterChangeCounts {
  return {
    before: getBeforeCounts(comparatorIndices, indices),
    after: getAfterCounts(comparatorIndices, indices)
  };
}

export function hasCategoryAdditions(categoryDeltaData: CategoryDeltaData): boolean {
  return categoryDeltaData.values.added.length > 0;
}

export function hasCategoryRemovals(categoryDeltaData: CategoryDeltaData): boolean {
  return categoryDeltaData.values.removed.length > 0;
}

export function hasCategoryReorder(categoryDeltaData: CategoryDeltaData): boolean {
  return categoryDeltaData.indices.reordered;
}

export function hasNumericValueOffsets(categoryAxisConfig: CategoryAxisConfig, categoryData: CategoryData): boolean {
  return categoryAxisConfig.scale === SCALE_ORDINAL && categoryData.values.numeric.some((v, i) => v !== i);
}

export function getNumericValueOffsets(categoryAxisConfig: CategoryAxisConfig, categoryData: CategoryData): number[] | null {
  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    const offsets = categoryData.values.numeric.map((v, i) => i - v);
    return offsets.some(o => o !== 0) ? offsets : null;
  }
  else {
    return null;
  }
}

export function getNumericValuesWithoutOffsets(categoryData: CategoryData): number[] {
  return categoryData.values.numeric.map((_value, index) => index);
}

export function hasCategoryChanges(categoryDeltaData: CategoryDeltaData): boolean {
  return hasCategoryAdditions(categoryDeltaData) || hasCategoryRemovals(categoryDeltaData) || hasCategoryReorder(categoryDeltaData);
}

function getCategoryValuesMerged(
  categoryValuesOld: readonly CategoryValue[],
  categoryValuesNew: readonly CategoryValue[],
  categoryValuesRemoved: readonly CategoryValue[],
  _categoryValuesAdded: readonly CategoryValue[],
  oldCategoryValueToNewIndexMap: CategoryIndexMap,
  sort: boolean,
  getMapKey: CategoryMapKeyAccessor,
  isLess: CategoryValueIsLess
): readonly CategoryValue[] {
  let categoryValuesMerged: readonly CategoryValue[];
  if (sort === false) {
    categoryValuesMerged = getCategoryValuesMergedOrdered(categoryValuesRemoved, categoryValuesNew, categoryValuesOld, oldCategoryValueToNewIndexMap, getMapKey);
  }
  else {
    if (categoryValuesRemoved.length > 0) {
      if (categoryValuesNew.length === 0) { // all categories were removed, and none were added
        categoryValuesMerged = categoryValuesOld;
      }
      else {
        categoryValuesMerged = getCategoryValuesMergedSorted(categoryValuesRemoved, categoryValuesNew, isLess);
      }
    }
    else { // no categories removed, all old categories present in new categories...
      categoryValuesMerged = categoryValuesNew;
    }
  }
  return categoryValuesMerged;
}

// Returns a merged list of category values for the inputs, where the result is sorted by value
function getCategoryValuesMergedSorted(categoryValuesRemoved: readonly CategoryValue[], categoryValuesNew: readonly CategoryValue[], isLess: CategoryValueIsLess): CategoryValue[] {
  const categoryValuesMerged: CategoryValue[] = [];
  const removedLength = categoryValuesRemoved.length;
  const newLength = categoryValuesNew.length;
  const mergedLength = removedLength + newLength;
  let removedIndex = 0;
  let newIndex = 0;
  for (let i = 0; i < mergedLength; i++) {
    if (removedIndex < removedLength && newIndex < newLength) {
      if (isLess(categoryValuesRemoved[removedIndex], categoryValuesNew[newIndex])) {
        categoryValuesMerged.push(categoryValuesRemoved[removedIndex++]);
      }
      else {
        categoryValuesMerged.push(categoryValuesNew[newIndex++]);
      }
    }
    else if (removedIndex < removedLength) {
      categoryValuesMerged.push(categoryValuesRemoved[removedIndex++]);
    }
    else {
      categoryValuesMerged.push(categoryValuesNew[newIndex++]);
    }
  }
  return categoryValuesMerged;
}

// Returns a merged list of category values for the inputs, where the result is a best effort to preserve category value ordering
function getCategoryValuesMergedOrdered(
  categoryValuesRemoved: readonly CategoryValue[],
  categoryValuesNew: readonly CategoryValue[],
  categoryValuesOld: readonly CategoryValue[],
  oldCategoryValueToNewIndexMap: CategoryIndexMap,
  getMapKey: CategoryMapKeyAccessor
): CategoryValue[] {

  if (categoryValuesRemoved.length === categoryValuesOld.length) {
    return categoryValuesOld.concat(categoryValuesNew);
  }

  const oldNewIndices = getMappedIndicesForValues(oldCategoryValueToNewIndexMap, categoryValuesOld, getMapKey);

  const categoryValuesMerged: CategoryValue[] = [];
  // forward then backward pass finds each removed value's nearest kept neighbour; ±0.5 places the
  // removed value after a preceding neighbour or before a following one
  const oldTargetIndices: number[] = [];
  let foundIndex = -1;
  const oldLength = oldNewIndices.length;
  for (let i = 0; i < oldLength; i++) {
    if (oldNewIndices[i] !== -1) {
      foundIndex = oldNewIndices[i] + 0.5;
    }
    oldTargetIndices[i] = foundIndex;
  }
  foundIndex = -1;
  for (let i = oldLength - 1; i >= 0; i--) {
    if (oldNewIndices[i] !== -1) {
      foundIndex = oldNewIndices[i] - 0.5;
    }
    if (oldTargetIndices[i] === -1) {
      oldTargetIndices[i] = foundIndex;
    }
  }

  const oldInsertIndices: number[] = [];
  for (let i = 0; i < oldLength; i++) {
    if (oldNewIndices[i] === -1) {
      oldInsertIndices.push(oldTargetIndices[i]);
    }
  }

  // merge the new list with the removed values at their insert indices, keeping each removed value
  // next to the kept values it was adjacent to (the ±0.5 keeps occurrence order stable)
  let oldIndex = 0;
  let newIndex = 0;
  const mergedLength = categoryValuesRemoved.length + categoryValuesNew.length;
  for (let i = 0; i < mergedLength; i++) {
    if (oldIndex < oldInsertIndices.length) {
      const oldNewIndex = oldInsertIndices[oldIndex];
      if (oldNewIndex <= newIndex) {
        categoryValuesMerged.push(categoryValuesRemoved[oldIndex++]);
      }
      else {
        categoryValuesMerged.push(categoryValuesNew[newIndex++]);
      }
    }
    else {
      categoryValuesMerged.push(categoryValuesNew[newIndex++]);
    }
  }
  return categoryValuesMerged;
}

// comparatorIndices are merged positions in old/new order, so a reordered mapping isn't ascending: take the true min/max
function getBeforeCounts(comparatorIndices: readonly number[], indices: readonly number[]): number {
  let beforeCounts = 0;
  if (comparatorIndices.length > 0) {
    const firstComparatorIndex = Math.min(...comparatorIndices);
    const length = indices.length;
    for (let i=0; i<length; i++) {
      if (indices[i] < firstComparatorIndex) {
        beforeCounts++;
      }
    }
  }
  return beforeCounts;
}

function getAfterCounts(comparatorIndices: readonly number[], indices: readonly number[]): number {
  let afterCounts = 0;
  if (comparatorIndices.length > 0) {
    const lastComparatorIndex = Math.max(...comparatorIndices);
    const length = indices.length;
    for (let i=0; i<length; i++) {
      if (indices[i] > lastComparatorIndex) {
        afterCounts++;
      }
    }
  }
  return afterCounts;
}

export function getExpansionCategoryValueDeltaData(
  categoryAxisConfig: CategoryAxisConfig,
  categoryDeltaData: CategoryDeltaData,
  prevChartData: ChartDataWithCategories,
  _newChartData: ChartDataWithCategories,
  categoryAxisDomain: CategoryAxisDomain
): CompleteNumericArrayDelta | null {
  let categoryValueDeltaData: CompleteNumericArrayDelta | null = null;
  if (categoryAxisConfig.scale === SCALE_ORDINAL)   {
    if (hasCategoryAdditions(categoryDeltaData)) {
      categoryValueDeltaData = getOrdinalCategoryValueDeltaData(prevChartData.categoryData.values.numeric, categoryDeltaData.indices.old, categoryAxisDomain);
    }
  }
  return categoryValueDeltaData;
}

export function getContractionCategoryValueDeltaData(
  categoryAxisConfig: CategoryAxisConfig,
  categoryDeltaData: CategoryDeltaData,
  prevChartData: ChartDataWithCategories,
  newChartData: ChartDataWithCategories,
  categoryAxisDomain: CategoryAxisDomain
): CompleteNumericArrayDelta | null {
  let categoryValueDeltaData: CompleteNumericArrayDelta | null = null;
  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    if (hasCategoryRemovals(categoryDeltaData)) {
      categoryValueDeltaData = getOrdinalCategoryValueDeltaData(prevChartData.categoryData.values.numeric, newChartData.categoryData.values.numeric, categoryAxisDomain);
    }
  }
  return categoryValueDeltaData;
}

function getOrdinalCategoryValueDeltaData(oldNumericValues: number[], newNumericValues: number[], categoryAxisDomain: CategoryAxisDomain): CompleteNumericArrayDelta {
  const deltas: number[] = [];
  const count = oldNumericValues.length;
  for (let i = 0; i < count; i++) {
    deltas.push(newNumericValues[i] - oldNumericValues[i]);
  }
  return {
    start: oldNumericValues,
    deltas,
    deltaPercentage: getMaxAbsoluteValue(deltas) / Number(categoryAxisDomain[1]),
    end: newNumericValues
  }
}

const noDelta: NumericArrayDelta = {
  deltaPercentage: 0,
  deltaFactor: 0,
  deltas: []
}

export function createCategoryOrderDeltaData(
  mochartConfig: EnhancedMochartConfig,
  startChartData: ChartDataWithCategories,
  endChartData: ChartDataWithCategories,
  ordinalCategoryOrderOffets: number[] | null
): NumericArrayDelta {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  if (categoryAxisConfig.scale !== SCALE_ORDINAL || ordinalCategoryOrderOffets === null) {
    return noDelta;
  }
  else {
    return {
      start: startChartData.categoryData.values.numeric,
      deltas: ordinalCategoryOrderOffets,
      deltaPercentage: getMaxAbsoluteValue(ordinalCategoryOrderOffets) / Number(endChartData.categoryData.renderAxisDomain[1]),
      end: endChartData.categoryData.values.numeric
    };
  }
}

export function setCategoryOrderDeltaFactors(categoryOrderDeltaData: NumericArrayDelta, deltaPercentage: number): void {
  if (categoryOrderDeltaData.deltaPercentage !== 0) {
    categoryOrderDeltaData.deltaFactor = deltaPercentage / categoryOrderDeltaData.deltaPercentage;
  }
}
