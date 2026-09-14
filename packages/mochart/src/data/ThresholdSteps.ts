import { deepMerge } from '../config/core/deepMerge';
import { getThresholdEntryDefaults } from '../config/defaults/axisConfig';
import { getNextPeriodStart, getPeriodIndex, getPeriodStart, getStepCandidates } from './Steps';
import { NONE, SCALE_ORDINAL, TYPE_DATE } from '../config/core/constants';
import type { ResolvedThreshold } from '../config/defaults/axisConfig';
import type { AxisThresholdStepConfig, CategoryAxisThresholdStepConfig } from '../types/config';
import type { DataType, Scale } from '../config/core/constants';
import type { CategoryValue } from '../types/data';

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

/** The pixel distance between the thresholds a linear rule would draw: the domain share of one kept step, scaled to the axis length. */
function getSteppedThresholdSpacing(axisConfig: ThresholdStepAxisConfig, domainMin: number, domainMax: number, axisLength: number): number {
  const step = axisConfig.thresholdStep;
  const dateUTC = axisConfig.dateUTC ?? true;
  if (axisConfig.type === TYPE_DATE) {
    const period = step.period;
    if (period === undefined || period === NONE) {
      return Infinity;
    }
    // the periods touching the domain, including the one under way at its start
    const periods = getPeriodIndex(period, dateUTC, new Date(domainMax)) - getPeriodIndex(period, dateUTC, new Date(domainMin)) + 1;
    return axisLength * step.count / periods;
  }
  const { interval } = step;
  if (interval === NONE || !(interval > 0)) {
    return Infinity;
  }
  return axisLength * interval * step.count / (domainMax - domainMin);
}

/** Whether a linear rule draws at all: its thresholds must sit at least minSpacing apart, counted before any is built. */
export function steppedThresholdsFit(axisConfig: ThresholdStepAxisConfig, axisDomain: [number | Date | null, number | Date | null], axisLength: number): boolean {
  const domainMin = axisDomain[0]?.valueOf();
  const domainMax = axisDomain[1]?.valueOf();
  if (axisConfig.scale === SCALE_ORDINAL || typeof domainMin !== 'number' || typeof domainMax !== 'number' || !(domainMax > domainMin)) {
    return true;
  }
  return getSteppedThresholdSpacing(axisConfig, domainMin, domainMax, axisLength) >= axisConfig.thresholdStep.minSpacing;
}

/**
 * The thresholds a thresholdStep rule expands to: one line or range per selected candidate, sharing the
 * rule's style and fill. The candidates are the ordinal categories (or the first of each period), the period
 * boundaries of a linear date axis, or the multiples of the interval on a number scale. An ordinal threshold
 * names its category the way an explicit entry does, by the category's key, so the keys are given alongside
 * the values the candidates are found from; they are the values themselves without a keyProperty. On a linear
 * axis the rule draws nothing when its thresholds would be closer than minSpacing along an axis of axisLength pixels.
 */
export function getSteppedThresholds(axisConfig: ThresholdStepAxisConfig, axisDomain: [number | Date | null, number | Date | null], categoryValues: readonly CategoryValue[] | null, categoryKeys: readonly CategoryValue[] | null = categoryValues, axisLength = Infinity): ResolvedThreshold[] {
  const step = axisConfig.thresholdStep;
  if (!step.visible || !steppedThresholdsFit(axisConfig, axisDomain, axisLength)) {
    return [];
  }
  const base = deepMerge(getThresholdEntryDefaults(), { front: step.front, style: step.style, pattern: step.pattern, gradient: step.gradient }) as unknown as ResolvedThreshold;
  const thresholds: ResolvedThreshold[] = [];
  const add = (value: number | string, rangeValue: number | string | null) => {
    thresholds.push({ ...base, value, rangeValue: step.range ? rangeValue : NONE });
  };
  const dateUTC = axisConfig.dateUTC ?? true;

  if (axisConfig.scale === SCALE_ORDINAL) {
    if (categoryValues === null || categoryValues.length === 0) {
      return thresholds;
    }
    const keys = categoryKeys ?? categoryValues;
    const { candidates, selected } = getStepCandidates({ period: step.period ?? NONE, count: step.count, offset: step.offset }, categoryValues, axisConfig.type, dateUTC);
    for (const index of selected) {
      // a range runs to the category before the next candidate, the last of its period
      const next = candidates.find(candidate => candidate > index);
      const endIndex = next === undefined ? categoryValues.length - 1 : next - 1;
      add(toThresholdValue(keys[index]!), toThresholdValue(keys[endIndex]!));
    }
    return thresholds;
  }

  const domainMin = axisDomain[0]?.valueOf();
  const domainMax = axisDomain[1]?.valueOf();
  if (typeof domainMin !== 'number' || typeof domainMax !== 'number' || !(domainMax > domainMin)) {
    return thresholds;
  }
  // a linear scale phases the rule on the step's own index (the multiple, or the period from a fixed calendar
  // origin), not on where the domain starts, so the same steps keep their shapes as the data moves the domain
  const keep = (index: number) => ((index - step.offset) % step.count + step.count) % step.count === 0;

  if (axisConfig.type === TYPE_DATE) {
    if (step.period === undefined || step.period === NONE) {
      return thresholds;
    }
    // the period holding the domain start counts too, so a range already under way is drawn clipped
    let boundary = getPeriodStart(step.period, dateUTC, new Date(domainMin));
    while (boundary.getTime() <= domainMax) {
      const nextBoundary = getNextPeriodStart(step.period, dateUTC, boundary);
      if (keep(getPeriodIndex(step.period, dateUTC, boundary))) {
        add(boundary.getTime(), nextBoundary.getTime());
      }
      boundary = nextBoundary;
    }
    return thresholds;
  }

  const { interval } = step;
  if (interval === NONE || !(interval > 0)) {
    return thresholds;
  }
  const firstMultiple = Math.floor(domainMin / interval);
  const lastMultiple = Math.ceil(domainMax / interval);
  for (let multiple = firstMultiple; multiple < lastMultiple; multiple++) {
    if (keep(multiple)) {
      add(multiple * interval, (multiple + 1) * interval);
    }
  }
  return thresholds;
}
