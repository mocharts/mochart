import type { EnhancedMochartConfig } from '../types/enhanced';
import type {
  ArrayFocusDeltaData,
  FocusAnimationData,
  FocusData,
  FocusDeltaData,
  FocusPercentage,
  FocusPercentageMap,
  MapFocusDeltaData
} from '../types/animation';

export function getFocusAnimationData(_mochartConfig: EnhancedMochartConfig, oldFocusData: FocusData, newFocusData: FocusData): FocusAnimationData {
  const startFocusData = oldFocusData;
  const endFocusData = newFocusData;
  const categoryFocusDeltaData = getArrayFocusDeltaData(startFocusData.categoryFocusPercentages, endFocusData.categoryFocusPercentages);
  const valueAxisFocusDeltaData = getMapFocusDeltaData(oldFocusData.valueAxisFocusPercentages, newFocusData.valueAxisFocusPercentages);
  const seriesFocusDeltaData = getMapFocusDeltaData(oldFocusData.seriesFocusPercentages, newFocusData.seriesFocusPercentages);
  return {
    start: startFocusData,
    // focus percentages span -1..1, so a move between two values swings by 2; the pace is capped at one focusDuration
    deltaPercentage: Math.min(1, Math.max(categoryFocusDeltaData.deltaPercentage, valueAxisFocusDeltaData.deltaPercentage, seriesFocusDeltaData.deltaPercentage)),
    category: categoryFocusDeltaData,
    valueAxis: valueAxisFocusDeltaData,
    series: seriesFocusDeltaData,
    end: endFocusData,
    final: newFocusData
  };
}

function getFocusDelta(newFocusPercentage: FocusPercentage, oldFocusPercentage: FocusPercentage): number {
  newFocusPercentage = newFocusPercentage === null ? 0 : newFocusPercentage;
  oldFocusPercentage = oldFocusPercentage === null ? 0 : oldFocusPercentage;
  return newFocusPercentage - oldFocusPercentage;
}

function getArrayFocusDeltaData(oldFocusPercentages: FocusPercentage[], newFocusPercentages: FocusPercentage[]): ArrayFocusDeltaData {
  // arrays satisfy Record<number, ...> going in, so the assertion only restores the array types coming out
  return getKeyedFocusDeltaData<number>(oldFocusPercentages.map((_, i) => i), oldFocusPercentages, newFocusPercentages, () => []) as ArrayFocusDeltaData;
}

function getMapFocusDeltaData(oldFocusPercentages: FocusPercentageMap, newFocusPercentages: FocusPercentageMap): MapFocusDeltaData {
  return getKeyedFocusDeltaData<string>(Object.keys(oldFocusPercentages), oldFocusPercentages, newFocusPercentages, () => Object.create(null) as Record<string, number>);
}

function getKeyedFocusDeltaData<K extends string | number>(
  keys: readonly K[],
  oldFocusPercentages: Record<K, FocusPercentage>,
  newFocusPercentages: Record<K, FocusPercentage>,
  createDeltas: () => Record<K, number>
): FocusDeltaData<Record<K, FocusPercentage>, Record<K, number>> {
  const focusDeltas = createDeltas();
  let focusDelta, maxDelta = 0;
  for (const key of keys) {
    focusDelta = getFocusDelta(newFocusPercentages[key], oldFocusPercentages[key]);
    focusDeltas[key] = focusDelta;
    if (Math.abs(focusDelta) > maxDelta) {
      maxDelta = Math.abs(focusDelta);
    }
  }
  let deltaPercentages: Record<K, number> | null = null;
  let deltaFactors: Record<K, number> | null = null;
  if (maxDelta > 0) {
    deltaPercentages = createDeltas();
    deltaFactors = createDeltas();
    let focusDelta;
    for (const key of keys) {
      focusDelta = Math.abs(focusDeltas[key]);
      if (focusDelta > 0) {
        deltaPercentages[key] = focusDelta / maxDelta;
        deltaFactors[key] = maxDelta / focusDelta;
      }
      else {
        deltaPercentages[key] = 0;
        deltaFactors[key] = 0;
      }
    }
  }
  return {
    start: oldFocusPercentages,
    deltas: focusDeltas,
    deltaPercentage: maxDelta,
    deltaPercentages,
    deltaFactors,
    end: newFocusPercentages
  };
}
