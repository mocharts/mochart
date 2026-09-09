import { describe, it, expect } from 'vitest';

import { getWithMutations } from '../../src/utils/WithMutations';

describe('getWithMutations', () => {
  it('keeps the old reference when nothing changed', () => {
    const oldValue = { a: 1, nested: { b: [1, 2] } };
    expect(getWithMutations(oldValue, { a: 1, nested: { b: [1, 2] } })).toBe(oldValue);
  });

  it('keeps unchanged sibling subtrees by reference when another key changes', () => {
    const oldValue = { changed: 1, kept: { b: 2 } };
    const result = getWithMutations(oldValue, { changed: 3, kept: { b: 2 } });
    expect(result).not.toBe(oldValue);
    expect(result.changed).toBe(3);
    expect(result.kept).toBe(oldValue.kept);
  });

  it('returns the new value when keys are added or removed', () => {
    expect(getWithMutations({ a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(getWithMutations<object>({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
  });

  it('keeps the old reference for empty plain objects', () => {
    const oldValue = {};
    expect(getWithMutations(oldValue, {})).toBe(oldValue);
  });

  it('replaces the subtree when a Date leaf changes', () => {
    const oldValue = { tick: { value: new Date('2026-01-01'), label: 'x' } };
    const result = getWithMutations(oldValue, { tick: { value: new Date('2026-02-01'), label: 'x' } });
    expect(result).not.toBe(oldValue);
    expect(result.tick.value.getTime()).toBe(new Date('2026-02-01').getTime());
  });

  it('keeps the old Date reference when the time is equal', () => {
    const oldValue = { tick: { value: new Date('2026-01-01'), label: 'x' } };
    const result = getWithMutations(oldValue, { tick: { value: new Date('2026-01-01'), label: 'x' } });
    expect(result).toBe(oldValue);
  });

  it('keeps the old reference for a plain object whose NaN member is unchanged', () => {
    const oldValue = { v: NaN, w: 1, nested: { arr: [NaN], n: { v: NaN } } };
    expect(getWithMutations(oldValue, { v: NaN, w: 1, nested: { arr: [NaN], n: { v: NaN } } })).toBe(oldValue);
    expect(getWithMutations(oldValue, { v: NaN, w: 2, nested: { arr: [NaN], n: { v: NaN } } })).not.toBe(oldValue);
  });

  it('replaces non-plain objects instead of merging them', () => {
    const oldValue = { items: new Set([1]) };
    const newSet = new Set([2]);
    const result = getWithMutations(oldValue, { items: newSet });
    expect(result.items).toBe(newSet);
  });

  it('delegates leaf values to the custom mutator', () => {
    const oldFn = () => 1;
    const newFn = () => 2;
    const result = getWithMutations({ fn: oldFn }, { fn: newFn }, () => oldFn);
    expect(result.fn).toBe(oldFn);
  });
});
