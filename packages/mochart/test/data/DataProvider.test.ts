import { describe, it, expect } from 'vitest';
import { ArrayOfObjectsDataProvider, ObjectOfArraysDataProvider } from '../../src/data/DataProvider';
import { readAlignedValues, readCategoryValues, readNumericValues } from '../../src/data/PropertyData';
import type { DataProvider, DataValue } from '../../src/types/data';

describe('ArrayOfObjectsDataProvider', () => {
  const rows = [
    { month: 'Jan', sales: 10, costs: 4 },
    { month: 'Feb', sales: 20, costs: 8 },
    { month: 'Mar', sales: 30, costs: 12 }
  ];

  it('returns the values of any property in row order', () => {
    const provider = new ArrayOfObjectsDataProvider(rows);
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(provider.getPropertyValues('sales')).toEqual([10, 20, 30]);
    expect(provider.getPropertyValues('costs')).toEqual([4, 8, 12]);
  });

  it('returns undefined for a property absent from every row', () => {
    const provider = new ArrayOfObjectsDataProvider(rows);
    expect(provider.getPropertyValues('vlaue')).toBeUndefined();
  });

  // partial gaps are legitimate holey data, not an absent property
  it('returns values with holes for a property present on only some rows', () => {
    const partial: Array<Record<string, unknown>> = [{ month: 'Jan', sales: 1 }, { month: 'Feb' }];
    expect(new ArrayOfObjectsDataProvider(partial).getPropertyValues('sales')).toEqual([1, undefined]);
  });

  // Regression: `property in null` threw a TypeError, so one null entry crashed the data-error pass
  it('treats a null entry as holding no properties instead of throwing', () => {
    const holey = [{ month: 'Jan', sales: 1 }, null, { month: 'Mar', sales: 3 }] as unknown as Array<Record<string, unknown>>;
    const provider = new ArrayOfObjectsDataProvider(holey);
    expect(provider.getPropertyValues('sales')).toEqual([1, undefined, 3]);
    expect(provider.getPropertyValues('absent')).toBeUndefined();
  });

  it('returns empty values for any property of an empty dataset', () => {
    const provider = new ArrayOfObjectsDataProvider([] as Array<Record<string, unknown>>);
    expect(provider.getPropertyValues('anything')).toEqual([]);
  });

  it('returns non-numeric cells unchanged', () => {
    const instant = new Date('2020-01-01T00:00:00.000Z');
    const dateRows = [{ id: 1, at: instant, note: null }];
    const provider = new ArrayOfObjectsDataProvider(dateRows);
    expect(provider.getPropertyValues('at')![0]).toBe(instant);
    expect(provider.getPropertyValues('note')).toEqual([null]);
  });

  it('is stateless: in-place row mutations are seen on the next read', () => {
    const mutable = [
      { month: 'Jan', sales: 10 },
      { month: 'Feb', sales: 20 }
    ];
    const provider = new ArrayOfObjectsDataProvider(mutable);
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Feb']);

    mutable.push({ month: 'Mar', sales: 30 });
    mutable[0] = { month: 'Jan', sales: 11 };
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(provider.getPropertyValues('sales')).toEqual([11, 20, 30]);

    mutable.pop();
    expect(provider.getPropertyValues('sales')).toEqual([11, 20]);
  });

  it('keeps duplicate category values distinct', () => {
    const dupes = [
      { month: 'Jan', sales: 10 },
      { month: 'Jan', sales: 99 }
    ];
    const provider = new ArrayOfObjectsDataProvider(dupes);
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Jan']);
    expect(provider.getPropertyValues('sales')).toEqual([10, 99]);
  });
});

describe('ObjectOfArraysDataProvider', () => {
  const data = {
    month: ['Jan', 'Feb', 'Mar'],
    sales: [10, 20, 30],
    costs: [4, 8, 12]
  };

  it('returns the stored array itself, zero-copy', () => {
    const provider = new ObjectOfArraysDataProvider(data);
    expect(provider.getPropertyValues('month')).toBe(data.month);
    expect(provider.getPropertyValues('sales')).toBe(data.sales);
  });

  it('returns undefined for an absent property', () => {
    const provider = new ObjectOfArraysDataProvider(data);
    expect(provider.getPropertyValues('vlaue')).toBeUndefined();
  });

  it('returns undefined for a non-array value', () => {
    const bad: Record<string, readonly DataValue[]> = { month: 'Jan' as unknown as readonly DataValue[] };
    expect(new ObjectOfArraysDataProvider(bad).getPropertyValues('month')).toBeUndefined();
  });

  it('is stateless: mutated and reassigned arrays are seen on the next read', () => {
    const mutable: Record<string, readonly DataValue[]> = { month: ['Jan', 'Feb'], sales: [10, 20] };
    const provider = new ObjectOfArraysDataProvider(mutable);

    mutable.month = ['Jan', 'Feb', 'Mar'];
    (mutable.sales as DataValue[]).push(30);
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(provider.getPropertyValues('sales')).toEqual([10, 20, 30]);
  });
});

// The chart-side readers: alignment carries the index, and null/undefined normalize to
// NaN at this boundary so the chart keeps a single missing sentinel.
describe('property-values readers', () => {
  const provider: DataProvider = new ObjectOfArraysDataProvider({
    month: ['Jan', 'Feb', 'Mar'],
    sales: [10, null, 30],
    short: [1]
  } as Record<string, readonly DataValue[]>);

  it('readCategoryValues reads an absent property as no categories', () => {
    expect(readCategoryValues(provider, 'month')).toEqual(['Jan', 'Feb', 'Mar']);
    expect(readCategoryValues(provider, 'missing')).toEqual([]);
  });

  it('readNumericValues normalizes null cells to NaN', () => {
    expect(readNumericValues(provider, 'sales', 3)).toEqual([10, NaN, 30]);
  });

  it('readNumericValues reads an absent property as all-missing', () => {
    expect(readNumericValues(provider, 'missing', 3)).toEqual([NaN, NaN, NaN]);
  });

  it('readNumericValues passes an input NaN through as the missing value', () => {
    const nanProvider: DataProvider = new ObjectOfArraysDataProvider({ sales: [1, NaN] } as Record<string, readonly DataValue[]>);
    expect(readNumericValues(nanProvider, 'sales', 2)).toEqual([1, NaN]);
  });


  it('readAlignedValues snapshots exactly categoryCount values', () => {
    // short values pad with missing; extra cells are never read (getDataErrors flags the mismatch)
    expect(readAlignedValues(provider, 'short', 3)).toEqual([1, undefined, undefined]);
    expect(readAlignedValues(provider, 'month', 2)).toEqual(['Jan', 'Feb']);
  });
});
