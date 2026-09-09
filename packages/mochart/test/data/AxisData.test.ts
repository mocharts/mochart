import { describe, it, expect } from 'vitest';
import { scaleTime, scaleLinear } from 'd3-scale';
import { getCategorySpacingInfo, getCategoryAxisTickData, scaleMutator } from '../../src/data/AxisData';
import { makeConfig } from './fixtures';
import type { CategoryAxisConfig } from '../../src/types/config';
import type { AxisScale, CategoryAxisDomain } from '../../src/types/data';
import type { CategoryAxisLayoutInfo } from '../../src/types/layout';

// getCategorySpacingInfo turns a category axis domain + pixel extent into the pixel
// range, per-category extent and offset used to place category values. Only a few
// config fields participate; build small partials.
const axis = (over: Partial<CategoryAxisConfig>): CategoryAxisConfig => ({
  categoryCountPadding: 0,
  minCategoryValueExtent: 0,
  categoryPaddingFraction: { outer: 0 },
  ...over
}) as CategoryAxisConfig;

describe('getCategorySpacingInfo', () => {
  it('spans the full extent when the domain is a single point and there is no padding', () => {
    const info = getCategorySpacingInfo(axis({}), [5, 5] as CategoryAxisDomain, 200);
    expect(info.categoryRange).toEqual([0, 200]);
    expect(info.categoryValueExtent).toBe(200);
    expect(info.categoryValueOffset).toBe(100);
  });

  it('divides the extent evenly across the domain when there is no padding', () => {
    // domain extent 4, pixel extent 200 => 50px per unit
    const info = getCategorySpacingInfo(axis({}), [0, 4] as CategoryAxisDomain, 200);
    expect(info.categoryValueExtent).toBe(50);
    expect(info.categoryRange).toEqual([0, 200]);
  });

  it('reserves half a slot on each end when categoryCountPadding is set', () => {
    // extent / (domainExtent + padding) = 200 / (4 + 1) = 40; range shrinks by 20 each side
    const info = getCategorySpacingInfo(axis({ categoryCountPadding: 1 }), [0, 4] as CategoryAxisDomain, 200);
    expect(info.categoryValueExtent).toBe(40);
    expect(info.categoryRange).toEqual([20, 180]);
  });

  it('shrinks the category value extent by the outer padding fraction', () => {
    // 50px per unit, 20% outer padding => floor(50 * 0.8) = 40
    const info = getCategorySpacingInfo(axis({ categoryPaddingFraction: { outer: 0.2 } as CategoryAxisConfig['categoryPaddingFraction'] }), [0, 4] as CategoryAxisDomain, 200);
    expect(info.categoryValueExtent).toBe(40);
  });

  it('never drops below the configured minimum category value extent', () => {
    const info = getCategorySpacingInfo(axis({ minCategoryValueExtent: 30 }), [0, 100] as CategoryAxisDomain, 200);
    expect(info.categoryValueExtent).toBe(30);
  });

  it('treats a null domain bound as a zero extent', () => {
    const info = getCategorySpacingInfo(axis({}), [null, null] as CategoryAxisDomain, 120);
    expect(info.categoryValueExtent).toBe(120);
  });
});

describe('getCategoryAxisTickData', () => {
  const layout = { tickLabelParallel: false } as CategoryAxisLayoutInfo;

  // Regression: domain() on a d3 time scale returns fresh Date objects, so the
  // old reference comparison drew two identical overlapping ticks.
  it('draws a single tick for a single-category linear date axis', () => {
    const config = makeConfig({ categoryAxis: { property: 'when', type: 'date', scale: 'linear' } });
    const date = new Date('2026-08-07T00:00:00Z');
    const axisScale = scaleTime().domain([date, date]).range([0, 200]) as unknown as AxisScale;
    const ticks = getCategoryAxisTickData(config.categoryAxis, layout, axisScale, [date, date] as CategoryAxisDomain, [date], [100]);
    expect(ticks).toHaveLength(1);
  });

  // Regression: ordinal number labels came from a linear tickFormat whose precision is the tick step, so
  // categories smaller than the step read "0" ("0k, 0k, 0k, 1k, 10k")
  it('formats ordinal number categories individually', () => {
    const config = makeConfig({ categoryAxis: { property: 'x', type: 'number', scale: 'ordinal' } });
    const ordinalLayout = { tickLabelParallel: false, tickLabelSpace: 10 } as CategoryAxisLayoutInfo;
    const labelsFor = (values: number[]) => {
      const axisScale = scaleLinear().domain([0, values.length - 1]).range([0, 400]) as unknown as AxisScale;
      const positions = values.map((_, i) => 400 * i / (values.length - 1));
      return getCategoryAxisTickData(config.categoryAxis, ordinalLayout, axisScale, [0, values.length - 1] as CategoryAxisDomain, values, positions)
        .map(tick => tick.label);
    };
    expect(labelsFor([1, 10, 100, 1000, 10000])).toEqual(['1', '10', '100', '1k', '10k']);
    expect(labelsFor([0.05, 0.1, 1, 5])).toEqual(['50m', '100m', '1', '5']);
    expect(labelsFor([1, 1.5, 2])).toEqual(['1', '1.5', '2']);
  });

  it('draws a single tick for a single-category linear number axis', () => {
    const config = makeConfig({ categoryAxis: { property: 'x', type: 'number', scale: 'linear' } });
    const axisScale = scaleLinear().domain([5, 5]).range([0, 200]) as unknown as AxisScale;
    const ticks = getCategoryAxisTickData(config.categoryAxis, layout, axisScale, [5, 5] as CategoryAxisDomain, [5], [100]);
    expect(ticks).toHaveLength(1);
  });
});

// scaleMutator keeps the previous scale when nothing about it changed, which is what lets the
// chart skip re-measuring axis text. Date scales hand back new Date objects every call, so an
// identity comparison of the domain never matched and date charts re-measured on every frame.
describe('scaleMutator', () => {
  const dateScale = (from: string, to: string) =>
    scaleTime().domain([new Date(from), new Date(to)]).range([0, 100]);

  it('keeps the old date scale when the domain is unchanged', () => {
    const oldScale = dateScale('2020-01-01', '2020-06-01');
    const newScale = dateScale('2020-01-01', '2020-06-01');
    expect(scaleMutator(oldScale, newScale)).toBe(oldScale);
  });

  it('takes the new date scale when the domain really changed', () => {
    const oldScale = dateScale('2020-01-01', '2020-06-01');
    const newScale = dateScale('2020-01-01', '2020-07-01');
    expect(scaleMutator(oldScale, newScale)).toBe(newScale);
  });

  it('takes the new scale when only the range changed', () => {
    const oldScale = dateScale('2020-01-01', '2020-06-01');
    const newScale = dateScale('2020-01-01', '2020-06-01').range([0, 200]);
    expect(scaleMutator(oldScale, newScale)).toBe(newScale);
  });

  it('still keeps a numeric scale with an unchanged domain', () => {
    const oldScale = scaleLinear().domain([0, 10]).range([0, 100]);
    const newScale = scaleLinear().domain([0, 10]).range([0, 100]);
    expect(scaleMutator(oldScale, newScale)).toBe(oldScale);
  });
});
