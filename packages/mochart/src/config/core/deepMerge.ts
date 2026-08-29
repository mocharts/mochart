// The single deep-merge behind every config layering step: plain objects merge recursively, everything else replaces.
// `undefined` means "not specified" and is dropped; `null` is a real value that overrides (a config's way to omit an svg attribute, keeping shapes hit-testable).

type MergeRecord = Record<string, unknown>;

// merged configs carry Object.prototype for their hosts, so a __proto__ key has to be written as data
const hasOwn = (record: MergeRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

function setKey(record: MergeRecord, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(record, key, { value, enumerable: true, writable: true, configurable: true });
  }
  else {
    record[key] = value;
  }
}

/** A plain data object; arrays, class instances, functions and `null` are values rather than structures. */
export function isPlainObject(value: unknown): value is MergeRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** A copy of `object` without the keys whose value is `undefined`. */
export function withoutUndefined<T extends object>(object: T): T {
  const keys = Object.keys(object);
  const source = object as MergeRecord;
  const keysFiltered = keys.filter(key => source[key] !== undefined);
  if (keysFiltered.length < keys.length) {
    const clone: MergeRecord = {};
    for (const key of keysFiltered) {
      setKey(clone, key, source[key]);
    }
    return clone as T;
  }
  return object;
}

/** Merge `source` over `target` without mutating either. Key order is target-first, which fixes the order of the svg attributes written from a merged style. */
export function deepMerge<T extends object>(target: T | null | undefined, source: object | null | undefined): T {
  const merged: MergeRecord = {};
  if (target) {
    const targetRecord = target as MergeRecord;
    for (const key of Object.keys(targetRecord)) {
      if (targetRecord[key] !== undefined) {
        setKey(merged, key, targetRecord[key]);
      }
    }
  }
  if (source) {
    const sourceRecord = source as MergeRecord;
    for (const key of Object.keys(sourceRecord)) {
      const sourceValue = sourceRecord[key];
      if (sourceValue === undefined) {
        continue;
      }
      const targetValue = hasOwn(merged, key) ? merged[key] : undefined;
      setKey(merged, key, (isPlainObject(targetValue) && isPlainObject(sourceValue))
        ? deepMerge(targetValue, sourceValue)
        : sourceValue);
    }
  }
  return merged as T;
}

/** `deepMerge` over a list of layers, each merged over the ones before it. */
export function deepMergeAll<T extends object>(...layers: (object | null | undefined)[]): T {
  let merged: MergeRecord = {};
  for (const layer of layers) {
    merged = deepMerge(merged, layer);
  }
  return merged as T;
}

/** A fully independent copy: plain objects and arrays are copied recursively, dates are copied, anything else passes through by reference. Throws on a circular reference. */
export function deepClone<T>(value: T): T {
  return cloneValue(value, new Set());
}

// `ancestors` is the path back to the root, not everything seen: the same object twice in different branches is a legal shared value, only a loop is not
function cloneValue<T>(value: T, ancestors: Set<unknown>): T {
  if (Array.isArray(value) || isPlainObject(value)) {
    if (ancestors.has(value)) {
      throw new Error('deepClone cannot copy a circular reference: a built mochartConfig links series and axes to each other, so clone the config it was built from rather than the built config');
    }
    ancestors.add(value);
    const clone = Array.isArray(value) ? cloneEntries(value, ancestors) : cloneKeys(value, ancestors);
    ancestors.delete(value);
    return clone as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  return value;
}

const cloneEntries = (value: unknown[], ancestors: Set<unknown>): unknown[] =>
  value.map(entry => cloneValue(entry, ancestors));

const cloneKeys = (value: MergeRecord, ancestors: Set<unknown>): MergeRecord => {
  const clone: MergeRecord = {};
  for (const key of Object.keys(value)) {
    setKey(clone, key, cloneValue(value[key], ancestors));
  }
  return clone;
};
