import { describe, it, expect } from 'vitest';
import {
  getCategoryData,
  getCategoryDataFromValues,
  getCategoryDataWithRenderAxisDomain,
  getCategoryDataWithNumericValues,
  getNumericCategoryValues,
  getCategoryValueObject
} from '../../src/data/CategoryData';
import { ordinalConfig, makeConfig, ArrayOfObjectsDataProvider } from './fixtures';
import type { CategoryValue } from '../../src/types/data';

describe('getCategoryData', () => {
  it('reads raw category values from the provider', () => {
    const config = ordinalConfig();
    const provider = new ArrayOfObjectsDataProvider(
      [{ month: 'Jan' }, { month: 'Feb' }, { month: 'Mar' }]);
    const categoryData = getCategoryData(config.categoryAxis, provider);
    expect(categoryData.values.raw).toEqual(['Jan', 'Feb', 'Mar']);
    // without a keyProperty the values are their own keys
    expect(categoryData.values.display).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('keys categories through a key property', () => {
    const config = ordinalConfig({ property: 'label', keyProperty: 'id' });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' }
      ]);
    const categoryData = getCategoryData(config.categoryAxis, provider);
    expect(categoryData.values.raw).toEqual(['a', 'b']);
    expect(categoryData.values.display).toEqual(['Alpha', 'Beta']);
  });
});

// Regression: a category with no keyProperty value kept undefined as its key, so all such
// categories shared one key and the animation merge collapsed them into a single slot
describe('missing keyProperty values', () => {
  it('keys a category by its property value when its key value is missing', () => {
    const config = ordinalConfig({ property: 'label', keyProperty: 'id' });
    const provider = new ArrayOfObjectsDataProvider(
      [
        { id: 'a', label: 'Alpha' },
        { label: 'Beta' },
        { id: 'c', label: 'Gamma' }
      ]);
    expect(getCategoryData(config.categoryAxis, provider).values.raw).toEqual(['a', 'Beta', 'c']);
  });

  it('keys every category by its property value when the key property is absent from the data', () => {
    const config = ordinalConfig({ property: 'label', keyProperty: 'id' });
    const provider = new ArrayOfObjectsDataProvider([{ label: 'Alpha' }, { label: 'Beta' }]);
    expect(getCategoryData(config.categoryAxis, provider).values.raw).toEqual(['Alpha', 'Beta']);
  });
});

describe('getNumericCategoryValues', () => {
  it('numbers ordinal values by their index', () => {
    const config = ordinalConfig();
    expect(getNumericCategoryValues(config.categoryAxis, ['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });

  it('subtracts per-index offsets when provided', () => {
    const config = ordinalConfig();
    expect(getNumericCategoryValues(config.categoryAxis, ['a', 'b', 'c'], [0, 0.5, 1])).toEqual([0, 0.5, 1]);
  });

  it('uses timestamps for date axes', () => {
    const config = makeConfig({
      categoryAxis: { property: 'day', type: 'date', scale: 'linear' }
    });
    const a = new Date('2020-01-01T00:00:00Z');
    const b = new Date('2020-01-02T00:00:00Z');
    expect(getNumericCategoryValues(config.categoryAxis, [a, b])).toEqual([a.getTime(), b.getTime()]);
  });

  it('coerces linear numeric values with Number()', () => {
    const config = makeConfig({
      categoryAxis: { property: 'x', type: 'number', scale: 'linear' }
    });
    expect(getNumericCategoryValues(config.categoryAxis, [1, 2, 3] as CategoryValue[])).toEqual([1, 2, 3]);
    expect(getNumericCategoryValues(config.categoryAxis, ['4', '5'] as unknown as CategoryValue[])).toEqual([4, 5]);
  });
});

describe('getCategoryDataFromValues', () => {
  it('builds an ordinal axis domain spanning the value indices', () => {
    const config = ordinalConfig();
    const categoryData = getCategoryDataFromValues(config.categoryAxis, ['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(categoryData.axisDomain).toEqual([0, 2]);
    expect(categoryData.values.numeric).toEqual([0, 1, 2]);
  });

  it('produces a [0, 0] ordinal domain for empty values', () => {
    const config = ordinalConfig();
    const categoryData = getCategoryDataFromValues(config.categoryAxis, [], []);
    expect(categoryData.axisDomain).toEqual([0, 0]);
  });
});

describe('getCategoryDataWithRenderAxisDomain / getCategoryDataWithNumericValues', () => {
  it('replaces the render axis domain immutably, leaving the semantic domain alone', () => {
    const config = ordinalConfig();
    const categoryData = getCategoryDataFromValues(config.categoryAxis, ['a', 'b'], ['a', 'b']);
    const updated = getCategoryDataWithRenderAxisDomain(categoryData, [1, 5]);
    expect(updated).not.toBe(categoryData);
    expect(updated.renderAxisDomain).toEqual([1, 5]);
    expect(updated.axisDomain).toBe(categoryData.axisDomain);
    expect(updated.values).toBe(categoryData.values);
  });

  it('replaces the numeric values immutably', () => {
    const config = ordinalConfig();
    const categoryData = getCategoryDataFromValues(config.categoryAxis, ['a', 'b'], ['a', 'b']);
    const updated = getCategoryDataWithNumericValues(categoryData, [10, 20]);
    expect(updated).not.toBe(categoryData);
    expect(updated.values.numeric).toEqual([10, 20]);
    expect(updated.values.raw).toBe(categoryData.values.raw);
  });
});

describe('getCategoryValueObject', () => {
  it('slices out the values at a single index', () => {
    const config = ordinalConfig();
    const categoryData = getCategoryDataFromValues(config.categoryAxis, ['a', 'b', 'c'], ['A', 'B', 'C']);
    const obj = getCategoryValueObject(categoryData, 1);
    // parsed values derive from the display values (identity for string axes)
    expect(obj.values).toEqual({ raw: 'b', display: 'B', parsed: 'B', numeric: 1 });
    expect(obj.axisDomain).toEqual(categoryData.axisDomain);
  });
});
