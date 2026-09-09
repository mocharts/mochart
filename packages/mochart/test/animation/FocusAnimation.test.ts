import { describe, it, expect } from 'vitest';
import { getFocusDataForPercent } from '../../src/animation/FocusAnimation';
import type {
  ArrayFocusDeltaData,
  FocusAnimationData,
  FocusData,
  MapFocusDeltaData
} from '../../src/types/animation';

function focusData(overrides: Partial<FocusData> = {}): FocusData {
  return {
    focusedCategoryIndex: 0,
    focusedValueAxisId: null,
    focusedSeriesId: null,
    categoryFocusPercentages: [0, 0],
    valueAxisFocusPercentages: { VA0: 0 },
    seriesFocusPercentages: { S0: 0 },
    categoryFocusDomainPercentages: [0],
    valueAxisFocusDomainPercentages: [0],
    seriesFocusDomainPercentages: [0],
    valueAxisComputedFocusDomainPercentages: { VA0: [0] },
    ...overrides
  };
}

const categoryDelta: ArrayFocusDeltaData = {
  start: [0, 0],
  deltas: [1, 1],
  deltaPercentage: 1,
  deltaPercentages: [1, 1],
  deltaFactors: [1, 1],
  end: [1, 1]
};

const valueAxisDelta: MapFocusDeltaData = {
  start: { VA0: 0 },
  deltas: { VA0: 1 },
  deltaPercentage: 1,
  deltaPercentages: { VA0: 1 },
  deltaFactors: { VA0: 1 },
  end: { VA0: 1 }
};

const seriesDelta: MapFocusDeltaData = {
  start: { S0: 0 },
  deltas: { S0: 1 },
  deltaPercentage: 1,
  deltaPercentages: { S0: 1 },
  deltaFactors: { S0: 1 },
  end: { S0: 1 }
};

function animationData(start: FocusData, end: FocusData): FocusAnimationData {
  return {
    start,
    end,
    final: end,
    deltaPercentage: 1,
    category: categoryDelta,
    valueAxis: valueAxisDelta,
    series: seriesDelta
  };
}

describe('getFocusDataForPercent', () => {
  it('returns the shared value when start and end are identical', () => {
    const same = focusData();
    const data = animationData(same, same);
    expect(getFocusDataForPercent(data, 0.5)).toBe(same);
  });

  it('returns the start at percentage 0', () => {
    const start = focusData({ focusedCategoryIndex: 0 });
    const end = focusData({ focusedCategoryIndex: 1 });
    expect(getFocusDataForPercent(animationData(start, end), 0)).toBe(start);
  });

  it('returns the end at percentage 1', () => {
    const start = focusData({ focusedCategoryIndex: 0 });
    const end = focusData({ focusedCategoryIndex: 1 });
    expect(getFocusDataForPercent(animationData(start, end), 1)).toBe(end);
  });

  it('interpolates the focus percentages at the midpoint', () => {
    const start = focusData({ focusedCategoryIndex: 0 });
    const end = focusData({
      focusedCategoryIndex: 1,
      categoryFocusPercentages: [1, 1],
      valueAxisFocusPercentages: { VA0: 1 },
      seriesFocusPercentages: { S0: 1 },
      categoryFocusDomainPercentages: [1]
    });
    const result = getFocusDataForPercent(animationData(start, end), 0.5);
    // start 0 + percentage 0.5 * deltaFactor 1 * delta 1 = 0.5
    expect(result.categoryFocusPercentages).toEqual([0.5, 0.5]);
    expect(result.valueAxisFocusPercentages).toEqual({ VA0: 0.5 });
    expect(result.seriesFocusPercentages).toEqual({ S0: 0.5 });
    // focused identifiers and domain percentages are taken from the end state
    expect(result.focusedCategoryIndex).toBe(1);
    expect(result.categoryFocusDomainPercentages).toEqual([1]);
  });

  it('holds a channel at its end value once its delta window has elapsed', () => {
    // deltaPercentages below the requested percentage means the channel has
    // already finished animating and should read straight from the end state
    const start = focusData({ focusedCategoryIndex: 0 });
    const end = focusData({ focusedCategoryIndex: 1, categoryFocusPercentages: [1, 1] });
    const data = animationData(start, end);
    data.category = { ...categoryDelta, deltaPercentages: [0.1, 0.1] };
    const result = getFocusDataForPercent(data, 0.5);
    expect(result.categoryFocusPercentages).toEqual([1, 1]);
  });
});
