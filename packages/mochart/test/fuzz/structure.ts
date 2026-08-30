// Shape changes the property sweep never makes: adding, removing and reordering list entries, and
// adding or removing a data row. Every case is still one move away from its base, so the same
// path-independence oracle applies — reaching a shape by update must match building it directly.
import type { BaseCase } from './runner';

const LIST_SECTIONS = ['series', 'valueAxes', 'seriesGroups', 'seriesStacks', 'linearGradients', 'radialGradients', 'patterns'];

export interface StructuralCase {
  /** Reported as the finding's property, e.g. `series` or `data`. */
  property: string;
  /** Reported as the finding's value, e.g. `remove entry 2`. */
  label: string;
  config: Record<string, unknown>;
  /** Replacement rows, or null when only the config changed. */
  data: unknown | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entriesOf(config: Record<string, unknown>, section: string): Record<string, unknown>[] | null {
  const value = config[section];
  return Array.isArray(value) && value.every(isRecord) ? value as Record<string, unknown>[] : null;
}

/** A duplicate entry needs its own id, or it collides with the one it was copied from. */
function copyEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(entry);
  if (typeof copy['id'] === 'string') {
    copy['id'] = copy['id'] + '-fuzz';
  }
  return copy;
}

/** A duplicated row needs its own category value, since category values must be unique. */
function nextCategoryValue(value: unknown): unknown {
  if (typeof value === 'number') {
    return value + 1;
  }
  if (typeof value === 'string') {
    // a date string keeps parsing as a date, or a date axis rejects the row as a data mismatch
    const time = Date.parse(value);
    return !Number.isNaN(time) && value.includes('-') ? new Date(time + 86400000).toISOString() : value + ' (fuzz)';
  }
  if (value instanceof Date) {
    return new Date(value.getTime() + 86400000);
  }
  return value;
}

function listCases(base: BaseCase): StructuralCase[] {
  const cases: StructuralCase[] = [];
  for (const section of LIST_SECTIONS) {
    const entries = entriesOf(base.config, section);
    if (entries === null || entries.length === 0) {
      continue;
    }
    for (let index = 0; index < entries.length; index++) {
      const config = structuredClone(base.config);
      (config[section] as unknown[]).splice(index, 1);
      cases.push({ property: section, label: 'remove entry ' + index, config, data: null });
    }
    const added = structuredClone(base.config);
    (added[section] as Record<string, unknown>[]).push(copyEntry(entries[entries.length - 1]!));
    cases.push({ property: section, label: 'add an entry', config: added, data: null });
    if (entries.length >= 2) {
      const swapped = structuredClone(base.config);
      const list = swapped[section] as unknown[];
      [list[0], list[1]] = [list[1], list[0]];
      cases.push({ property: section, label: 'swap entries 0 and 1', config: swapped, data: null });
    }
  }
  return cases;
}

/** The category property names the values that must stay unique when a row is duplicated. */
function categoryProperty(config: Record<string, unknown>): string | null {
  const categoryAxis = config['categoryAxis'];
  if (!isRecord(categoryAxis)) {
    return null;
  }
  const property = categoryAxis['property'];
  return typeof property === 'string' ? property : null;
}

function rowCases(base: BaseCase): StructuralCase[] {
  const property = categoryProperty(base.config);
  if (property === null) {
    return [];
  }
  const config = () => structuredClone(base.config);
  const cases: StructuralCase[] = [];
  if (Array.isArray(base.data) && base.data.every(isRecord)) {
    const rows = base.data as Record<string, unknown>[];
    if (rows.length < 2) {
      return [];
    }
    const last = rows[rows.length - 1]!;
    cases.push({ property: 'data', label: 'remove the last row', config: config(), data: rows.slice(0, -1) });
    cases.push({ property: 'data', label: 'add a row', config: config(),
      data: rows.concat({ ...structuredClone(last), [property]: nextCategoryValue(last[property]) }) });
  }
  else if (isRecord(base.data)) {
    const columns = base.data as Record<string, unknown[]>;
    const names = Object.keys(columns).filter(name => Array.isArray(columns[name]));
    const length = names.length > 0 ? columns[names[0]!]!.length : 0;
    if (length < 2) {
      return [];
    }
    const shorter: Record<string, unknown[]> = {};
    const longer: Record<string, unknown[]> = {};
    for (const name of names) {
      const column = columns[name]!;
      const last = column[column.length - 1];
      shorter[name] = column.slice(0, -1);
      longer[name] = column.concat(name === property ? nextCategoryValue(last) : structuredClone(last));
    }
    cases.push({ property: 'data', label: 'remove the last row', config: config(), data: shorter });
    cases.push({ property: 'data', label: 'add a row', config: config(), data: longer });
  }
  return cases;
}

export function structuralCases(base: BaseCase): StructuralCase[] {
  return listCases(base).concat(rowCases(base));
}
