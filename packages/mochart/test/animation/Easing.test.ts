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
    expect(getEasingFunction('sineIn')(0.5)).toBeCloseTo(1 - Math.SQRT1_2, 10);
    expect(getEasingFunction('sineInOut')(0.5)).toBeCloseTo(0.5, 10);
    expect(getEasingFunction('quadIn')(0.5)).toBeCloseTo(0.25, 10);
    expect(getEasingFunction('quadOut')(0.5)).toBeCloseTo(0.75, 10);
    expect(getEasingFunction('cubicIn')(0.5)).toBeCloseTo(0.125, 10);
    expect(getEasingFunction('cubicOut')(0.5)).toBeCloseTo(0.875, 10);
    expect(getEasingFunction('cubicInOut')(0.5)).toBeCloseTo(0.5, 10);
    expect(getEasingFunction('quintIn')(0.5)).toBeCloseTo(0.03125, 10);
    expect(getEasingFunction('quintOut')(0.5)).toBeCloseTo(0.96875, 10);
    expect(getEasingFunction('bounceOut')(0.5)).toBeCloseTo(0.765625, 10);
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

  const grid = Array.from({ length: 101 }, (_, i) => i / 100);

  it('linear and the sine/quad/cubic/quint families are monotone within 0 to 1', () => {
    const monotone: AnimationEasing[] = [
      'linear',
      'sineIn', 'sineOut', 'sineInOut',
      'quadIn', 'quadOut', 'quadInOut',
      'cubicIn', 'cubicOut', 'cubicInOut',
      'quintIn', 'quintOut', 'quintInOut'
    ];
    for (const easing of monotone) {
      const fn = getEasingFunction(easing);
      for (let i = 1; i < grid.length; i++) {
        expect(fn(grid[i]!), easing).toBeGreaterThanOrEqual(fn(grid[i - 1]!));
      }
    }
  });

  it('back and elastic overshoot their targets in between', () => {
    expect(Math.max(...grid.map(getEasingFunction('backOut')))).toBeGreaterThan(1);
    expect(Math.max(...grid.map(getEasingFunction('elasticOut')))).toBeGreaterThan(1);
    expect(Math.min(...grid.map(getEasingFunction('backIn')))).toBeLessThan(0);
    expect(Math.min(...grid.map(getEasingFunction('elasticIn')))).toBeLessThan(0);
  });

  it('the bounce family stays within 0 to 1', () => {
    for (const easing of ['bounceIn', 'bounceOut', 'bounceInOut'] as AnimationEasing[]) {
      const fn = getEasingFunction(easing);
      for (const percentage of grid) {
        expect(fn(percentage), easing).toBeGreaterThanOrEqual(0);
        expect(fn(percentage), easing).toBeLessThanOrEqual(1);
      }
    }
  });

  it('clamps out-of-range input to exact endpoints', () => {
    for (const easing of EASINGS as AnimationEasing[]) {
      const fn = getEasingFunction(easing);
      expect(fn(-0.5), easing).toBe(0);
      expect(fn(1.5), easing).toBe(1);
    }
  });
});
