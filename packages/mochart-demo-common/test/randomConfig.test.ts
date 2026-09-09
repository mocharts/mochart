import { describe, it, expect, vi, beforeEach } from 'vitest';

import { validateRandomConfig, restoreSharedRandomConfig, neutralizeRandomReuse, formatRandomConfig } from '../src/randomConfig';

import type { RandomConfigWithValid } from '../src/types';

const genericConfig = {
  category: {
    count: 15,
    order: { sort: true },
    missing: { probability: 0 },
    reuse: { globalFraction: 0.5, stepFraction: 0.5 },
    number: { min: -100, max: 100, interval: 1 },
    string: { minLength: 1, maxLength: 20 },
    date: { min: '2014-01-01', max: '2018-01-01', interval: 30, intervalUnit: 'day' }
  },
  series: {
    number: { min: -500, max: 500, round: true, limitToAxisConfig: true },
    missing: { probability: 0 },
    reuse: { global: false, step: true }
  }
};

const pieConfig = {
  value: { min: 0, max: 420 },
  missing: { probability: 0.25 },
  reuse: { globalFraction: 0, stepFraction: 0.5 }
};

const walkConfig = {
  candles: { min: 16, max: 20 },
  price: { min: 90, max: 110, volatility: 0.04 },
  reuse: { step: true }
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('validateRandomConfig', () => {
  it('validates the generic schema when no generator is given', () => {
    expect(validateRandomConfig(genericConfig)).toBe(true);
    expect(validateRandomConfig({})).toBe(false);
  });

  it('dispatches to the generator schema', () => {
    expect(validateRandomConfig(pieConfig, 'pie')).toBe(true);
    expect(validateRandomConfig(pieConfig, 'gauge')).toBe(true);
    expect(validateRandomConfig(walkConfig, 'candlestick')).toBe(true);
    expect(validateRandomConfig(walkConfig, 'ohlc')).toBe(true);
  });

  it('rejects the generic shape under a generator schema (old share links)', () => {
    expect(validateRandomConfig(genericConfig, 'pie')).toBe(false);
  });

  it('rejects out-of-range generator settings', () => {
    expect(validateRandomConfig({ ...pieConfig, missing: { probability: 2 } }, 'pie')).toBe(false);
    expect(validateRandomConfig({ ...pieConfig, value: { min: 100, max: 0 } }, 'pie')).toBe(false);
    expect(validateRandomConfig({ ...walkConfig, candles: { min: 0, max: 20 } }, 'candlestick')).toBe(false);
  });

  it('falls back to the generic schema for unknown generator ids', () => {
    expect(validateRandomConfig(genericConfig, 'not-a-generator')).toBe(true);
  });

  // Regression: these checks compared against count.max on a scalar count, so
  // they never fired and an insufficient range froze the page in the
  // generator's uniqueness retry loop.
  describe('category range sufficiency', () => {
    function withCategory(overrides: Record<string, unknown>) {
      return { ...genericConfig, category: { ...genericConfig.category, ...overrides } };
    }

    it('rejects a number range too small for the category count', () => {
      expect(validateRandomConfig(withCategory({ number: { min: 0, max: 5, interval: 1 } }))).toBe(false);
    });

    it('rejects a date range too small for the category count', () => {
      expect(validateRandomConfig(withCategory({
        date: { min: '2014-01-01', max: '2014-01-05', interval: 1, intervalUnit: 'day' }
      }))).toBe(false);
    });

    it('rejects a string range too small for the category count', () => {
      expect(validateRandomConfig(withCategory({ string: { minLength: 1, maxLength: 1 } }))).toBe(false);
    });

    // Regression: these sections had validators defined but never invoked, so
    // out-of-range values silently distorted or emptied the chart.
    it('rejects out-of-range order/missing/reuse/round settings', () => {
      expect(validateRandomConfig(withCategory({ order: { sort: 'yes' } }))).toBe(false);
      expect(validateRandomConfig(withCategory({ missing: { probability: 5 } }))).toBe(false);
      expect(validateRandomConfig(withCategory({ reuse: { globalFraction: 2, stepFraction: 0.5 } }))).toBe(false);
      expect(validateRandomConfig({ ...genericConfig,
        series: { ...genericConfig.series, number: { ...genericConfig.series.number, round: 1 } } })).toBe(false);
      expect(validateRandomConfig({ ...genericConfig,
        series: { ...genericConfig.series, reuse: { global: false, step: 'always' } } })).toBe(false);
    });

    // Regression: the checks compared the interval count, not the values it lands on, one of which is the min.
    it('accepts a range with exactly enough values, and rejects one value short', () => {
      const single = { count: 1, reuse: { globalFraction: 0, stepFraction: 0 } };
      expect(validateRandomConfig(withCategory({ ...single, number: { min: 5, max: 5, interval: 1 } }))).toBe(true);
      expect(validateRandomConfig(withCategory({
        ...single, date: { min: '2014-01-01', max: '2014-01-01', interval: 1, intervalUnit: 'day' }
      }))).toBe(true);
      expect(validateRandomConfig(withCategory({ ...single, string: { minLength: 1, maxLength: 1 } }))).toBe(true);

      // count 15 with no reuse needs 15 distinct values
      const fifteen = { count: 15, reuse: { globalFraction: 0, stepFraction: 0 } };
      expect(validateRandomConfig(withCategory({ ...fifteen, number: { min: 0, max: 14, interval: 1 } }))).toBe(true);
      expect(validateRandomConfig(withCategory({ ...fifteen, number: { min: 0, max: 13, interval: 1 } }))).toBe(false);
      expect(validateRandomConfig(withCategory({
        ...fifteen, date: { min: '2014-01-01', max: '2014-01-15', interval: 1, intervalUnit: 'day' }
      }))).toBe(true);
      expect(validateRandomConfig(withCategory({
        ...fifteen, date: { min: '2014-01-01', max: '2014-01-14', interval: 1, intervalUnit: 'day' }
      }))).toBe(false);
      expect(validateRandomConfig(withCategory({ count: 10, string: { minLength: 1, maxLength: 2 },
        reuse: { globalFraction: 0, stepFraction: 0 } }))).toBe(true);
      expect(validateRandomConfig(withCategory({ count: 11, string: { minLength: 1, maxLength: 2 },
        reuse: { globalFraction: 0, stepFraction: 0 } }))).toBe(false);
    });

    it('counts the values a multi-step interval lands on, not the span it covers', () => {
      const fifteen = { count: 15, reuse: { globalFraction: 0, stepFraction: 0 } };
      expect(validateRandomConfig(withCategory({ ...fifteen, number: { min: 0, max: 28, interval: 2 } }))).toBe(true);
      expect(validateRandomConfig(withCategory({ ...fifteen, number: { min: 0, max: 27, interval: 2 } }))).toBe(false);
      expect(validateRandomConfig(withCategory({
        ...fifteen, date: { min: '2014-01-01', max: '2015-02-25', interval: 30, intervalUnit: 'day' }
      }))).toBe(true);
      expect(validateRandomConfig(withCategory({
        ...fifteen, date: { min: '2014-01-01', max: '2015-01-26', interval: 30, intervalUnit: 'day' }
      }))).toBe(false);
    });

    it('accounts for the step-reuse preview lineages', () => {
      // count 12, stepFraction 1 -> preview lineages need 18 uniques; 15 lattice values is enough for count alone
      const number = { min: 0, max: 14, interval: 1 };
      expect(validateRandomConfig(withCategory({
        count: 12, number, reuse: { globalFraction: 0, stepFraction: 1 }
      }))).toBe(false);
      expect(validateRandomConfig(withCategory({
        count: 12, number, reuse: { globalFraction: 0, stepFraction: 0 }
      }))).toBe(true);
    });
  });
});

// Regression: share payloads were stamped valid: true without validation, so a
// config the sender's own UI refused (or a hand-edited payload) ran the
// generator on the recipient's page.
describe('restoreSharedRandomConfig', () => {
  it('computes the valid flag instead of trusting the payload', () => {
    expect(restoreSharedRandomConfig(genericConfig as never)).toEqual({ ...genericConfig, valid: true });
    expect(restoreSharedRandomConfig(pieConfig as never, 'pie').valid).toBe(true);
  });

  it('marks invalid payloads invalid', () => {
    expect(restoreSharedRandomConfig({} as never).valid).toBe(false);
    expect(restoreSharedRandomConfig({} as never, 'pie').valid).toBe(false);
    const insufficient = { ...genericConfig, category: { ...genericConfig.category, number: { min: 0, max: 5, interval: 1 } } };
    expect(restoreSharedRandomConfig(insufficient as never).valid).toBe(false);
  });

  it('ignores a tampered valid flag on the payload', () => {
    const tampered = { ...genericConfig, category: { ...genericConfig.category, number: { min: 0, max: 5, interval: 1 } }, valid: true };
    expect(restoreSharedRandomConfig(tampered as never).valid).toBe(false);
  });
});

describe('neutralizeRandomReuse', () => {
  it('zeroes the generic category/series reuse settings', () => {
    const neutralized = neutralizeRandomReuse(genericConfig);
    expect(neutralized.category.reuse).toEqual({ globalFraction: 0, stepFraction: 0 });
    expect(neutralized.series.reuse).toEqual({ global: false, step: false });
    expect(neutralized.category.count).toBe(15);
    expect(genericConfig.series.reuse.step).toBe(true);
  });

  it('neutralizes a top-level reuse section structurally', () => {
    expect(neutralizeRandomReuse(pieConfig).reuse).toEqual({ globalFraction: 0, stepFraction: 0 });
    expect(neutralizeRandomReuse(walkConfig).reuse).toEqual({ step: false });
    expect(pieConfig.reuse.stepFraction).toBe(0.5);
  });
});

describe('formatRandomConfig', () => {
  it('strips the valid flag and round-trips any schema', () => {
    const formatted = formatRandomConfig({ ...pieConfig, valid: true } as RandomConfigWithValid);
    expect(JSON.parse(formatted)).toEqual(pieConfig);
    expect(formatted.includes('"valid"')).toBe(false);
  });
});
