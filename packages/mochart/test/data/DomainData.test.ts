import { describe, it, expect } from 'vitest';
import {
  nullDomain,
  getCategoryDomainForValues,
  getDomainForValues,
  mergeDomain,
  getDomainExtent,
  getDomainExtents,
  getSafeDomainExtent,
  getMaxDomain,
  copyDomain
} from '../../src/data/DomainData';
import { MISSING_VALUE } from '../../src/utils/utils';

describe('getCategoryDomainForValues', () => {
  it('finds the min and max of numeric values', () => {
    expect(getCategoryDomainForValues([3, 1, 4, 1, 5, 9, 2])).toEqual([1, 9]);
  });

  it('returns the null domain for an empty array', () => {
    expect(getCategoryDomainForValues([])).toEqual([null, null]);
  });

  it('compares dates by timestamp and returns the extreme date instances', () => {
    const a = new Date('2020-01-01');
    const b = new Date('2020-06-01');
    const c = new Date('2020-03-01');
    expect(getCategoryDomainForValues([c, a, b])).toEqual([a, b]);
  });

  it('handles a single value as both min and max', () => {
    expect(getCategoryDomainForValues([7])).toEqual([7, 7]);
  });

  it('skips a leading NaN instead of letting it poison the domain', () => {
    expect(getCategoryDomainForValues([NaN, 3, 1])).toEqual([1, 3]);
  });

  it('skips Invalid Date values', () => {
    const a = new Date('2020-01-01');
    const b = new Date('2020-06-01');
    expect(getCategoryDomainForValues([new Date('invalid'), a, b])).toEqual([a, b]);
  });

  it('returns the null domain when every value is NaN', () => {
    expect(getCategoryDomainForValues([NaN, NaN])).toEqual([null, null]);
  });

  // an infinite category value is as unusable as NaN for placing a band or a tick
  it('skips infinities the way it skips NaN', () => {
    expect(getCategoryDomainForValues([Infinity, 3, 1])).toEqual([1, 3]);
    expect(getCategoryDomainForValues([-Infinity, 3, 1])).toEqual([1, 3]);
  });
});

describe('getDomainForValues', () => {
  it('finds the min and max ignoring missing entries', () => {
    expect(getDomainForValues([5, MISSING_VALUE, 2, MISSING_VALUE, 8])).toEqual([2, 8]);
  });

  it('returns the null domain for null input', () => {
    expect(getDomainForValues(null)).toEqual([null, null]);
  });

  it('returns the null domain when every value is missing', () => {
    expect(getDomainForValues([MISSING_VALUE, MISSING_VALUE])).toEqual([null, null]);
  });

  it('handles negative values', () => {
    expect(getDomainForValues([-3, -1, -7])).toEqual([-7, -1]);
  });

  it('skips a leading NaN instead of letting it poison the domain', () => {
    expect(getDomainForValues([NaN, 5, 2])).toEqual([2, 5]);
  });

  it('skips NaN anywhere in the values', () => {
    expect(getDomainForValues([5, NaN, 2])).toEqual([2, 5]);
  });

  // undefined can still arrive through loosely typed callers and must not poison the domain either
  it('returns the null domain when every value is NaN or undefined', () => {
    expect(getDomainForValues([NaN, undefined, NaN] as unknown as number[])).toEqual([null, null]);
  });

  // null is the standard JSON/API missing marker and compares as 0, so it used to re-arm the `min === null` sentinel and discard every minimum seen so far
  it('skips null the way it skips undefined', () => {
    const withNulls = [5, null, 20] as unknown as number[];
    expect(getDomainForValues(withNulls)).toEqual([5, 20]);
  });

  it('does not break the null-pair invariant on a trailing null', () => {
    const trailingNull = [10, null] as unknown as number[];
    expect(getDomainForValues(trailingNull)).toEqual([10, 10]);
  });

  it('returns the null domain when every value is null', () => {
    const allNull = [null, null] as unknown as number[];
    expect(getDomainForValues(allNull)).toEqual([null, null]);
  });

  it('excludes infinities rather than letting them become the bounds', () => {
    expect(getDomainForValues([10, Infinity])).toEqual([10, 10]);
    expect(getDomainForValues([-Infinity, 10, Infinity])).toEqual([10, 10]);
  });
});

describe('mergeDomain', () => {
  it('returns the other domain when one side is null', () => {
    expect(mergeDomain(nullDomain, [2, 5])).toEqual([2, 5]);
    expect(mergeDomain([2, 5], nullDomain)).toEqual([2, 5]);
  });

  it('takes the widest bounds of two populated domains', () => {
    expect(mergeDomain([2, 5], [1, 4])).toEqual([1, 5]);
    expect(mergeDomain([2, 5], [3, 9])).toEqual([2, 9]);
  });
});

describe('getDomainExtent', () => {
  it('returns the numeric span of a domain', () => {
    expect(getDomainExtent([2, 5])).toBe(3);
  });

  it('returns 0 for a null or degenerate domain', () => {
    expect(getDomainExtent([null, null])).toBe(0);
    expect(getDomainExtent([5, 5])).toBe(0);
  });

  it('measures dates by elapsed milliseconds', () => {
    const a = new Date('2020-01-01T00:00:00Z');
    const b = new Date('2020-01-01T00:00:01Z');
    expect(getDomainExtent([a, b])).toBe(1000);
  });
});

describe('getDomainExtents', () => {
  it('maps each named domain to its extent', () => {
    expect(getDomainExtents({ a: [0, 10], b: [3, 5] })).toEqual({ a: 10, b: 2 });
  });
});

describe('getSafeDomainExtent', () => {
  it('returns the extent for a non-degenerate domain', () => {
    expect(getSafeDomainExtent([2, 6])).toBe(4);
  });

  it('falls back to the value magnitude for a degenerate non-null domain', () => {
    expect(getSafeDomainExtent([5, 5])).toBe(5);
    expect(getSafeDomainExtent([-3, -3])).toBe(3);
  });

  it('falls back to 1 for a null or all-zero domain', () => {
    expect(getSafeDomainExtent([null, null])).toBe(1);
    expect(getSafeDomainExtent([0, 0])).toBe(1);
  });
});

describe('getMaxDomain', () => {
  it('returns the other domain when one side is null', () => {
    expect(getMaxDomain([null, null], [1, 4])).toEqual([1, 4]);
    expect(getMaxDomain([1, 4], [null, null])).toEqual([1, 4]);
  });

  it('returns the widest bounds across both domains', () => {
    expect(getMaxDomain([2, 5], [1, 9])).toEqual([1, 9]);
    expect(getMaxDomain([0, 3], [1, 2])).toEqual([0, 3]);
  });
});

describe('copyDomain', () => {
  it('produces an equal but distinct array', () => {
    const domain: [number, number] = [1, 2];
    const copy = copyDomain(domain);
    expect(copy).toEqual(domain);
    expect(copy).not.toBe(domain);
  });
});
