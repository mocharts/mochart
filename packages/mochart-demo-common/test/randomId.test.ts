import { describe, it, expect } from 'vitest';

import { MAX_RANDOM_ID, nextRandomId, parseRandomId, previousRandomId } from '../src/randomId';

describe('parseRandomId', () => {
  it('reads a whole number from 0 to 9999 and rejects everything else', () => {
    expect(parseRandomId('0')).toBe(0);
    expect(parseRandomId('42')).toBe(42);
    expect(parseRandomId('9999')).toBe(MAX_RANDOM_ID);
    for (const bad of ['10000', '999999', '-1', '1.5', 'abc', '', ' 3', '3 ', undefined, null]) {
      expect(parseRandomId(bad), String(bad)).toBeNull();
    }
  });
});

describe('stepping', () => {
  it('wraps at both ends so play never runs out and back reaches what forward left', () => {
    expect(nextRandomId(0)).toBe(1);
    expect(nextRandomId(MAX_RANDOM_ID)).toBe(0);
    expect(previousRandomId(1)).toBe(0);
    expect(previousRandomId(0)).toBe(MAX_RANDOM_ID);
    for (const id of [0, 7, MAX_RANDOM_ID]) {
      expect(previousRandomId(nextRandomId(id))).toBe(id);
      expect(parseRandomId(String(nextRandomId(id)))).toBe(nextRandomId(id));
    }
  });
});
