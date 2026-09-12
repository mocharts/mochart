import { AUTO, NONE, TYPE_DATE, STEP_PERIOD_YEAR, STEP_PERIOD_MONTH, STEP_PERIOD_WEEK } from '../config/core/constants';
import type { Auto, DataType, StepPeriod } from '../config/core/constants';
import type { CategoryValue } from '../types/data';

/** The rule members the tick and threshold steps share: which candidates, and which of them are kept. */
export interface StepRule {
  period: StepPeriod | null;
  count: number | Auto;
  offset: number;
  includeFirst?: boolean;
}

// The start of the calendar period holding the date; a week starts on Monday, and the boundary
// follows dateUTC like the tick label formatting does.
export function getPeriodStart(period: StepPeriod, dateUTC: boolean, date: Date): Date {
  const year = dateUTC ? date.getUTCFullYear() : date.getFullYear();
  const month = period === STEP_PERIOD_YEAR ? 0 : (dateUTC ? date.getUTCMonth() : date.getMonth());
  let day = 1;
  if (period !== STEP_PERIOD_YEAR && period !== STEP_PERIOD_MONTH) {
    day = dateUTC ? date.getUTCDate() : date.getDate();
    if (period === STEP_PERIOD_WEEK) {
      day -= ((dateUTC ? date.getUTCDay() : date.getDay()) + 6) % 7;
    }
  }
  return dateUTC ? new Date(Date.UTC(year, month, day)) : new Date(year, month, day);
}

export function getNextPeriodStart(period: StepPeriod, dateUTC: boolean, periodStart: Date): Date {
  let year = dateUTC ? periodStart.getUTCFullYear() : periodStart.getFullYear();
  let month = dateUTC ? periodStart.getUTCMonth() : periodStart.getMonth();
  let day = dateUTC ? periodStart.getUTCDate() : periodStart.getDate();
  if (period === STEP_PERIOD_YEAR) {
    year += 1;
  }
  else if (period === STEP_PERIOD_MONTH) {
    month += 1;
  }
  else {
    day += period === STEP_PERIOD_WEEK ? 7 : 1;
  }
  return dateUTC ? new Date(Date.UTC(year, month, day)) : new Date(year, month, day);
}

/** The period boundaries inside a linear date domain, the linear axis's ticks under a period step. */
export function getPeriodBoundaries(period: StepPeriod, dateUTC: boolean, [domainStart, domainEnd]: [Date, Date]): Date[] {
  const boundaries: Date[] = [];
  let boundary = getPeriodStart(period, dateUTC, domainStart);
  if (boundary.getTime() < domainStart.getTime()) {
    boundary = getNextPeriodStart(period, dateUTC, boundary);
  }
  while (boundary.getTime() <= domainEnd.getTime()) {
    boundaries.push(boundary);
    boundary = getNextPeriodStart(period, dateUTC, boundary);
  }
  return boundaries;
}


/**
 * The category indexes a step rule works from: the candidates are every category, or under a period on a date
 * axis the first category of each period, and `selected` steps through them by count and offset, with
 * includeFirst adding the first category back.
 */
export function getStepCandidates(rule: StepRule, categoryValues: readonly CategoryValue[], type: DataType, dateUTC: boolean): { candidates: number[]; selected: number[] } {
  const { period, count, offset, includeFirst = false } = rule;
  let candidates: number[];
  if (period !== NONE && type === TYPE_DATE) {
    candidates = [];
    let previousPeriodStart = NaN;
    categoryValues.forEach((categoryValue, index) => {
      const periodStart = getPeriodStart(period, dateUTC, categoryValue as Date).getTime();
      if (periodStart !== previousPeriodStart) {
        candidates.push(index);
        previousPeriodStart = periodStart;
      }
    });
  }
  else {
    candidates = categoryValues.map((_v, index) => index);
  }
  const selected = candidates.filter((_index, position) => position >= offset && (count === AUTO || (position - offset) % count === 0));
  if (includeFirst && categoryValues.length > 0 && selected[0] !== 0) {
    selected.unshift(0);
  }
  return { candidates, selected };
}
