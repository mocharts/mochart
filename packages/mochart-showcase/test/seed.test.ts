import { describe, it, expect } from 'vitest';

import { MAX_SEED, nextSeed, parseSeed } from '../src/state/seed';

describe('parseSeed', () => {
  it('reads an integer of up to four digits and ignores anything else', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('9999')).toBe(9999);
    expect(parseSeed('-3')).toBe(-3);
    expect(parseSeed(null)).toBeNull();
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('abc')).toBeNull();
    expect(parseSeed('1.5')).toBeNull();
    // the walk costs one step per seed, so a long seed is dropped rather than run
    expect(parseSeed('10000')).toBeNull();
    expect(parseSeed('99999999999')).toBeNull();
  });
});

describe('nextSeed', () => {
  it('steps from the curated state to 1 and holds at the parser bound', () => {
    expect(nextSeed(null)).toBe(1);
    expect(nextSeed(4)).toBe(5);
    expect(nextSeed(MAX_SEED)).toBe(MAX_SEED);
    expect(parseSeed(String(nextSeed(MAX_SEED)))).toBe(MAX_SEED);
  });
});
