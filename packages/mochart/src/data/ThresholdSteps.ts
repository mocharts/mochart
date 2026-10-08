import { deepMerge } from '../config/core/deepMerge.js';
import { getThresholdEntryDefaults } from '../config/defaults/axisConfig.js';
import { getDateIntervalOrigin, getFirstKeptStep, getKeptPeriodStarts, getNextPeriodStart, getPeriodIndex, getStepCandidates } from './Steps.js';
import { NONE, SCALE_ORDINAL, TYPE_DATE } from '../config/core/constants.js';
import type { ResolvedThreshold } from '../config/defaults/axisConfig.js';
import type { CategoryAxisThresholdStepConfig } from '../types/config.js';
import type { DataType, Scale } from '../config/core/constants.js';
import type { CategoryValue } from '../types/data.js';

export interface ThresholdStepAxisConfig {
  scale: Scale;
  type: DataType;
  dateUTC?: boolean;
  /** A value axis's number interval fits the category axis's wider one. */
  thresholdStep: CategoryAxisThresholdStepConfig;
}

function toThresholdValue(categoryValue: CategoryValue): number | string {
  return categoryValue instanceof Date ? categoryValue.getTime() : categoryValue;
}

/** The pixel distance between the thresholds a linear rule would draw: the domain share of one kept step, scaled to the axis length. */
function getSteppedThresholdSpacing(axisConfig: ThresholdStepAxisConfig, domainMin: number, domainMax: number, axisLength: number): number {
  const step = axisConfig.thresholdStep;
  const dateUTC = axisConfig.dateUTC ?? true;
  const { interval } = step;
  if (axisConfig.type === TYPE_DATE && typeof interval === 'string') {
    // the periods touching the domain, including the one under way at its start
    const periods = getPeriodIndex(interval, dateUTC, new Date(domainMax)) - getPeriodIndex(interval, dateUTC, new Date(domainMin)) + 1;
    return axisLength * step.count / periods;
  }
  if (typeof interval !== 'number' || !(interval > 0)) {
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
 * boundaries of a linear date axis, or the multiples of a number interval, milliseconds on a date axis. An
 * ordinal threshold names its category the way an explicit entry does, by the category's key, so the keys are
 * given alongside the values the candidates are found from; they are the values themselves without a
 * keyProperty. On a linear axis the rule draws nothing when its thresholds would be closer than minSpacing along
 * an axis of axisLength pixels.
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
    const { candidates, selected } = getStepCandidates(step, categoryValues, axisConfig.type, dateUTC);
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
  const { interval } = step;
  if (axisConfig.type === TYPE_DATE && typeof interval === 'string') {
    const period = interval;
    // the period holding the domain start counts too, so a range already under way is drawn clipped
    for (const boundary of getKeptPeriodStarts(period, dateUTC, new Date(domainMin), new Date(domainMax), step.count, step.offset)) {
      add(boundary.getTime(), getNextPeriodStart(period, dateUTC, boundary).getTime());
    }
    return thresholds;
  }

  if (typeof interval !== 'number' || !(interval > 0)) {
    return thresholds;
  }
  // a number interval counts its multiples from 0, or on a date axis in milliseconds from the epoch
  const origin = axisConfig.type === TYPE_DATE ? getDateIntervalOrigin(dateUTC) : 0;
  const firstMultiple = Math.floor((domainMin - origin) / interval);
  // a line sits at each multiple up to the domain max; a range starting at the top multiple would lie wholly outside the domain
  const lastMultiple = step.range ? Math.ceil((domainMax - origin) / interval) - 1 : Math.floor((domainMax - origin) / interval + 1e-9);
  for (let multiple = getFirstKeptStep(firstMultiple, step.count, step.offset); multiple <= lastMultiple; multiple += step.count) {
    add(origin + multiple * interval, origin + (multiple + 1) * interval);
  }
  return thresholds;
}
