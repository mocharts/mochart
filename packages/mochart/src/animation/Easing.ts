import {
  EASING_LINEAR,
  EASING_SINE_IN, EASING_SINE_OUT, EASING_SINE_IN_OUT,
  EASING_QUAD_IN, EASING_QUAD_OUT, EASING_QUAD_IN_OUT,
  EASING_CUBIC_IN, EASING_CUBIC_OUT, EASING_CUBIC_IN_OUT,
  EASING_QUINT_IN, EASING_QUINT_OUT, EASING_QUINT_IN_OUT,
  EASING_BOUNCE_IN, EASING_BOUNCE_OUT, EASING_BOUNCE_IN_OUT
} from '../config/core/constants';

import type { AnimationEasing } from '../config/core/constants';

/** Maps a tween's linear progress (0 to 1) onto eased progress; endpoints are exact and every easing stays within 0 to 1. */
export type EasingFunction = (percentage: number) => number;

const HALF_PI = Math.PI / 2;

function bounceOut(percentage: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (percentage < 1 / d) {
    return n * percentage * percentage;
  }
  if (percentage < 2 / d) {
    const t = percentage - 1.5 / d;
    return n * t * t + 0.75;
  }
  if (percentage < 2.5 / d) {
    const t = percentage - 2.25 / d;
    return n * t * t + 0.9375;
  }
  const t = percentage - 2.625 / d;
  return n * t * t + 0.984375;
}

const RAW_EASING_FUNCTIONS: Record<AnimationEasing, EasingFunction> = {
  [EASING_LINEAR]: percentage => percentage,
  [EASING_SINE_IN]: percentage => 1 - Math.cos(percentage * HALF_PI),
  [EASING_SINE_OUT]: percentage => Math.sin(percentage * HALF_PI),
  [EASING_SINE_IN_OUT]: percentage => (1 - Math.cos(Math.PI * percentage)) / 2,
  [EASING_QUAD_IN]: percentage => percentage ** 2,
  [EASING_QUAD_OUT]: percentage => 1 - (1 - percentage) ** 2,
  [EASING_QUAD_IN_OUT]: percentage => percentage < 0.5 ? 2 * percentage ** 2 : 1 - 2 * (1 - percentage) ** 2,
  [EASING_CUBIC_IN]: percentage => percentage ** 3,
  [EASING_CUBIC_OUT]: percentage => 1 - (1 - percentage) ** 3,
  [EASING_CUBIC_IN_OUT]: percentage => percentage < 0.5 ? 4 * percentage ** 3 : 1 - 4 * (1 - percentage) ** 3,
  [EASING_QUINT_IN]: percentage => percentage ** 5,
  [EASING_QUINT_OUT]: percentage => 1 - (1 - percentage) ** 5,
  [EASING_QUINT_IN_OUT]: percentage => percentage < 0.5 ? 16 * percentage ** 5 : 1 - 16 * (1 - percentage) ** 5,
  [EASING_BOUNCE_IN]: percentage => 1 - bounceOut(1 - percentage),
  [EASING_BOUNCE_OUT]: bounceOut,
  [EASING_BOUNCE_IN_OUT]: percentage => percentage < 0.5
    ? (1 - bounceOut(1 - 2 * percentage)) / 2
    : (1 + bounceOut(2 * percentage - 1)) / 2
};

// exact endpoints, so a tween's boundary frames render exact start/end state
function withExactEndpoints(fn: EasingFunction): EasingFunction {
  return percentage => {
    if (percentage <= 0) {
      return 0;
    }
    if (percentage >= 1) {
      return 1;
    }
    return fn(percentage);
  };
}

const EASING_FUNCTIONS = Object.fromEntries(
  Object.entries(RAW_EASING_FUNCTIONS).map(([name, fn]) => [name, withExactEndpoints(fn)])
) as Record<AnimationEasing, EasingFunction>;

export function getEasingFunction(easing: AnimationEasing): EasingFunction {
  return EASING_FUNCTIONS[easing];
}
