// The easings behind animation.easing / animation.focusEasing: endpoint-preserving maps of
// a tween's linear progress. ChartTweens.test.ts covers their application to running tweens.
import { describe, it, expect } from 'vitest';
import { getEasingFunction } from '../../src/animation/Easing';
import { EASINGS } from '../../src/config/core/constants';
import type { AnimationEasing } from '../../src/config/core/constants';

describe('getEasingFunction', () => {
  it('preserves the 0 and 1 endpoints for every easing', () => {
    for (const easing of EASINGS as AnimationEasing[]) {
      const fn = getEasingFunction(easing);
      expect(fn(0), easing).toBe(0);
      expect(fn(1), easing).toBe(1);
    }
  });

  it('maps midpoints per easing', () => {
    expect(getEasingFunction('linear')(0.5)).toBe(0.5);
    expect(getEasingFunction('cubicIn')(0.5)).toBeCloseTo(0.125, 10);
    expect(getEasingFunction('cubicOut')(0.5)).toBeCloseTo(0.875, 10);
    expect(getEasingFunction('cubicInOut')(0.5)).toBeCloseTo(0.5, 10);
  });

  it('cubicIn lags and cubicOut leads linear progress in between', () => {
    for (const percentage of [0.25, 0.5, 0.75]) {
      expect(getEasingFunction('cubicIn')(percentage)).toBeLessThan(percentage);
      expect(getEasingFunction('cubicOut')(percentage)).toBeGreaterThan(percentage);
    }
  });

  it('cubicInOut is symmetric around the midpoint', () => {
    const cubicInOut = getEasingFunction('cubicInOut');
    for (const percentage of [0.1, 0.25, 0.4]) {
      expect(cubicInOut(percentage) + cubicInOut(1 - percentage)).toBeCloseTo(1, 10);
    }
  });
});
