import { EASING_LINEAR, EASING_CUBIC_IN, EASING_CUBIC_OUT, EASING_CUBIC_IN_OUT } from '../config/core/constants';

import type { AnimationEasing } from '../config/core/constants';

/** Maps a tween's linear progress (0 to 1) onto eased progress (0 to 1, endpoints preserved). */
export type EasingFunction = (percentage: number) => number;

const EASING_FUNCTIONS: Record<AnimationEasing, EasingFunction> = {
  [EASING_LINEAR]: percentage => percentage,
  [EASING_CUBIC_IN]: percentage => percentage ** 3,
  [EASING_CUBIC_OUT]: percentage => 1 - (1 - percentage) ** 3,
  [EASING_CUBIC_IN_OUT]: percentage => percentage < 0.5 ? 4 * percentage ** 3 : 1 - 4 * (1 - percentage) ** 3
};

export function getEasingFunction(easing: AnimationEasing): EasingFunction {
  return EASING_FUNCTIONS[easing];
}
