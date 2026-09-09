import { describe, it, expect } from 'vitest';
import { getFocusAnimationData } from '../../src/animation/FocusAnimationData';
import type { FocusData } from '../../src/types/animation';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';


const config = {} as EnhancedMochartConfig;

function focusData(overrides: Partial<FocusData> = {}): FocusData {
  return {
    focusedCategoryIndex: -1,
    focusedValueAxisId: null,
    focusedSeriesId: null,
    categoryFocusPercentages: [0, 0, 0],
    valueAxisFocusPercentages: { VA0: 0, VA1: 0 },
    seriesFocusPercentages: { S0: 0, S1: 0 },
    categoryFocusDomainPercentages: [0],
    valueAxisFocusDomainPercentages: [0],
    seriesFocusDomainPercentages: [0],
    valueAxisComputedFocusDomainPercentages: { VA0: [0] },
    ...overrides
  };
}

describe('getFocusAnimationData', () => {
  it('reports no delta when nothing changed', () => {
    const start = focusData();
    const end = focusData();
    const data = getFocusAnimationData(config, start, end);
    expect(data.deltaPercentage).toBe(0);
    expect(data.category.deltas).toEqual([0, 0, 0]);
    expect(data.category.deltaPercentages).toBeNull();
    expect(data.category.deltaFactors).toBeNull();
    expect(data.valueAxis.deltaPercentages).toBeNull();
    expect(data.series.deltaPercentages).toBeNull();
    expect(data.start).toBe(start);
    expect(data.end).toBe(end);
    expect(data.final).toBe(end);
  });

  it('computes category deltas, percentages and factors relative to the largest delta', () => {
    const start = focusData({ categoryFocusPercentages: [0, 1, 0.5] });
    const end = focusData({ categoryFocusPercentages: [1, 1, 0.75] });
    const data = getFocusAnimationData(config, start, end);
    expect(data.category.deltas).toEqual([1, 0, 0.25]);
    expect(data.category.deltaPercentage).toBe(1);
    // unchanged entries get 0, others are scaled by the max delta
    expect(data.category.deltaPercentages).toEqual([1, 0, 0.25]);
    expect(data.category.deltaFactors).toEqual([1, 0, 4]);
    expect(data.deltaPercentage).toBe(1);
  });

  // Regression: a move from one focused value to another swung by 2 (1 -> -1 and -1 -> 1) and doubled the focus duration
  it('paces a move between two focused values at one focus duration', () => {
    const start = focusData({ categoryFocusPercentages: [1, -1, -1] });
    const end = focusData({ categoryFocusPercentages: [-1, 1, -1] });
    const data = getFocusAnimationData(config, start, end);
    expect(data.category.deltas).toEqual([-2, 2, 0]);
    expect(data.deltaPercentage).toBe(1);
    // per-key pacing is still relative to the largest swing
    expect(data.category.deltaPercentages).toEqual([1, 1, 0]);
  });

  it('treats null focus percentages as zero', () => {
    const start = focusData({ categoryFocusPercentages: [null, 1] });
    const end = focusData({ categoryFocusPercentages: [1, null] });
    const data = getFocusAnimationData(config, start, end);
    expect(data.category.deltas).toEqual([1, -1]);
    expect(data.category.deltaPercentage).toBe(1);
  });

  it('computes value axis map deltas with mixed changed and unchanged entries', () => {
    const start = focusData({ valueAxisFocusPercentages: { VA0: 0, VA1: 0.5 } });
    const end = focusData({ valueAxisFocusPercentages: { VA0: 0.5, VA1: 0.5 } });
    const data = getFocusAnimationData(config, start, end);
    expect(data.valueAxis.deltas).toEqual({ VA0: 0.5, VA1: 0 });
    expect(data.valueAxis.deltaPercentage).toBe(0.5);
    expect(data.valueAxis.deltaPercentages).toEqual({ VA0: 1, VA1: 0 });
    expect(data.valueAxis.deltaFactors).toEqual({ VA0: 1, VA1: 0 });
  });

  it('computes series map deltas and scales smaller deltas against the largest', () => {
    const start = focusData({ seriesFocusPercentages: { S0: 0, S1: 0 } });
    const end = focusData({ seriesFocusPercentages: { S0: 1, S1: 0.25 } });
    const data = getFocusAnimationData(config, start, end);
    expect(data.series.deltas).toEqual({ S0: 1, S1: 0.25 });
    expect(data.series.deltaPercentage).toBe(1);
    expect(data.series.deltaPercentages).toEqual({ S0: 1, S1: 0.25 });
    expect(data.series.deltaFactors).toEqual({ S0: 1, S1: 4 });
  });

  it('takes the overall delta from the largest of category, value-axis and series deltas', () => {
    const start = focusData();
    const end = focusData({
      categoryFocusPercentages: [0.25, 0, 0],
      valueAxisFocusPercentages: { VA0: 0.75, VA1: 0 },
      seriesFocusPercentages: { S0: 0.5, S1: 0 }
    });
    const data = getFocusAnimationData(config, start, end);
    expect(data.category.deltaPercentage).toBe(0.25);
    expect(data.valueAxis.deltaPercentage).toBe(0.75);
    expect(data.series.deltaPercentage).toBe(0.5);
    expect(data.deltaPercentage).toBe(0.75);
  });
});
