import { describe, it, expect } from 'vitest';
import { getSeriesFocusPercentage } from '../../src/utils/SeriesFocus';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';


function seriesConfig(overrides: Partial<EnhancedSeriesConfig> = {}): EnhancedSeriesConfig {
  return { id: 'S0', axis: 'VA0', useAxisFocus: true, ...overrides } as EnhancedSeriesConfig;
}

describe('getSeriesFocusPercentage', () => {
  it('takes the stronger of the axis and series focus when they agree', () => {
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 0.75 }, { S0: 0.5 })).toBe(0.75);
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 0.25 }, { S0: 0.5 })).toBe(0.5);
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: -0.25 }, { S0: -0.5 })).toBe(-0.5);
  });

  // Regression: folding with Math.max read a null series focus as 0, so focusing an axis left the
  // series on every other axis at normal while those axes' own chrome defocused
  it('defocuses a series whose axis is defocused and which has no focus of its own', () => {
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: -1 }, { S0: null })).toBe(-1);
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 1 }, { S0: null })).toBe(1);
  });

  // the fold the axis chrome uses, so a tweening series and its axis stay together
  it('blends an axis and series focus that oppose each other', () => {
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 0.5 }, { S0: -0.5 })).toBe(0.25);
    // the endpoints still resolve the way taking the larger did
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 1 }, { S0: -1 })).toBe(1);
  });

  it('uses only the series focus when useAxisFocus is off', () => {
    expect(getSeriesFocusPercentage(seriesConfig({ useAxisFocus: false }), { VA0: 0.75 }, { S0: 0.5 })).toBe(0.5);
  });

  it('falls back to the series focus when the axis focus is null', () => {
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: null }, { S0: 0.5 })).toBe(0.5);
  });

  it('returns null when the axis or series entry is missing', () => {
    expect(getSeriesFocusPercentage(seriesConfig(), {}, { S0: 0.5 })).toBeNull();
    expect(getSeriesFocusPercentage(seriesConfig(), { VA0: 0.75 }, {})).toBeNull();
    expect(getSeriesFocusPercentage(seriesConfig({ axis: undefined }), { VA0: 0.75 }, { S0: 0.5 })).toBeNull();
  });
});
