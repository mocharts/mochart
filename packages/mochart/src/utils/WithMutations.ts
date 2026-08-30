import { areValuesEqual } from './utils';

export type CustomMutator = (oldValue: unknown, newValue: unknown) => unknown;

// Merged outputs are created with a null prototype, so both must pass.
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Structurally merges newValue with oldValue, returning oldValue (or its
 * sub-objects) wherever nothing changed, so unchanged references are preserved.
 */
export function getWithMutations<T>(oldValue: T | null | undefined, newValue: T, customMutator?: CustomMutator): T;
export function getWithMutations(oldValue: unknown, newValue: unknown, customMutator?: CustomMutator): unknown {
  // areValuesEqual: a missing series value is NaN, which must not read as changed every frame
  if (oldValue === null || oldValue === undefined || newValue === undefined || newValue === null || areValuesEqual(oldValue, newValue)) {
    return newValue;
  }
  else if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length === newValue.length) {
      // allocated on the first changed element; the scanned prefix is unchanged, so it copies from oldValue
      let newArray: unknown[] | null = null;
      for (let i = 0; i < oldValue.length; i++) {
        const merged = getWithMutations(oldValue[i], newValue[i], customMutator);
        if (newArray === null && !areValuesEqual(oldValue[i], merged)) {
          newArray = oldValue.slice(0, i);
        }
        if (newArray !== null) {
          newArray.push(merged);
        }
      }
      return newArray !== null ? newArray : oldValue;
    }
    else {
      return newValue;
    }
  }
  else if (oldValue instanceof Date && newValue instanceof Date) {
    return oldValue.getTime() === newValue.getTime() ? oldValue : newValue;
  }
  // Plain objects only: keyless exotics (Date, Map, Set) would vacuously compare equal below.
  else if (typeof oldValue === "object" && typeof newValue === "object" && isPlainObject(oldValue) && isPlainObject(newValue)) {
    const oldObject = oldValue as Record<string, unknown>;
    const incomingObject = newValue as Record<string, unknown>;
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);
    // null proto: merged maps can be keyed by external ids (__proto__ must survive the merge)
    const oldKeyMap = oldKeys.reduce<Record<string, boolean>>((map, key) => { map[key] = true; return map }, Object.create(null));
    // allocated on the first changed or added member (or when a key was removed); the scanned prefix copies from oldObject
    let newObject: Record<string, unknown> | null = oldKeys.length === newKeys.length ? null : Object.create(null);
    for (let i = 0; i < newKeys.length; i++) {
      const newKey = newKeys[i];
      // areValuesEqual, like the array branch: a NaN member is unchanged when both sides hold NaN
      const merged = oldKeyMap[newKey] ? getWithMutations(oldObject[newKey], incomingObject[newKey], customMutator) : incomingObject[newKey];
      if (newObject === null && !(oldKeyMap[newKey] && areValuesEqual(oldObject[newKey], merged))) {
        newObject = Object.create(null);
        for (let j = 0; j < i; j++) {
          newObject![newKeys[j]] = oldObject[newKeys[j]];
        }
      }
      if (newObject !== null) {
        newObject[newKey] = merged;
      }
    }
    return newObject !== null ? newObject : oldValue;
  }
  else if (customMutator !== undefined) {
    return customMutator(oldValue, newValue);
  }
  else {
    return newValue;
  }
}
