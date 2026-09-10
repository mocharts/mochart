// Derives a reused demo's random spec from its curated dataset, so the seeds
// keep close to the curated category range, spacing and value range instead
// of jumping to demo-data's shared defaults (15 categories spread over 2014 to
// 2018, values between -500 and 500).

import type { DataObject, DemoConfig, RandomConfig } from '@mochart/demo-data';

type DateUnit = RandomConfig['category']['date']['intervalUnit'];

const DAY_MILLIS = 86400000;

// demo-common's random schema caps string lengths at 20; past 21 digits the
// generator's number prints in exponent form and its letters turn to NUL.
const MAX_STRING_LENGTH = 20;

const DATE_UNITS: [DateUnit, number][] = [
  ['day', DAY_MILLIS],
  ['hour', 3600000],
  ['minute', 60000],
  ['second', 1000]
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The typical distance between neighbouring sorted values, or 0 if there is none. */
function typicalGap(sorted: number[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] > sorted[i - 1]) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }
  }
  return gaps.length === 0 ? 0 : median(gaps);
}

function slots(range: number, interval: number): number {
  return Math.floor(range / interval) + 1;
}

// The pool extends past the curated ends by about a sixth of the categories
// on each side, so a seed's min and max wander a few steps and settle back.
function margin(interval: number, count: number): number {
  return interval * Math.max(1, Math.round((count - 1) / 6));
}

// The generator redraws until it finds an unused category value, so the range
// has to hold at least as many distinct slots as categories or it never
// returns. Exactly as many is fine: the categories are then fixed and only
// the values change between seeds.
function fitInterval(range: number, interval: number, count: number, minimum: number): number {
  let result = interval;
  while (slots(range, result) < count && result / 2 >= minimum) {
    result /= 2;
  }
  return result;
}

function categoryValues(rows: DataObject[], property: string): unknown[] {
  return rows.map(row => row[property]).filter(value => value !== undefined && value !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toMillis(value: unknown): number {
  return typeof value === 'number' ? value : new Date(String(value)).getTime();
}

function deriveDate(values: unknown[], count: number): Partial<RandomConfig['category']> | null {
  const millis = values.map(toMillis).filter(Number.isFinite).sort((a, b) => a - b);
  if (millis.length < 2) {
    return null;
  }
  let min = millis[0];
  let max = millis[millis.length - 1];
  const range = max - min;
  let interval = typicalGap(millis);
  if (range === 0 || interval === 0) {
    return null;
  }
  if (slots(range, interval) < count) {
    // Irregular gaps (calendar months, uneven samples): space exactly count
    // slots evenly over the range, shifted by half a step so that calendar
    // labels such as "%b" stay distinct.
    interval = Math.max(1000, Math.floor(range / (count - 1) / 1000) * 1000);
    min += interval / 2;
    max = min + interval * (count - 1) + 1;
  }
  // The spec's interval is a whole number of its unit, so a gap that is not
  // one (sub-second samples, say) rounds to the nearest whole second.
  const [unit, unitMillis] = DATE_UNITS.find(([, size]) => interval % size === 0) ?? DATE_UNITS[DATE_UNITS.length - 1];
  interval = Math.max(unitMillis, Math.round(interval / unitMillis) * unitMillis);
  min -= margin(interval, count);
  max += margin(interval, count);
  // Times within one UTC day keep their pool inside that day, so a time-only
  // tick format cannot show the same time twice.
  const dayStart = Math.floor(millis[0] / DAY_MILLIS) * DAY_MILLIS;
  if (millis[millis.length - 1] < dayStart + DAY_MILLIS) {
    min = Math.max(min, dayStart);
    max = Math.min(max, dayStart + DAY_MILLIS - 1);
  }
  return {
    count: Math.min(count, slots(max - min, interval)),
    date: {
      min: new Date(min).toISOString(),
      max: new Date(max).toISOString(),
      interval: interval / unitMillis,
      intervalUnit: unit
    }
  };
}

function deriveNumber(values: unknown[], count: number): Partial<RandomConfig['category']> | null {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (numbers.length < 2) {
    return null;
  }
  const range = numbers[numbers.length - 1] - numbers[0];
  const gap = typicalGap(numbers);
  if (range === 0 || gap === 0) {
    return null;
  }
  const integers = numbers.every(Number.isInteger);
  const interval = fitInterval(range, gap, count, integers ? 1 : gap / 8);
  // Curated categories that never go negative keep their pool at or above 0.
  const min = Math.max(numbers[0] - margin(interval, count), numbers[0] >= 0 ? 0 : -Infinity);
  const max = numbers[numbers.length - 1] + margin(interval, count);
  return {
    count: Math.min(count, slots(max - min, interval)),
    number: { min, max, interval }
  };
}

function deriveString(values: unknown[], count: number): Partial<RandomConfig['category']> | null {
  const lengths = values.filter((value): value is string => typeof value === 'string').map(value => value.length);
  if (lengths.length === 0) {
    return null;
  }
  let maxLength = Math.max(1, Math.min(MAX_STRING_LENGTH, Math.max(...lengths)));
  const minLength = Math.min(maxLength, Math.max(1, Math.min(...lengths)));
  // The string generator spells out a number with minLength to maxLength
  // digits, so the digit range decides how many distinct strings exist.
  while (maxLength < MAX_STRING_LENGTH && Math.pow(10, maxLength - 1) - Math.pow(10, minLength - 1) < count * 2) {
    maxLength++;
  }
  return { string: { minLength, maxLength } };
}

/** The data properties the config's series read (property, rangeProperty, labelProperty, ...). */
function seriesProperties(config: DemoConfig): Set<string> {
  const result = new Set<string>();
  const series = Array.isArray(config.series) ? config.series : [config.series];
  for (const entry of series) {
    if (isRecord(entry)) {
      for (const [key, value] of Object.entries(entry)) {
        if (typeof value === 'string' && (key === 'property' || key.endsWith('Property'))) {
          result.add(value);
        }
      }
    }
  }
  return result;
}

function deriveSeriesNumber(rows: DataObject[], properties: Set<string>): RandomConfig['series']['number'] | null {
  const numbers: number[] = [];
  for (const row of rows) {
    for (const property of properties) {
      const value = row[property];
      if (typeof value === 'number' && Number.isFinite(value)) {
        numbers.push(value);
      }
    }
  }
  if (numbers.length === 0) {
    return null;
  }
  const min = Math.floor(Math.min(...numbers));
  const max = Math.ceil(Math.max(...numbers));
  return {
    min,
    max: max > min ? max : min + 10,
    round: numbers.every(Number.isInteger),
    // The curated values already respect the config, or exceed it on purpose
    // (the clipped demo), so the axis bounds must not clamp the generated ones.
    limitToAxisConfig: false
  };
}

/**
 * The demo's generic random spec with its category count, category range and
 * series value range replaced by what the curated rows show, the category
 * range widened by a small margin. Missing-value probabilities, ordering and
 * reuse fractions stay as the demo set them. Any part that cannot be derived
 * keeps the demo's value.
 */
export function randomFromCurated(config: DemoConfig, rows: DataObject[], random: RandomConfig): RandomConfig {
  const categoryAxis = isRecord(config.categoryAxis) ? config.categoryAxis : {};
  const property = typeof categoryAxis.property === 'string' ? categoryAxis.property : '';
  const type = typeof categoryAxis.type === 'string' ? categoryAxis.type : 'string';
  const values = categoryValues(rows, property);
  const count = values.length;
  const category = count === 0 ? null
    : type === 'date' ? deriveDate(values, count)
    : type === 'number' ? deriveNumber(values, count)
    : deriveString(values, count);

  const seriesNumber = deriveSeriesNumber(rows, seriesProperties(config));

  return {
    category: { ...random.category, count, ...category },
    series: { ...random.series, number: seriesNumber ?? random.series.number }
  };
}
