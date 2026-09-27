import { describe, it, expect } from 'vitest';
import { getDomainFraction, getScaledValue, getValueOffsetByDomainFraction } from '../../src/data/DomainFraction';
import { SCALE_LINEAR, SCALE_LOG } from '../../src/config/core/constants';

describe('getDomainFraction', () => {
  it('places a value by difference on a linear scale', () => {
    expect(getDomainFraction(SCALE_LINEAR, [0, 200], 50)).toBe(0.25);
    expect(getDomainFraction(SCALE_LINEAR, [0, 200], 50, false)).toBe(0.75);
  });

  it('places a value by ratio on a log scale', () => {
    expect(getDomainFraction(SCALE_LOG, [1, 1000], 10)).toBeCloseTo(1 / 3);
    expect(getDomainFraction(SCALE_LOG, [1, 1000], 10, false)).toBeCloseTo(2 / 3);
  });

  it('does not clamp a value outside the domain', () => {
    expect(getDomainFraction(SCALE_LINEAR, [0, 100], 150)).toBe(1.5);
    expect(getDomainFraction(SCALE_LOG, [10, 100], 1)).toBeCloseTo(-1);
  });
});

describe('getValueOffsetByDomainFraction', () => {
  it('adds a share of the domain extent on a linear scale', () => {
    expect(getValueOffsetByDomainFraction(SCALE_LINEAR, [0, 200], 50, 0.25)).toBe(100);
    expect(getValueOffsetByDomainFraction(SCALE_LINEAR, [0, 200], 200, -0.25)).toBe(150);
  });

  it('multiplies by a share of the domain ratio on a log scale', () => {
    expect(getValueOffsetByDomainFraction(SCALE_LOG, [1, 1000], 10, 1 / 3)).toBeCloseTo(100);
    expect(getValueOffsetByDomainFraction(SCALE_LOG, [1, 1000], 1000, -2 / 3)).toBeCloseTo(10);
  });
});

describe('getScaledValue', () => {
  it('is the value on a linear scale and its base 10 log on a log scale', () => {
    expect(getScaledValue(SCALE_LINEAR, 1000)).toBe(1000);
    expect(getScaledValue(SCALE_LOG, 1000)).toBe(3);
  });
});
