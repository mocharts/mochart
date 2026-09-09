import type {
  ArrayFocusDeltaData,
  FocusAnimationData,
  FocusData,
  FocusDeltaData,
  FocusPercentage,
  FocusPercentageMap,
  MapFocusDeltaData
} from '../types/animation';

export function getFocusDataForPercent(focusAnimationData: FocusAnimationData, percentage: number): FocusData {
  if (focusAnimationData.start === focusAnimationData.end) {
    return focusAnimationData.start;
  }
  else if (percentage === 0) {
    return focusAnimationData.start;
  }
  else if (percentage === 1) {
    return focusAnimationData.end;
  }
  else {
    const categoryFocusPercentages = getArrayFocusPercentages(focusAnimationData.category, percentage);
    const valueAxisFocusPercentages = getMapFocusPercentages(focusAnimationData.valueAxis, percentage);
    const seriesFocusPercentages = getMapFocusPercentages(focusAnimationData.series, percentage);

    return {
      categoryFocusPercentages,
      valueAxisFocusPercentages,
      seriesFocusPercentages,
      focusedCategoryIndex: focusAnimationData.end.focusedCategoryIndex,
      focusedValueAxisId: focusAnimationData.end.focusedValueAxisId,
      focusedSeriesId: focusAnimationData.end.focusedSeriesId,
      categoryFocusDomainPercentages: focusAnimationData.end.categoryFocusDomainPercentages,
      valueAxisFocusDomainPercentages: focusAnimationData.end.valueAxisFocusDomainPercentages,
      seriesFocusDomainPercentages: focusAnimationData.end.seriesFocusDomainPercentages,
      valueAxisComputedFocusDomainPercentages: focusAnimationData.end.valueAxisComputedFocusDomainPercentages
    };
  }
}

function getFocusPercentage(start: FocusPercentage, percentage: number, deltaFactor: number, delta: number): FocusPercentage {
  if (delta === 0) {
    return start;
  }
  else if (start !== null) {
    return start + percentage * deltaFactor * delta;
  }
  else {
    return percentage * deltaFactor * delta;
  }
}

function getArrayFocusPercentages(focusDeltaData: ArrayFocusDeltaData, percentage: number): FocusPercentage[] {
  // arrays satisfy Record<number, ...> going in, so the assertion only restores the array type coming out
  return getKeyedFocusPercentages<number>(focusDeltaData.start.keys(), focusDeltaData, percentage, () => []) as FocusPercentage[];
}

function getMapFocusPercentages(focusDeltaData: MapFocusDeltaData, percentage: number): FocusPercentageMap {
  return getKeyedFocusPercentages<string>(Object.keys(focusDeltaData.start), focusDeltaData, percentage, () => Object.create(null) as FocusPercentageMap);
}

function getKeyedFocusPercentages<K extends string | number>(
  keys: Iterable<K>,
  { start, deltas, deltaPercentage, deltaPercentages, deltaFactors, end }: FocusDeltaData<Record<K, FocusPercentage>, Record<K, number>>,
  percentage: number,
  createFocusPercentages: () => Record<K, FocusPercentage>
): Record<K, FocusPercentage> {
  if (start === end) {
    return start;
  }
  else if (deltaPercentage === 0) {
    return start;
  }
  else if (deltaPercentages !== null && deltaFactors !== null) {
    const focusPercentages = createFocusPercentages(); // TODO, investigate reusing this collection for subsequent calls
    for (const key of keys) {
      if (deltaPercentages[key] >= percentage) {
        focusPercentages[key] = getFocusPercentage(start[key], percentage, deltaFactors[key], deltas[key]);
      }
      else {
        focusPercentages[key] = end[key];
      }
    }
    return focusPercentages;
  }
  return start;
}
