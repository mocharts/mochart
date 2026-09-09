import { describe, it, expect } from 'vitest';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';
import {
  getFocusValue,
  getCategoryFocusPercentage,
  getAggregateSeriesFocusPercentage,
  getFocusedDefocused,
  getFocusPercentageColor,
  getAxisFocusColor,
  getAxisFocusOpacity,
  getAxisFocusStyle
} from '../../src/utils/FocusValue';


const NORMAL = 10;
const FOCUSED = 20;
const DEFOCUSED = 5;

describe('getFocusValue', () => {
  it('returns the normal value for null or 0 focus', () => {
    expect(getFocusValue(null, NORMAL, FOCUSED, DEFOCUSED)).toBe(NORMAL);
    expect(getFocusValue(0, NORMAL, FOCUSED, DEFOCUSED)).toBe(NORMAL);
  });

  it('interpolates toward the focused value for positive focus', () => {
    // 10 + 1 * (20 - 10) = 20 at full focus; half focus is midway
    expect(getFocusValue(1, NORMAL, FOCUSED, DEFOCUSED)).toBe(20);
    expect(getFocusValue(0.5, NORMAL, FOCUSED, DEFOCUSED)).toBe(15);
  });

  it('interpolates toward the defocused value for negative focus', () => {
    // 10 + (-1) * (10 - 5) = 5 at full defocus
    expect(getFocusValue(-1, NORMAL, FOCUSED, DEFOCUSED)).toBe(5);
    expect(getFocusValue(-0.5, NORMAL, FOCUSED, DEFOCUSED)).toBe(7.5);
  });

  // The linear interpolation is exact for any value ordering — an inverted style config
  // (focused below normal, defocused above) still lands on every endpoint.
  it('interpolates exactly with an inverted value ordering', () => {
    expect(getFocusValue(1, 0.6, 0.2, 1)).toBeCloseTo(0.2);
    expect(getFocusValue(0.5, 0.6, 0.2, 1)).toBeCloseTo(0.4);
    expect(getFocusValue(0, 0.6, 0.2, 1)).toBeCloseTo(0.6);
    expect(getFocusValue(-0.5, 0.6, 0.2, 1)).toBeCloseTo(0.8);
    expect(getFocusValue(-1, 0.6, 0.2, 1)).toBeCloseTo(1);
  });
});

describe('getCategoryFocusPercentage / combined focus', () => {
  it('returns null when both are null', () => {
    expect(getCategoryFocusPercentage(null, null)).toBe(null);
  });

  it('returns the other side when one is null or 0', () => {
    expect(getCategoryFocusPercentage(null, 0.5)).toBe(0.5);
    expect(getCategoryFocusPercentage(0, 0.5)).toBe(0.5);
    expect(getCategoryFocusPercentage(0.5, null)).toBe(0.5);
    expect(getCategoryFocusPercentage(0.5, 0)).toBe(0.5);
  });

  it('takes the strongest defocus (min) when both are negative', () => {
    expect(getCategoryFocusPercentage(-0.2, -0.8)).toBe(-0.8);
  });

  it('takes the strongest focus (max) when both are positive', () => {
    expect(getCategoryFocusPercentage(0.2, 0.8)).toBe(0.8);
  });

  it('blends opposite signs continuously (a + b - a*b)', () => {
    // a series focus tweening 0 -> 1 under a steady category defocus must
    // travel -1 -> 1 without snapping the moment it crosses zero
    expect(getCategoryFocusPercentage(-1, 0.01)).toBeCloseTo(-0.98);
    expect(getCategoryFocusPercentage(-1, 0.5)).toBeCloseTo(0);
    expect(getCategoryFocusPercentage(-0.2, 0.8)).toBeCloseTo(0.76);
  });

  it('resolves full-strength opposite pairs to the positive side, like the max it replaced', () => {
    expect(getCategoryFocusPercentage(-1, 1)).toBe(1);
    expect(getCategoryFocusPercentage(1, -1)).toBe(1);
  });
});

describe('getAggregateSeriesFocusPercentage', () => {
  const cfg = (id: string): EnhancedSeriesConfig => ({ id } as EnhancedSeriesConfig);

  it('is null when no series has a focus percentage', () => {
    expect(getAggregateSeriesFocusPercentage([cfg('a'), cfg('b')], { a: null, b: null })).toBe(null);
  });

  it('returns the maximum focus percentage across series', () => {
    expect(getAggregateSeriesFocusPercentage([cfg('a'), cfg('b'), cfg('c')], { a: 0.2, b: null, c: 0.9 })).toBe(0.9);
  });
});

describe('getFocusedDefocused', () => {
  it('classifies null as neither', () => {
    expect(getFocusedDefocused(null)).toEqual({ focused: false, defocused: false });
  });

  it('classifies positive as focused and negative as defocused', () => {
    expect(getFocusedDefocused(0.5)).toEqual({ focused: true, defocused: false });
    expect(getFocusedDefocused(-0.5)).toEqual({ focused: false, defocused: true });
  });
});

describe('getFocusPercentageColor', () => {
  it('picks the color matching the focus state', () => {
    expect(getFocusPercentageColor(0.5, 'n', 'f', 'd')).toBe('f');
    expect(getFocusPercentageColor(-0.5, 'n', 'f', 'd')).toBe('d');
    expect(getFocusPercentageColor(null, 'n', 'f', 'd')).toBe('n');
  });

  it('resolves "same" to the normal color', () => {
    expect(getFocusPercentageColor(0.5, 'n', 'same', 'd')).toBe('n');
    expect(getFocusPercentageColor(-0.5, 'n', 'f', 'same')).toBe('n');
  });
});

describe('getAxisFocusColor', () => {
  it('returns the normal color when either percentage is undefined', () => {
    expect(getAxisFocusColor(undefined, 0.5, true, 'n', 'f', 'd')).toBe('n');
    expect(getAxisFocusColor(0.5, undefined, true, 'n', 'f', 'd')).toBe('n');
  });

  it('uses the axis focus when it is set', () => {
    expect(getAxisFocusColor(0.5, -0.5, true, 'n', 'f', 'd')).toBe('f');
  });

  it('falls back to series focus when the axis focus is null and useSeriesFocus is set', () => {
    expect(getAxisFocusColor(null, -0.5, true, 'n', 'f', 'd')).toBe('d');
  });

  it('stays normal when the axis focus is null and series focus is disabled', () => {
    expect(getAxisFocusColor(null, 0.5, false, 'n', 'f', 'd')).toBe('n');
  });
});

describe('getAxisFocusOpacity', () => {
  it('returns the normal opacity when either percentage is undefined', () => {
    expect(getAxisFocusOpacity(undefined, 0.5, true, NORMAL, FOCUSED, DEFOCUSED)).toBe(NORMAL);
  });

  it('returns the normal opacity when both percentages are null', () => {
    expect(getAxisFocusOpacity(null, null, true, NORMAL, FOCUSED, DEFOCUSED)).toBe(NORMAL);
  });

  it('combines axis and series focus when useSeriesFocus is set', () => {
    // combined(null, 1) => 1, then getFocusValue(1, ...) => FOCUSED
    expect(getAxisFocusOpacity(null, 1, true, NORMAL, FOCUSED, DEFOCUSED)).toBe(FOCUSED);
  });

  it('uses only the axis focus when useSeriesFocus is false', () => {
    expect(getAxisFocusOpacity(1, null, false, NORMAL, FOCUSED, DEFOCUSED)).toBe(FOCUSED);
  });
});

describe('getAxisFocusStyle', () => {
  const textStyle = {
    normal: { strokeColor: 'none', strokeOpacity: 1, strokeWidth: 0, fillColor: 'currentColor', fillOpacity: 1 },
    focused: { strokeColor: 'same', strokeOpacity: 1, strokeWidth: 0, fillColor: '#ff0000', fillOpacity: 1 },
    defocused: { strokeColor: 'same', strokeOpacity: 0.5, strokeWidth: 0, fillColor: 'same', fillOpacity: 0.5 }
  };

  it('resolves to the normal state when nothing is focused', () => {
    expect(getAxisFocusStyle(null, null, true, textStyle)).toEqual(textStyle.normal);
  });

  it('switches colors by state and resolves "same" against the normal state', () => {
    expect(getAxisFocusStyle(1, null, true, textStyle)).toEqual({
      strokeColor: 'none', strokeOpacity: 1, strokeWidth: 0, fillColor: '#ff0000', fillOpacity: 1
    });
    expect(getAxisFocusStyle(-1, null, true, textStyle)).toEqual({
      strokeColor: 'none', strokeOpacity: 0.5, strokeWidth: 0, fillColor: 'currentColor', fillOpacity: 0.5
    });
  });

  it('moves numbers continuously between states', () => {
    // half defocused: opacity travels half the way from 1 to 0.5
    expect(getAxisFocusStyle(-0.5, null, true, textStyle).fillOpacity).toBe(0.75);
  });

  it('resolves only the members the normal state has', () => {
    // a line's stroke width is a flat config property, so its style has none
    const lineStyle = {
      normal: { strokeColor: 'currentColor', strokeOpacity: 0.65 },
      focused: { strokeColor: 'same', strokeOpacity: 0.65 },
      defocused: { strokeColor: 'same', strokeOpacity: 0.325 }
    };
    expect(getAxisFocusStyle(-1, null, true, lineStyle))
      .toEqual({ strokeColor: 'currentColor', strokeOpacity: 0.325 });
  });

  it('leaves a member with nothing to interpolate at the normal value', () => {
    const style = {
      normal: { strokeColor: 'none', strokeWidth: null },
      focused: { strokeColor: 'same', strokeWidth: null },
      defocused: { strokeColor: 'same', strokeWidth: null }
    };
    expect(getAxisFocusStyle(1, null, true, style)).toEqual({ strokeColor: 'none', strokeWidth: null });
  });
});
