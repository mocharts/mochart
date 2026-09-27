import { SCALE_LOG } from '../config/core/constants.js';
import type { Scale } from '../config/core/constants.js';

/** A value in the units the scale spaces evenly: the value itself, or its base 10 log on a log scale. */
export function getScaledValue(scale: Scale, value: number): number {
  return scale === SCALE_LOG ? Math.log10(value) : value;
}

function getUnscaledValue(scale: Scale, scaledValue: number): number {
  return scale === SCALE_LOG ? 10 ** scaledValue : scaledValue;
}

/**
 * How far along the domain a value lies, 0 at domain[0] and 1 at domain[1], or the reverse when not ascending.
 * Not clamped; callers guard an empty domain (domain[0] === domain[1]).
 */
export function getDomainFraction(scale: Scale, domain: readonly [number, number], value: number, ascending = true): number {
  const min = getScaledValue(scale, domain[0]);
  const max = getScaledValue(scale, domain[1]);
  const scaledValue = getScaledValue(scale, value);
  return ascending ? (scaledValue - min) / (max - min) : (max - scaledValue) / (max - min);
}

/** The value a fraction of the domain's length beyond another value; a negative fraction moves towards domain[0]. */
export function getValueOffsetByDomainFraction(scale: Scale, domain: readonly [number, number], value: number, fraction: number): number {
  const extent = getScaledValue(scale, domain[1]) - getScaledValue(scale, domain[0]);
  return getUnscaledValue(scale, getScaledValue(scale, value) + fraction * extent);
}

/** Whether a series value has a position on the scale: any value that is not missing (NaN), and on a log scale only one above 0. */
export function hasScalePosition(scale: Scale, value: number | undefined): boolean {
  return !Number.isNaN(value) && (scale !== SCALE_LOG || (value as number) > 0);
}
