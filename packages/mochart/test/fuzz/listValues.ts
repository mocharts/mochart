// Tick and threshold values taken from a base's own categories and series values, so an explicit tick or
// threshold lands on a category or inside the axis domain and is drawn, rather than hidden at a made-up value.
import type { Candidate, PropertySpec } from './configModel';
import type { BaseCase } from './runner';

type AxisValue = string | number;

interface AxisValues {
  first: AxisValue;
  middle: AxisValue;
  last: AxisValue;
  /** The middle value written the other way a date axis accepts it (ISO string or timestamp), if any. */
  other: AxisValue | null;
  /** A value that matches no category or lies outside the domain, for the hidden case. */
  missing: AxisValue;
}

const LINE_STYLE = { normal: { strokeColor: '#c02942', strokeOpacity: 1, strokeWidth: 2 } };
const RANGE_STYLE = { normal: { strokeOpacity: 0, fillColor: '#1e78c8', fillOpacity: 0.3 } };
const LONG_LABEL = 'A considerably longer string, long enough to need truncating';
const DAY = 86400000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every value of one data property, from either data shape. */
function columnValues(data: unknown, property: string): unknown[] {
  if (Array.isArray(data)) {
    return data.map(row => (isRecord(row) ? row[property] : undefined));
  }
  if (isRecord(data) && Array.isArray(data[property])) {
    return data[property] as unknown[];
  }
  return [];
}

function toTime(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  return typeof value === 'number' ? value : Date.parse(String(value));
}

function spread(values: number[], log: boolean): AxisValues | null {
  const usable = values.filter(value => Number.isFinite(value) && (!log || value > 0));
  if (usable.length === 0) {
    return null;
  }
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const middle = log ? Math.sqrt(min * max) : (min + max) / 2;
  return { first: min, middle, last: max, other: null, missing: log ? max * 1000 : max + (max - min) * 10 + 1 };
}

function categoryAxisValues(base: BaseCase): AxisValues | null {
  const axis = base.enhanced.categoryAxis;
  if (axis.property === undefined) {
    return null;
  }
  const values = columnValues(base.data, axis.property).filter(value => value !== null && value !== undefined);
  if (values.length === 0) {
    return null;
  }
  if (axis.scale !== 'ordinal') {
    const numbers = values.map(value => (axis.type === 'date' ? toTime(value) : Number(value)));
    const result = spread(numbers, axis.scale === 'log');
    if (result && axis.type === 'date') {
      result.other = new Date(result.middle as number).toISOString();
    }
    return result;
  }
  // with a keyProperty an ordinal tick names its category by key
  const named = axis.keyProperty ? columnValues(base.data, axis.keyProperty) : values;
  const pick = (index: number) => {
    const value = named[index];
    return value instanceof Date ? value.toISOString() : value as AxisValue;
  };
  const middle = pick(Math.floor((named.length - 1) / 2));
  let other: AxisValue | null = null;
  let missing: AxisValue;
  if (axis.keyProperty || axis.type === 'string') {
    missing = 'No such category';
  }
  else if (axis.type === 'date') {
    other = typeof middle === 'number' ? new Date(middle).toISOString() : toTime(middle);
    missing = Math.min(...values.map(toTime)) - 365 * DAY;
  }
  else {
    missing = Math.max(...values.map(Number)) + 1000;
  }
  return { first: pick(0), middle, last: pick(named.length - 1), other, missing };
}

function valueAxisValues(base: BaseCase, entry: number): AxisValues | null {
  const raw = (base.config['valueAxes'] as Record<string, unknown>[] | undefined)?.[entry];
  const id = typeof raw?.['id'] === 'string' ? raw['id'] : 'VA' + entry;
  const axis = base.enhanced.valueAxes.find(candidate => candidate.id === id);
  if (!axis) {
    return null;
  }
  const numbers = (axis.seriesConfigs ?? []).flatMap(series => [series.property, series.rangeProperty])
    .filter((property): property is string => typeof property === 'string')
    .flatMap(property => columnValues(base.data, property))
    .filter((value): value is number => typeof value === 'number');
  return spread(numbers, axis.scale === 'log');
}

function distinct<T extends { value: AxisValue }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = String(entry.value);
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

function tickLists(values: AxisValues): unknown[] {
  const lists: unknown[] = [
    null,
    [],
    [{ value: values.middle }],
    distinct([{ value: values.first, label: 'Fuzzed' }, { value: values.middle, minor: true }, { value: values.last }]),
    [{ value: values.missing }, { value: values.middle, label: LONG_LABEL }]
  ];
  if (values.other !== null) {
    lists.push([{ value: values.other }]);
  }
  return lists;
}

function thresholdLists(values: AxisValues): unknown[] {
  const lists: unknown[] = [
    [],
    [{ value: values.middle, style: LINE_STYLE }],
    [{ value: values.first, rangeValue: values.middle, style: RANGE_STYLE }],
    [{ value: values.first, style: LINE_STYLE, title: { text: 'Fuzzed' } },
      { value: values.middle, rangeValue: values.last, front: false, style: RANGE_STYLE }],
    [{ value: values.missing, style: LINE_STYLE }]
  ];
  if (values.other !== null) {
    lists.push([{ value: values.other, style: LINE_STYLE }]);
  }
  return lists;
}

function toCandidates(values: unknown[]): Candidate[] {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const value of values) {
    const label = JSON.stringify(value);
    if (!seen.has(label)) {
      seen.add(label);
      candidates.push({ label, value });
    }
  }
  return candidates;
}

/**
 * Candidates for the explicit ticks and thresholds of an axis, and for the value and rangeValue members of their
 * entries, built from the base; null for every other property, which keeps the generic candidates.
 */
export function listCandidates(spec: PropertySpec, base: BaseCase, entry: number): Candidate[] | null {
  if (spec.configKey !== 'categoryAxis' && spec.configKey !== 'valueAxes') {
    return null;
  }
  const list = spec.listPath ? spec.listPath.join('.') : spec.path.join('.');
  if (list !== 'ticks' && list !== 'thresholds') {
    return null;
  }
  const member = spec.listPath ? spec.path.join('.') : null;
  if (member !== null && member !== 'value' && member !== 'rangeValue') {
    return null;
  }
  const values = spec.configKey === 'categoryAxis' ? categoryAxisValues(base) : valueAxisValues(base, entry);
  if (values === null) {
    return [];
  }
  if (member !== null) {
    const scalars = [values.first, values.middle, values.last, values.other, values.missing].filter(value => value !== null);
    return toCandidates(member === 'rangeValue' ? [null, ...scalars] : scalars);
  }
  return toCandidates(list === 'ticks' ? tickLists(values) : thresholdLists(values));
}
