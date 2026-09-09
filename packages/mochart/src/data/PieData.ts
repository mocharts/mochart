import type { PieConfig, SeriesConfig } from '../types/config';
import type { SeriesValueObject } from '../types/data';

export interface PieSliceAngles {
  /** Radians, clockwise from the top (d3 arc convention). */
  startAngle: number;
  endAngle: number;
  /** The slice's fraction of the summed (filtered) values. */
  fraction: number;
  /** The slice's clamped value. */
  value: number;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Clamps each value (missing/non-finite/non-positive count as 0) and returns each one's fraction of the total; an overflowed total stays Infinity while the fractions re-derive in units of the largest value. */
export function computeSliceFractions(values: readonly (number | null | undefined)[]): { total: number; values: number[]; fractions: number[] } {
  const clamped = values.map(value => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0));
  const total = clamped.reduce((sum, value) => sum + value, 0);
  if (total === Infinity) {
    const max = clamped.reduce((largest, value) => Math.max(largest, value), 0);
    const scaledTotal = clamped.reduce((sum, value) => sum + value / max, 0);
    return { total, values: clamped, fractions: clamped.map(value => value / max / scaledTotal) };
  }
  return { total, values: clamped, fractions: clamped.map(value => (total > 0 ? value / total : 0)) };
}

/**
 * Each slice's clamped value and fraction of the total, from whichever value
 * the accessor returns. The slice geometry and the pie tooltip both normalize
 * through here — the tooltip reads scalars off a single category while the
 * slices read per-category arrays — so a percentage can never mean one thing
 * in a label and another in the tooltip.
 */
export function getPieSliceFractions(seriesConfigs: SeriesConfig[], valueOf: (seriesId: string) => number | null | undefined):
  { total: number; values: number[]; fractions: number[] } {
  return computeSliceFractions(seriesConfigs.map(seriesConfig => valueOf(seriesConfig.id)));
}

/**
 * The slice fractions keyed by series id, for the pie tooltip's percent
 * values: it holds one category's values as scalars (not the per-category arrays the
 * slices work from), so it passes its own accessor.
 */
export function getPieSliceFractionMap(seriesConfigs: SeriesConfig[], valueOf: (seriesId: string) => number | null | undefined): Record<string, number> {
  const { fractions } = getPieSliceFractions(seriesConfigs, valueOf);
  const fractionMap: Record<string, number> = Object.create(null);
  seriesConfigs.forEach((seriesConfig, i) => {
    fractionMap[seriesConfig.id] = fractions[i];
  });
  return fractionMap;
}

/**
 * Computes each slice's angles from the current (possibly mid-tween) filtered
 * values. Slices follow the series config order — never the focus draw order —
 * so focusing a slice cannot move it. Filtered series (null plain values)
 * and non-positive values contribute nothing; a non-positive total yields an
 * empty map (no slices). Recomputing per sync from tweened values is what
 * animates the angles: adjacent slice edges share a normalized total, so they
 * can never separate mid-tween.
 */
export function getPieSliceAngles(seriesConfigs: SeriesConfig[], filteredValues: Record<string, SeriesValueObject>, pieConfig: PieConfig, categoryIndex = 0): Record<string, PieSliceAngles> {
  const { total, values, fractions } = getPieSliceFractions(seriesConfigs, seriesId => {
    const valueObject = filteredValues[seriesId];
    const plain = valueObject !== undefined ? valueObject.plain : null;
    return plain !== null ? plain[categoryIndex] : undefined;
  });

  const angles: Record<string, PieSliceAngles> = Object.create(null);
  if (total <= 0) {
    return angles;
  }
  const startOffset = degreesToRadians(pieConfig.startAngle);
  // The slices divide the configured span (a full circle by default; e.g.
  // -90..90 makes a half/gauge pie). A negative span runs counterclockwise.
  const span = degreesToRadians(pieConfig.endAngle - pieConfig.startAngle);
  let cumulative = 0;
  seriesConfigs.forEach((seriesConfig, i) => {
    const value = values[i];
    const fraction = fractions[i];
    const startAngle = startOffset + cumulative * span;
    cumulative += fraction;
    angles[seriesConfig.id] = {
      startAngle,
      endAngle: startOffset + cumulative * span,
      fraction,
      value
    };
  });
  return angles;
}

/**
 * Scales every slice's angles toward the configured start angle for the
 * initial sweep-in animation: at `percentage` 0 all slices collapse onto the
 * starting edge, at 1 they are back at their computed angles. Fractions and
 * values are preserved (they drive labels and the center total).
 */
export function sweepPieSliceAngles(angles: Record<string, PieSliceAngles>, pieConfig: PieConfig, percentage: number): Record<string, PieSliceAngles> {
  if (percentage >= 1) {
    return angles;
  }
  const clamped = Math.max(percentage, 0);
  const startOffset = degreesToRadians(pieConfig.startAngle);
  const swept: Record<string, PieSliceAngles> = Object.create(null);
  for (const id of Object.keys(angles)) {
    const sliceAngles = angles[id];
    swept[id] = {
      startAngle: startOffset + (sliceAngles.startAngle - startOffset) * clamped,
      endAngle: startOffset + (sliceAngles.endAngle - startOffset) * clamped,
      fraction: sliceAngles.fraction,
      value: sliceAngles.value
    };
  }
  return swept;
}
