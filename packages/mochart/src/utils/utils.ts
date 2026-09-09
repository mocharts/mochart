export const idAccessor = ({ id }: { id: string }): string => id;

export function arrayToMap<T, V = T>(
  theArray: readonly T[],
  keyAccessor: (element: NoInfer<T>) => string,
  valueFormatter: (element: NoInfer<T>) => V = element => element as unknown as V
): Record<string, V> {
  const map: Record<string, V> = Object.create(null); // null proto: keys are external ids (__proto__ must work)
  for (const element of theArray) {
    map[keyAccessor(element)] = valueFormatter(element);
  }
  return map;
}

export function mapMap<V, R>(map: Record<string, V>, mapFunction: (value: V) => R): Record<string, R> {
  const mapKeys = Object.keys(map);
  const newMap: Record<string, R> = Object.create(null);
  for (const mapKey of mapKeys) {
    newMap[mapKey] = mapFunction(map[mapKey]);
  }
  return newMap;
}

export function onClickDisabled(e: Event): void {
  e.preventDefault();
}

/** Marks focus the library moved itself, which pointer paths reach too - :focus-visible never
 * matches there, so the stylesheet has nothing to ring without this. Cleared on blur. */
export const focusRestoredAttribute = 'data-mochart-focus-restored';

export function focusRestored(node: SVGElement | HTMLElement | null | undefined): void {
  if (node === null || node === undefined) {
    return;
  }
  node.setAttribute(focusRestoredAttribute, '');
  node.addEventListener('blur', () => node.removeAttribute(focusRestoredAttribute), { once: true });
  node.focus();
}

/** A tap emulates hover (pointerenter, then the mouse burst) right before its click, so touch never counts as hovering. */
export function isHoverPointer(event: Event): boolean {
  return (event as Partial<PointerEvent>).pointerType !== 'touch';
}

/** Focus reached by keyboard (or moved by script after keyboard use); a click or tap focuses without it. */
export function isKeyboardFocus(event: Event): boolean {
  // environments without selector() support (jsdom) cannot tell, so they keep mirroring every focus
  const supported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:focus-visible)');
  const target = event.target as Element | null;
  return !supported || target === null || typeof target.matches !== 'function' || target.matches(':focus-visible');
}

export function translate(x: number, y: number): string {
  return 'translate(' + x + ',' + y + ')';
}

export function rotate(a: number): string {
  return 'rotate(' + a + ')';
}

export function translateRotate(x: number, y: number, a = 0): string {
  return translate(x, y) + (a === 0 ? '' : ' ' + rotate(a));
}

export function translateObject({ x, y }: { x: number; y: number }): string {
  return translate(x, y);
}

export const textDY = '0.35em'; // more or less centers the text vertically http://stackoverflow.com/questions/12250403/vertical-alignment-of-text-element-in-svg

export function centerTextY(textBounds: { x?: number; y?: number; height: number }): { dy: string; transform: string } {
  const dy = textDY;
  const { x = 0, y = 0, height } = textBounds;
  const transform = translate(x, Math.floor(y + height / 2.0));
  return {
    dy,
    transform
  };
}

/** Chart data marks a missing series value with NaN (see NumericValue). */
export const MISSING_VALUE = NaN;

export function isMissingValue(value: number | null | undefined): boolean {
  return Number.isNaN(value);
}

// NaN-aware identity: NaN !== NaN, and value arrays compare element-wise every frame
export function areValuesEqual(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b);
}

export function createArrayFilledWithMissing(count: number): number[] {
  const theArray: number[] = [];
  for (let i=0; i<count; i++) {
    theArray.push(MISSING_VALUE);
  }
  return theArray;
}

export function createArrayFilledWithZero(count: number): number[] {
  const theArray: number[] = [];
  for (let i=0; i<count; i++) {
    theArray.push(0);
  }
  return theArray;
}

// missing (NaN) entries mirror the source; a missing fill value leaves them missing too
export function createArrayWithValueIfNotMissing(source: readonly number[], value: number): number[] {
  const theArray: number[] = [];
  const count = source.length;
  for (let i=0; i<count; i++) {
    theArray.push(isMissingValue(source[i]) ? MISSING_VALUE : value);
  }
  return theArray;
}

export function copyArrayWithValueIfNotMissing(source: readonly number[], otherSource: readonly number[]): number[] {
  const theArray: number[] = [];
  const count = source.length;
  for (let i=0; i<count; i++) {
    theArray.push(isMissingValue(otherSource[i]) ? MISSING_VALUE : source[i]);
  }
  return theArray;
}

export function replaceArrayMissingWithValue(array: number[], value: number): void {
  const count = array.length;
  for (let i=0; i<count; i++) {
    if (isMissingValue(array[i])) {
      array[i] = value;
    }
  }
}

export function copyWithValueOnlyIfOtherMissing(source: number[], otherSource: readonly number[], value: number): number[] {
  let i, found = -1;
  const count = source.length;
  for (i=0; i<count; i++) {
    if (isMissingValue(otherSource[i])) {
      found = i;
      break;
    }
  }
  if (found >= 0) {
    const copy = source.slice();
    for (i=found; i<count; i++) {
      if (isMissingValue(otherSource[i])) {
        copy[i] = value;
      }
    }
    return copy;
  }
  else {
    return source;
  }
}

export function areMapsEqual(mapA: Record<string, unknown>, mapB: Record<string, unknown>): boolean {
  const keys = Object.keys(mapA);
  if (keys.length !== Object.keys(mapB).length) {
    return false;
  }
  for (const key of keys) {
    if (!(key in mapB) || mapA[key] !== mapB[key]) {
      return false;
    }
  }
  return true;
}

export function areArraysAndEqual(oldValue: unknown, newValue: unknown): boolean {
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length === newValue.length) {
      const count = oldValue.length;
      for (let i=0; i<count; i++) {
        if (!areValuesEqual(oldValue[i], newValue[i])) {
          return false;
        }
      }
      return true;
    }
    else {
      return false;
    }
  }
  else {
    return false;
  }
}

export function getValuesAtIndices<T>(source: readonly T[], indices: readonly number[]): T[] {
  const values: T[] = [];
  const count = indices.length;
  for (let i=0; i<count; i++) {
    values.push(source[indices[i]]);
  }
  return values;
}

// where exactly one side is missing, fill it so both animate from the same base
export function setArrayValuesIfOneIsMissing(array: number[], otherArray: number[], value: number): void {
  const count = array.length;
  for (let i=0; i<count; i++) {
    const missing = isMissingValue(array[i]);
    const otherMissing = isMissingValue(otherArray[i]);
    if (missing && !otherMissing) {
      array[i] = value;
    }
    else if (otherMissing && !missing) {
      otherArray[i] = value;
    }
  }
}

export function setArrayValuesFromSourcesIfOneIsMissing(
  array: number[],
  otherArray: number[],
  sourceArray: readonly number[],
  otherSourceArray: readonly number[]
): void {
  const count = array.length;
  for (let i=0; i<count; i++) {
    const missing = isMissingValue(array[i]);
    const otherMissing = isMissingValue(otherArray[i]);
    if (missing && !otherMissing) {
      array[i] = sourceArray[i];
    }
    else if (otherMissing && !missing) {
      otherArray[i] = otherSourceArray[i];
    }
  }
}

export function setArrayValuesForRange<T>(array: T[], min: number, max: number, value: T): void {
  let i;
  for (i=min; i<max; i++) {
    array[i] = value;
  }
}

// an index past the end counts as missing: callers check merged-space ranges against shorter arrays
export function hasMissingForRange(array: readonly number[], min: number, max: number): boolean {
  let i;
  for (i=min; i<max; i++) {
    if (i >= array.length || isMissingValue(array[i])) {
      return true;
    }
  }
  return false;
}

export function getMaxAbsoluteValue(values: readonly (number | null)[] | null): number {
  let max = 0;
  if (values !== null) {
    const count = values.length;
    let i, temp;
    for (i=0; i<count; i++) {
      temp = values[i];
      if (temp && Math.abs(temp) > max) {
        max = Math.abs(temp);
      }
    }
  }
  return max;
}

export function getArrayDeltas(array: readonly number[], otherArray: readonly number[]): number[] {
  const count = array.length;
  const deltas: number[] = [];
  for (let i=0; i<count; i++) {
    if (!isMissingValue(otherArray[i])) { // if one is missing, both should be missing
      deltas.push(otherArray[i] - array[i]);
    }
    else {
      deltas.push(0);
    }
  }
  return deltas;
}

// a11y affordances (roles, labels, tab stops) apply only when enabled and not decorative-hidden
export function accessibilityActive({ enabled, hidden }: { enabled: boolean; hidden: boolean }): boolean {
  return enabled && !hidden;
}

/** Snaps float noise off a computed value (0.1 + 0.2, 0.25 * 1.05 / 0.75) by keeping 12 significant digits. */
export function roundToSignificant(value: number): number {
  return Number(value.toPrecision(12));
}
