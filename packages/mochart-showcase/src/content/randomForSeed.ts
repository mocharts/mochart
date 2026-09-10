// The seed's effect on a generic random spec: nothing is pinned across every
// step, and the category window walks away from the curated one as the seed
// climbs. Without this a step only reshuffles values inside a fixed window,
// because half the categories come from the shared 'global' seed and the rest
// are drawn from a pool wide enough that they always reach both of its ends.

import type { DemoRandomConfig, RandomConfig } from '@mochart/demo-data';

import type { WalkBounds } from './types';

type CategoryConfig = RandomConfig['category'];

const DAY_MILLIS = 86400000;

const UNIT_MILLIS: Record<string, number> = {
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: DAY_MILLIS
};

// Step 1 moves a third of a step so the first move away from the curated data
// stays small; from step 3 on the walk runs at full size.
const RAMP_STEPS = 3;
const STEP_SHIFT_FRACTION = 0.35;
const STEP_SCALE = 1.25;
const MAX_SHIFT_SPANS = 1.5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SIGNIFICANT_DIGITS = 3;

interface Walk {
  /** Distance from the curated window's centre, in spans. */
  shift: number;
  /** The curated span and interval are both multiplied by this. */
  scale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// A step's deltas depend only on its index, so the walk is the same on every
// visit and a shared seed URL reproduces it.
function uniform(step: number, salt: number): number {
  let hash = Math.imul(step ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2545f491);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967296;
}

function signed(step: number, salt: number): number {
  return uniform(step, salt) * 2 - 1;
}

function walkTo(seed: number): Walk {
  let shift = 0;
  let scale = 1;
  for (let step = 1; step <= seed; step++) {
    const ramp = Math.min(1, step / RAMP_STEPS);
    shift = clamp(shift + signed(step, 0) * STEP_SHIFT_FRACTION * ramp, -MAX_SHIFT_SPANS, MAX_SHIFT_SPANS);
    scale = clamp(scale * Math.pow(STEP_SCALE, signed(step, 1) * ramp), MIN_SCALE, MAX_SCALE);
  }
  return { shift, scale };
}

function slots(span: number, interval: number): number {
  return Math.floor(span / interval) + 1;
}

// Folds a position back into [min, max] rather than clamping, so a window with
// little room to move keeps moving instead of sticking against the limit.
function reflect(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  const period = 2 * (max - min);
  const offset = (((value - min) % period) + period) % period;
  return min + (offset <= max - min ? offset : period - offset);
}

/** Whole numbers stay whole; fractional ones keep the curated interval's rough precision. */
function tidy(value: number, whole: boolean): number {
  if (whole) {
    return Math.round(value);
  }
  if (value === 0) {
    return 0;
  }
  const magnitude = Math.pow(10, SIGNIFICANT_DIGITS - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.round(value * magnitude) / magnitude;
}

function toMillis(value: string): number {
  return new Date(value).getTime();
}

/** Keeps the window on whole interval units, so the categories stay as round as the curated ones. */
function snap(millis: number, unitMillis: number): number {
  return Math.round(millis / unitMillis) * unitMillis;
}

function walkDate(date: CategoryConfig['date'], walk: Walk): CategoryConfig['date'] {
  const unitMillis = UNIT_MILLIS[date.intervalUnit] ?? 1000;
  const min = toMillis(date.min);
  const max = toMillis(date.max);
  const curatedSpan = max - min;
  // The slot count is held so the pool keeps room for every category: the
  // generator redraws until it finds an unused value.
  const count = slots(curatedSpan, date.interval * unitMillis);
  // Scaling a window that spans days closes the gaps between its categories,
  // and a calendar tick format then labels two of them the same month. Only a
  // window inside one day, where the labels are times, takes the scale.
  const dayStart = Math.floor(min / DAY_MILLIS) * DAY_MILLIS;
  const sameDay = max < dayStart + DAY_MILLIS;
  let interval = sameDay ? Math.max(1, Math.round(date.interval * walk.scale)) : date.interval;
  let span = interval * unitMillis * (count - 1);
  let windowMin = (min + max) / 2 + walk.shift * curatedSpan - span / 2;
  // A curated window inside one UTC day stays there, so a time-only tick
  // format cannot print the same time twice.
  if (sameDay) {
    const room = DAY_MILLIS - unitMillis;
    if (span > room && count > 1) {
      interval = Math.max(1, Math.floor(room / (count - 1) / unitMillis));
      span = interval * unitMillis * (count - 1);
    }
    windowMin = reflect(windowMin, dayStart, dayStart + room - span);
    windowMin = clamp(snap(windowMin, unitMillis), dayStart, dayStart + room - span);
  }
  else {
    windowMin = snap(windowMin, unitMillis);
  }
  return {
    ...date,
    min: new Date(windowMin).toISOString(),
    max: new Date(windowMin + span).toISOString(),
    interval
  };
}

function walkNumber(number: CategoryConfig['number'], walk: Walk, bounds: WalkBounds | undefined): CategoryConfig['number'] {
  const curatedSpan = number.max - number.min;
  const count = slots(curatedSpan, number.interval);
  const whole = Number.isInteger(number.interval);
  const scaled = tidy(number.interval * walk.scale, whole);
  let interval = whole ? Math.max(1, scaled) : scaled;
  let span = interval * (count - 1);
  // An entry with bounds keeps its whole window inside them: the interval is
  // held so the window fits, and the window folds back off either end.
  if (bounds !== undefined) {
    const room = bounds.max - bounds.min;
    if (span > room && count > 1) {
      interval = whole ? Math.max(1, Math.floor(room / (count - 1))) : tidy(room / (count - 1), false);
      span = interval * (count - 1);
    }
  }
  let min = tidy((number.min + number.max) / 2 + walk.shift * curatedSpan - span / 2, whole);
  // Categories the curated data keeps at or above zero stay there.
  if (number.min >= 0 && min < 0) {
    min = -min;
  }
  if (bounds !== undefined) {
    min = bounds.max - span <= bounds.min ? bounds.min : tidy(reflect(min, bounds.min, bounds.max - span), whole);
  }
  // The generator counts slots as floor((max - min) / interval) + 1 and redraws
  // until every category has one, so a fractional interval whose rounding
  // loses a slot would spin forever; the top is nudged until the count holds.
  let max = min + span;
  while (slots(max - min, interval) < count) {
    max += interval * 1e-9;
  }
  return { min, max, interval };
}

function isGeneric(random: DemoRandomConfig): random is RandomConfig {
  return 'category' in random;
}

/**
 * The spec a seed generates from: the demo's own spec with its category reuse
 * unpinned and its category window walked. String categories have no window,
 * so they change through the reuse alone. Chart-type generator specs own their
 * own model and pass through untouched. `bounds` holds a number window inside
 * a range (see ShowcaseEntry.walkBounds).
 */
export function randomForSeed(random: DemoRandomConfig, seed: number, bounds?: WalkBounds): DemoRandomConfig {
  if (!isGeneric(random)) {
    return random;
  }
  const { category } = random;
  const walk = walkTo(seed);
  return {
    ...random,
    category: {
      ...category,
      // Global reuse holds half the categories on a fixed seed, which pins the
      // window whatever else moves. The half-step share stays as the demo set
      // it: it still lines adjacent steps up where the window barely moves.
      reuse: { globalFraction: 0, stepFraction: category.reuse.stepFraction },
      date: walkDate(category.date, walk),
      number: walkNumber(category.number, walk, bounds)
    }
  };
}
