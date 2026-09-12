import { deepMerge } from '../config/core/deepMerge';
import { getThresholdEntryDefaults } from '../config/defaults/axisConfig';
import { getNextPeriodStart, getPeriodStart, getStepCandidates } from './Steps';
import { NONE, SCALE_ORDINAL, TYPE_DATE } from '../config/core/constants';
import type { ResolvedThreshold } from '../config/defaults/axisConfig';
import type { AxisThresholdStepConfig, CategoryAxisThresholdStepConfig } from '../types/config';
import type { DataType, Scale } from '../config/core/constants';
import type { CategoryValue } from '../types/data';

/** The most shapes one thresholdStep rule draws, so a tiny interval on a wide domain cannot flood the plot. */
export const THRESHOLD_STEP_SHAPE_CAP = 500;

export interface ThresholdStepAxisConfig {
  scale: Scale;
  type: DataType;
  dateUTC?: boolean;
  /** A value axis's step has no period, so it is optional here. */
  thresholdStep: AxisThresholdStepConfig & Partial<Pick<CategoryAxisThresholdStepConfig, 'period'>>;
}

function toThresholdValue(categoryValue: CategoryValue): number | string {
  return categoryValue instanceof Date ? categoryValue.getTime() : categoryValue;
}

/**
 * The thresholds a thresholdStep rule expands to: one line or range per selected candidate, sharing the
 * rule's style and fill. The candidates are the ordinal categories (or the first of each period), the period
 * boundaries of a linear date axis, or the multiples of the interval on a number scale.
 */
export function getSteppedThresholds(axisConfig: ThresholdStepAxisConfig, axisDomain: [number | Date | null, number | Date | null], categoryValues: readonly CategoryValue[] | null): ResolvedThreshold[] {
  const step = axisConfig.thresholdStep;
  if (!step.visible) {
    return [];
  }
  const base = deepMerge(getThresholdEntryDefaults(), { front: step.front, style: step.style, pattern: step.pattern, gradient: step.gradient }) as unknown as ResolvedThreshold;
  const thresholds: ResolvedThreshold[] = [];
  const add = (value: number | string, rangeValue: number | string | null) => {
    if (thresholds.length < THRESHOLD_STEP_SHAPE_CAP) {
      thresholds.push({ ...base, value, rangeValue: step.range ? rangeValue : NONE });
    }
  };
  const dateUTC = axisConfig.dateUTC ?? true;

  if (axisConfig.scale === SCALE_ORDINAL) {
    if (categoryValues === null || categoryValues.length === 0) {
      return thresholds;
    }
    const { candidates, selected } = getStepCandidates({ period: step.period ?? NONE, count: step.count, offset: step.offset }, categoryValues, axisConfig.type, dateUTC);
    for (const index of selected) {
      // a range runs to the category before the next candidate, the last of its period
      const next = candidates.find(candidate => candidate > index);
      const endIndex = next === undefined ? categoryValues.length - 1 : next - 1;
      add(toThresholdValue(categoryValues[index]!), toThresholdValue(categoryValues[endIndex]!));
    }
    return thresholds;
  }

  const domainMin = axisDomain[0]?.valueOf();
  const domainMax = axisDomain[1]?.valueOf();
  if (typeof domainMin !== 'number' || typeof domainMax !== 'number' || !(domainMax > domainMin)) {
    return thresholds;
  }
  const keep = (position: number) => position >= step.offset && (position - step.offset) % step.count === 0;

  if (axisConfig.type === TYPE_DATE) {
    if (step.period === undefined || step.period === NONE) {
      return thresholds;
    }
    // the period holding the domain start counts too, so a band already under way is drawn clipped
    let boundary = getPeriodStart(step.period, dateUTC, new Date(domainMin));
    let position = 0;
    while (boundary.getTime() <= domainMax && thresholds.length < THRESHOLD_STEP_SHAPE_CAP) {
      const nextBoundary = getNextPeriodStart(step.period, dateUTC, boundary);
      if (keep(position)) {
        add(boundary.getTime(), nextBoundary.getTime());
      }
      boundary = nextBoundary;
      position += 1;
    }
    return thresholds;
  }

  const { interval } = step;
  if (interval === NONE || !(interval > 0)) {
    return thresholds;
  }
  const firstMultiple = Math.floor(domainMin / interval);
  const lastMultiple = Math.ceil(domainMax / interval);
  for (let multiple = firstMultiple, position = 0; multiple < lastMultiple && thresholds.length < THRESHOLD_STEP_SHAPE_CAP; multiple++, position++) {
    if (keep(position)) {
      add(multiple * interval, (multiple + 1) * interval);
    }
  }
  return thresholds;
}
