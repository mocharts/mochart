import { describe, it, expect } from 'vitest';
import { getChartData } from '../../src/data/ChartData';
import {
  getChartAnimationData,
  getStartChartData,
  getEndChartData
} from '../../src/animation/ChartAnimationData';
import { getChartDataForValueDelta, getChartDataForAxisDelta } from '../../src/animation/ChartAnimation';
import { isDomainTranslation, TRANSLATION_UNION_RATIO } from '../../src/animation/DomainAnimationData';
import { oldIndexForNewIndex, newIndexForOldIndex, newIndexForMergedIndex } from '../../src/animation/CategoryAnimationData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';

import type { AnimationChartData } from '../../src/types/animation';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

const config: EnhancedMochartConfig = makeConfig({
  categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
  series: [{ property: 'a', renderer: 'bar' }]
});
const seriesId = config.series[0].id;

function chartDataFor(rows: Record<string, number>[]): AnimationChartData {
  return getChartData(config, new ArrayOfObjectsDataProvider(rows), {});
}

function plain(chartData: AnimationChartData): (number | undefined)[] | null {
  return chartData.seriesData.raw.values[seriesId].plain;
}

describe('getChartAnimationData', () => {
  it('marks the first animation (no prior data) as initial', () => {
    const cad = getChartAnimationData(config, null, chartDataFor([{ c: 0, a: 5 }]));
    expect(cad.initialAnimation).toBe(true);
  });

  it('is a transition (not initial) when prior data exists', () => {
    const cad = getChartAnimationData(config, chartDataFor([{ c: 0, a: 5 }]), chartDataFor([{ c: 0, a: 9 }]));
    expect(cad.initialAnimation).toBe(false);
  });
});

describe('getChartDataForValueDelta', () => {
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 0 }]),
    chartDataFor([{ c: 0, a: 10 }, { c: 1, a: 20 }])
  );

  it('returns the start values at percentage 0', () => {
    expect(plain(getChartDataForValueDelta(config, cad, 0))).toEqual([0, 0]);
  });

  it('returns the end values at percentage 1', () => {
    expect(plain(getChartDataForValueDelta(config, cad, 1))).toEqual([10, 20]);
  });

  it('interpolates linearly at the midpoint', () => {
    expect(plain(getChartDataForValueDelta(config, cad, 0.5))).toEqual([5, 10]);
  });

  it('produces values between start and end for an intermediate percentage', () => {
    const values = plain(getChartDataForValueDelta(config, cad, 0.25))!;
    expect(values[0]!).toBeGreaterThan(0);
    expect(values[0]!).toBeLessThan(10);
    expect(values[1]!).toBeGreaterThan(0);
    expect(values[1]!).toBeLessThan(20);
  });
});

describe('getChartDataForValueDelta with an undefined hole', () => {
  // category 1 animates from a defined 0 to an undefined (missing) value
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 0 }]),
    chartDataFor([{ c: 0, a: 10 }, { c: 1 }])
  );

  it('interpolates the defined point and holds the vanishing point at its start', () => {
    // category 0 tweens 0 -> 10 as usual; category 1 has no end value, so its delta
    // is zero and it holds at the start value rather than becoming undefined
    expect(plain(getChartDataForValueDelta(config, cad, 0))).toEqual([0, 0]);
    expect(plain(getChartDataForValueDelta(config, cad, 0.5))).toEqual([5, 0]);
    expect(plain(getChartDataForValueDelta(config, cad, 1))).toEqual([10, 0]);
  });
});

describe('getChartDataForAxisDelta (category added)', () => {
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 10 }, { c: 1, a: 20 }]),
    chartDataFor([{ c: 0, a: 10 }, { c: 1, a: 20 }, { c: 2, a: 30 }])
  );

  it('expands the ordinal category render domain from the start to the end span', () => {
    // the animation moves the render domain only; the semantic domain switches with the chart data
    expect(getChartDataForAxisDelta(config, cad, true, 0).categoryData.renderAxisDomain).toEqual([0, 1]);
    expect(getChartDataForAxisDelta(config, cad, true, 1).categoryData.renderAxisDomain).toEqual([0, 2]);
  });
});

describe('getChartDataForAxisDelta (category removed)', () => {
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 10 }, { c: 1, a: 20 }, { c: 2, a: 30 }]),
    chartDataFor([{ c: 0, a: 10 }, { c: 2, a: 30 }])
  );

  it('starts the contraction at the merged slots and slides to the final slots', () => {
    expect(getChartDataForAxisDelta(config, cad, false, 0).categoryData.values.numeric).toEqual([0, 2]);
    expect(getChartDataForAxisDelta(config, cad, false, 0.5).categoryData.values.numeric).toEqual([0, 1.5]);
    expect(getChartDataForAxisDelta(config, cad, false, 1).categoryData.values.numeric).toEqual([0, 1]);
  });
});

describe('expansion final axis bases (raw-only domain change)', () => {
  const twoSeriesConfig = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [{ property: 'a', renderer: 'bar' }, { property: 'b', renderer: 'bar' }]
  });
  const [seriesA, seriesB] = twoSeriesConfig.series.map(s => s.id);
  const axisId = twoSeriesConfig.valueAxes[0].id;
  const filtered = { [seriesA]: true };
  const dataFor = (rows: Record<string, number>[]) => getChartData(twoSeriesConfig, new ArrayOfObjectsDataProvider(rows), filtered);

  it('moves the base with the raw domain even though the filtered domain is unchanged', () => {
    // a is filtered out; its min drops below the raw min while b's extent stays put and a category is added
    const cad = getChartAnimationData(twoSeriesConfig,
      dataFor([{ c: 0, a: 5, b: 10 }, { c: 1, a: 8, b: 20 }]),
      dataFor([{ c: 0, a: -22, b: 10 }, { c: 1, a: 8, b: 20 }, { c: 2, a: 3, b: 15 }]));
    const final = cad.axisExpansionData.final!;
    expect(final.seriesData.raw.renderAxisDomains[axisId][0]).toBeLessThan(-22);
    // the base is the smallest value, not the axis bound the margin puts below it
    expect(final.seriesData.axisBases[axisId]).toBe(-22);
    // the entering bar starts at the base, so it has zero height instead of spanning the old base to the new min
    expect(getStartChartData(cad).seriesData.raw.values[seriesB].plain![2]).toBe(final.seriesData.axisBases[axisId]);
  });
});

// a translating domain (old and new barely overlap) skips the union phases and interpolates its render domain during the value phase, so a flat value holds its pixel position
describe('isDomainTranslation', () => {
  it('classifies barely-overlapping domains as a translation', () => {
    expect(isDomainTranslation([2.85, 3.15], [4.75, 5.25])).toBe(true);
    expect(isDomainTranslation([0, 10], [30, 40])).toBe(true);
  });

  it('keeps ordinary growth and shrinkage on the union path', () => {
    expect(isDomainTranslation([0, 100], [0, 50])).toBe(false);
    expect(isDomainTranslation([0, 10], [0, 40])).toBe(false);
    expect(isDomainTranslation([0, 10], [5, 15])).toBe(false); // union 15 = 1.5 × 10, at the threshold
  });

  it('leaves null and collapsed domains to the existing machinery', () => {
    expect(isDomainTranslation([null, null], [4, 5])).toBe(false);
    expect(isDomainTranslation([3, 3], [5, 5])).toBe(false);
    expect(TRANSLATION_UNION_RATIO).toBe(1.5);
  });
});

describe('translating value axis (flat data, all values equal)', () => {
  const axisId = config.valueAxes[0].id;
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 3 }, { c: 1, a: 3 }]),
    chartDataFor([{ c: 0, a: 5 }, { c: 1, a: 5 }])
  );

  it('skips the expansion and contraction phases', () => {
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
  });

  it('carries a domain delta into the value phase', () => {
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBeGreaterThan(0);
  });

  it('ends the value phase on the new render domain', () => {
    const endDomain = cad.valueChangeData.end.seriesData.raw.renderAxisDomains[axisId];
    expect(endDomain).toEqual(cad.valueChangeData.final.seriesData.raw.renderAxisDomains[axisId]);
    expect(+endDomain[0]!).toBeLessThan(5);
    expect(+endDomain[1]!).toBeGreaterThan(5);
  });

  it('keeps a flat value pinned to the domain midpoint on every frame', () => {
    for (const percentage of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const chartData = getChartDataForValueDelta(config, cad, percentage);
      const value = plain(chartData)![0]!;
      const [lo, hi] = chartData.seriesData.raw.renderAxisDomains[axisId] as [number, number];
      expect((value - lo) / (hi - lo)).toBeCloseTo(0.5, 10);
    }
  });

  it('moves the domain strictly between its endpoints mid-frame', () => {
    const [lo] = getChartDataForValueDelta(config, cad, 0.5).seriesData.raw.renderAxisDomains[axisId] as [number, number];
    const [startLo] = cad.valueChangeData.start.seriesData.raw.renderAxisDomains[axisId] as [number, number];
    const [endLo] = cad.valueChangeData.end.seriesData.raw.renderAxisDomains[axisId] as [number, number];
    expect(lo).toBeGreaterThan(startLo);
    expect(lo).toBeLessThan(endLo);
  });
});

describe('non-translating updates keep the existing phases', () => {
  it('an overlapping shrink still contracts after the value change', () => {
    const cad = getChartAnimationData(
      config,
      chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 100 }]),
      chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 50 }])
    );
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBe(0);
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBeGreaterThan(0);
  });

  it('an overlapping growth still expands before the value change', () => {
    const cad = getChartAnimationData(
      config,
      chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 10 }]),
      chartDataFor([{ c: 0, a: 0 }, { c: 1, a: 40 }])
    );
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBe(0);
    expect(cad.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });

  it('the initial empty-to-data animation carries no domain delta', () => {
    const cad = getChartAnimationData(config, null, chartDataFor([{ c: 0, a: 5 }]));
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltas.domain.filtered.deltaPercentage).toBe(0);
  });
});

// a translating linear category domain (a sliding window) skips the union phases; entering/leaving categories ride the moving window at their true values
describe('translating linear category axis (sliding date window)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const T0 = Date.UTC(2026, 0, 1);
  const day = (index: number) => new Date(T0 + index * DAY);

  // categoryDomainChange defaults to 'staged'; these suites pin the opt-in slide behavior
  const dateLinearConfig = makeConfig({
    categoryAxis: { property: 'c', type: 'date', scale: 'linear' },
    animation: { categoryDomainChange: 'auto' },
    series: [{ property: 'a', renderer: 'bar' }]
  });
  const windowRows = (firstDay: number) => [0, 1, 2, 3, 4].map(offset => ({ c: day(firstDay + offset), a: 5 }));
  const dataFor = (rows: { c: Date; a: number }[]) =>
    getChartData(dateLinearConfig, new ArrayOfObjectsDataProvider(rows), {});

  // window d0..d4 -> d3..d7: union spans 7 days against 4-day endpoints, over the 1.5x threshold
  const cad = getChartAnimationData(dateLinearConfig, dataFor(windowRows(0)), dataFor(windowRows(3)));

  it('skips the expansion and contraction phases', () => {
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
  });

  it('carries a category domain delta into the value phase', () => {
    expect(cad.valueChangeData.deltas.domain.category.deltaPercentage).toBeGreaterThan(0);
  });

  it('starts the value phase on the old window and ends it on the new one', () => {
    expect(+cad.valueChangeData.start.categoryData.renderAxisDomain[0]!).toBe(+day(0));
    expect(+cad.valueChangeData.end.categoryData.renderAxisDomain[0]!).toBe(+day(3));
    expect(+cad.valueChangeData.final.categoryData.renderAxisDomain[1]!).toBe(+day(7));
  });

  it('renders the merged category set against a mid-slide window', () => {
    const frame = getChartDataForValueDelta(dateLinearConfig, cad, 0.5);
    expect(frame.categoryData.values.parsed.length).toBe(8); // d0..d7 merged
    const windowStart = +frame.categoryData.renderAxisDomain[0]!;
    expect(windowStart).toBeGreaterThan(+day(0));
    expect(windowStart).toBeLessThan(+day(3));
  });

  it('keeps an overlapping window growth on the staged path', () => {
    const grown = getChartAnimationData(dateLinearConfig, dataFor(windowRows(0)),
      dataFor([...windowRows(0), { c: day(5), a: 5 }]));
    expect(grown.valueChangeData.deltas.domain.category.deltaPercentage).toBe(0);
    expect(grown.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });

  const rowsFor = (firstDay: number, values: number[]) => values.map((a, offset) => ({ c: day(firstDay + offset), a }));

  it('slides the category axis while the value axis expands via the staged path', () => {
    // flat 5s -> [5..8]: the value domains overlap, so the value axis keeps the union phases
    const mixed = getChartAnimationData(dateLinearConfig, dataFor(rowsFor(0, [5, 5, 5, 5, 5])), dataFor(rowsFor(3, [5, 6, 7, 8, 5])));
    expect(mixed.valueChangeData.deltas.domain.category.deltaPercentage).toBeGreaterThan(0);
    expect(mixed.valueChangeData.deltas.domain.raw.deltaPercentage).toBe(0);
    expect(mixed.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
    // the category window holds still while the value axis expands
    expect(mixed.axisExpansionData.start!.categoryData.renderAxisDomain)
      .toEqual(mixed.axisExpansionData.end!.categoryData.renderAxisDomain);
    expect(+mixed.axisExpansionData.end!.categoryData.renderAxisDomain[0]!).toBe(+day(0));
  });

  it('slides both axes at once when the window and the value range shift together', () => {
    const axisId = dateLinearConfig.valueAxes[0].id;
    const both = getChartAnimationData(dateLinearConfig, dataFor(rowsFor(0, [5, 6, 5, 6, 5])), dataFor(rowsFor(3, [50, 60, 50, 60, 50])));
    expect(both.axisExpansionData.deltaPercentage).toBe(0);
    expect(both.axisContractionData.deltaPercentage).toBe(0);
    expect(both.valueChangeData.deltas.domain.category.deltaPercentage).toBeGreaterThan(0);
    expect(both.valueChangeData.deltas.domain.raw.deltaPercentage).toBeGreaterThan(0);

    // sample early: the value deltas dominate the phase pacing, so the smaller
    // category shift moves at the global rate and completes well before p = 1
    const frame = getChartDataForValueDelta(dateLinearConfig, both, 0.25);
    const windowStart = +frame.categoryData.renderAxisDomain[0]!;
    expect(windowStart).toBeGreaterThan(+day(0));
    expect(windowStart).toBeLessThan(+day(3));
    const valueLo = frame.seriesData.raw.renderAxisDomains[axisId][0] as number;
    expect(valueLo).toBeGreaterThan(5);
    expect(valueLo).toBeLessThan(50);
  });

  it('slides an explicit-bounds pan with unchanged data', () => {
    const boundsConfig = (from: number, to: number) => makeConfig({
      categoryAxis: { property: 'c', type: 'date', scale: 'linear', min: +day(from), max: +day(to) },
      animation: { categoryDomainChange: 'auto' },
      series: [{ property: 'a', renderer: 'bar' }]
    });
    const rows = windowRows(0);
    const oldData = getChartData(boundsConfig(0, 2), new ArrayOfObjectsDataProvider(rows), {});
    const newData = getChartData(boundsConfig(5, 7), new ArrayOfObjectsDataProvider(rows), {});
    const panned = getChartAnimationData(boundsConfig(5, 7), oldData, newData);
    expect(panned.axisExpansionData.deltaPercentage).toBe(0);
    expect(panned.valueChangeData.deltas.domain.category.deltaPercentage).toBeGreaterThan(0);
    expect(+panned.valueChangeData.end.categoryData.renderAxisDomain[0]!).toBe(+day(5));
    const frame = getChartDataForValueDelta(boundsConfig(5, 7), panned, 0.5);
    expect(+frame.categoryData.renderAxisDomain[0]!).toBeGreaterThan(+day(0));
    expect(+frame.categoryData.renderAxisDomain[0]!).toBeLessThan(+day(5));
  });
});

// animation.valueDomainChange: 'staged' forces the union phases everywhere, 'combined' merges
// every value-axis domain change into the value phase; 'auto' (the default, covered by the suites
// above) combines only translations
describe('animation.valueDomainChange modes', () => {
  const configFor = (valueDomainChange: 'staged' | 'combined') => makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    animation: { valueDomainChange },
    series: [{ property: 'a', renderer: 'bar' }]
  });
  const dataFor = (cfg: EnhancedMochartConfig, rows: Record<string, number>[]) =>
    getChartData(cfg, new ArrayOfObjectsDataProvider(rows), {});

  // the containment guarantee: no value ever leaves the interpolated domain mid-frame
  function expectValuesInsideDomain(cfg: EnhancedMochartConfig, cad: ReturnType<typeof getChartAnimationData>): void {
    const axisId = cfg.valueAxes[0].id;
    const id = cfg.series[0].id;
    for (const percentage of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const frame = getChartDataForValueDelta(cfg, cad, percentage);
      const [lo, hi] = frame.seriesData.raw.renderAxisDomains[axisId] as [number, number];
      for (const value of frame.seriesData.raw.values[id].plain!) {
        if (value !== undefined) {
          expect(value).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(value).toBeLessThanOrEqual(hi + 1e-9);
        }
      }
    }
  }

  it("'staged' forces the union phases back onto a translation", () => {
    const cfg = configFor('staged');
    const cad = getChartAnimationData(cfg, dataFor(cfg, [{ c: 0, a: 3 }, { c: 1, a: 3 }]), dataFor(cfg, [{ c: 0, a: 5 }, { c: 1, a: 5 }]));
    expect(cad.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltas.domain.category.deltaPercentage).toBe(0);
  });

  it("'combined' merges the phases for an overlapping growth", () => {
    const cfg = configFor('combined');
    const cad = getChartAnimationData(cfg, dataFor(cfg, [{ c: 0, a: 0 }, { c: 1, a: 10 }]), dataFor(cfg, [{ c: 0, a: 0 }, { c: 1, a: 40 }]));
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBeGreaterThan(0);
    expectValuesInsideDomain(cfg, cad);
  });

  it("'combined' merges the phases for an overlapping shrink", () => {
    const cfg = configFor('combined');
    const cad = getChartAnimationData(cfg, dataFor(cfg, [{ c: 0, a: 0 }, { c: 1, a: 100 }]), dataFor(cfg, [{ c: 0, a: 0 }, { c: 1, a: 50 }]));
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBeGreaterThan(0);
    expectValuesInsideDomain(cfg, cad);
  });
});

// categoryDomainChange defaults to 'staged' — a window slide zooms out over the union unless the
// config opts into 'auto'/'combined' — and the two axis kinds mix modes independently
describe('animation.categoryDomainChange', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const T0 = Date.UTC(2026, 0, 1);
  const day = (index: number) => new Date(T0 + index * DAY);
  const windowRows = (firstDay: number, values: number[]) => values.map((a, offset) => ({ c: day(firstDay + offset), a }));
  const configWith = (animation: Record<string, string>) => makeConfig({
    categoryAxis: { property: 'c', type: 'date', scale: 'linear' },
    animation,
    series: [{ property: 'a', renderer: 'bar' }]
  });
  const dataFor = (cfg: EnhancedMochartConfig, rows: { c: Date; a: number }[]) =>
    getChartData(cfg, new ArrayOfObjectsDataProvider(rows), {});

  it('stages a window slide by default', () => {
    const cfg = configWith({});
    const cad = getChartAnimationData(cfg, dataFor(cfg, windowRows(0, [5, 5, 5, 5, 5])), dataFor(cfg, windowRows(3, [5, 5, 5, 5, 5])));
    expect(cad.valueChangeData.deltas.domain.category.deltaPercentage).toBe(0);
    expect(cad.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });

  // Regression: 'combined' shrank an ordinal render domain during the value phase while the kept
  // categories stayed at their merged indices, so the contraction saw no domain move and they snapped
  it('leaves an ordinal axis to the union phases under combined', () => {
    const cfg = makeConfig({
      categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
      animation: { categoryDomainChange: 'combined' },
      series: [{ property: 'a', renderer: 'bar' }]
    });
    const rows = (labels: string[]) => labels.map(c => ({ c, a: 5 }));
    const cad = getChartAnimationData(cfg, dataFor(cfg, rows(['A', 'B', 'C']) as never), dataFor(cfg, rows(['A', 'C']) as never));
    // the value phase keeps the merged domain and positions; the contraction slides C from index 2 to 1
    expect(cad.valueChangeData.deltas.domain.category.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.final.categoryData.renderAxisDomain).toEqual([0, 2]);
    expect(cad.valueChangeData.final.categoryData.values.numeric).toEqual([0, 2]);
    expect(cad.axisContractionData.deltaPercentage).toBeGreaterThan(0);
    expect(cad.axisContractionData.final!.categoryData.renderAxisDomain).toEqual([0, 1]);
    expect(cad.axisContractionData.final!.categoryData.values.numeric).toEqual([0, 1]);
  });

  it('mixes modes per axis kind: combined values, staged categories', () => {
    const cfg = configWith({ valueDomainChange: 'combined', categoryDomainChange: 'staged' });
    // the window slides while the value range grows: the category unions, the value axis merges
    const cad = getChartAnimationData(cfg, dataFor(cfg, windowRows(0, [5, 6, 5, 6, 5])), dataFor(cfg, windowRows(3, [5, 9, 5, 9, 5])));
    expect(cad.valueChangeData.deltas.domain.category.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltas.domain.raw.deltaPercentage).toBeGreaterThan(0);
    expect(cad.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });
});

describe('getStartChartData / getEndChartData', () => {
  it('exposes the value-change transition endpoints', () => {
    const cad = getChartAnimationData(
      config,
      chartDataFor([{ c: 0, a: 1 }]),
      chartDataFor([{ c: 0, a: 2 }])
    );
    expect(getStartChartData(cad)).toBe(cad.valueChangeData.start);
    expect(getEndChartData(cad)).toBe(cad.valueChangeData.end);
  });
});

describe('getChartDataForValueDelta (range channel with an undefined hole)', () => {
  const rangeConfig: EnhancedMochartConfig = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [{ property: 'a', rangeProperty: 'hi', renderer: 'bar' }]
  });
  const rangeSeriesId = rangeConfig.series[0].id;

  function rangeChartData(rows: Record<string, number>[]): AnimationChartData {
    return getChartData(rangeConfig, new ArrayOfObjectsDataProvider(rows), {});
  }

  // category 1's range value (hi) disappears at the end while its plain value stays
  const cad = getChartAnimationData(
    rangeConfig,
    rangeChartData([{ c: 0, a: 0, hi: 0 }, { c: 1, a: 0, hi: 0 }]),
    rangeChartData([{ c: 0, a: 10, hi: 15 }, { c: 1, a: 20 }])
  );

  it('tweens the plain channel while holding the vanishing range point', () => {
    const mid = getChartDataForValueDelta(rangeConfig, cad, 0.5).seriesData.raw.values[rangeSeriesId];
    const end = getChartDataForValueDelta(rangeConfig, cad, 1).seriesData.raw.values[rangeSeriesId];
    // the missing category-1 range has zero delta and holds at start; ranged plain/range keys
    // share one duration, so range is at half its journey at the midpoint like plain
    expect(mid.plain).toEqual([5, 10]);
    expect(mid.range).toEqual([7.5, 0]);
    expect(end.plain).toEqual([10, 20]);
    expect(end.range).toEqual([15, 0]);
  });
});

describe('getChartDataForValueDelta (a point entering from undefined)', () => {
  // category 1 starts undefined (absent) and animates in to a defined end value
  const cad = getChartAnimationData(
    config,
    chartDataFor([{ c: 0, a: 10 }, { c: 1 }]),
    chartDataFor([{ c: 0, a: 10 }, { c: 1, a: 20 }])
  );

  it('animates the entering point from a defined baseline up to its end value', () => {
    const at0 = plain(getChartDataForValueDelta(config, cad, 0))!;
    const at05 = plain(getChartDataForValueDelta(config, cad, 0.5))!;
    const at1 = plain(getChartDataForValueDelta(config, cad, 1))!;

    // the stable neighbour is unaffected throughout
    expect(at0[0]).toBe(10);
    expect(at05[0]).toBe(10);
    expect(at1[0]).toBe(10);

    // the entering point is a real number at the start (never undefined),
    // increases monotonically, and lands exactly on the end value
    expect(typeof at0[1]).toBe('number');
    expect(at0[1]!).toBeLessThan(20);
    expect(at05[1]!).toBeGreaterThan(at0[1]!);
    expect(at05[1]!).toBeLessThan(20);
    expect(at1[1]).toBe(20);
  });
});

// Regression: the category index maps used indexOf, which compares Date category
// values by identity, so date charts lost their mid-animation focus remap.
describe('category index maps with Date category values', () => {
  const dateConfig = makeConfig({
    categoryAxis: { property: 'c', type: 'date', scale: 'ordinal' },
    series: [{ property: 'a', renderer: 'bar' }]
  });
  const dateRows = (offset: number) => [
    { c: new Date(2026, 0, 1), a: 1 + offset },
    { c: new Date(2026, 1, 1), a: 2 + offset }
  ];

  it('maps indices by value across fresh Date instances', () => {
    const cad = getChartAnimationData(
      dateConfig,
      getChartData(dateConfig, new ArrayOfObjectsDataProvider(dateRows(0)), {}),
      getChartData(dateConfig, new ArrayOfObjectsDataProvider(dateRows(5)), {})
    );
    expect(oldIndexForNewIndex(cad.categoryDeltaData, 1)).toBe(1);
    expect(newIndexForOldIndex(cad.categoryDeltaData, 0)).toBe(0);
    expect(newIndexForMergedIndex(cad.categoryDeltaData, 1)).toBe(1);
  });
});

// Regression: filteredSeriesDomainDeltas was omitted from the overall phase delta max, so a
// filtered-series transition underpaced its domain tween and snapped on the final frame.
describe('filtered series-domain deltas drive the phase pacing', () => {
  it('includes the filtered map in the overall delta and keeps factors >= 1', () => {
    const filteredConfig = makeConfig({
      categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
      valueAxes: [{ adjustForFiltering: false }],
      series: [{ property: 'a', renderer: 'bar' }, { property: 'b', renderer: 'bar' }]
    });
    const dataFor = (rows: Record<string, number>[]) =>
      getChartData(filteredConfig, new ArrayOfObjectsDataProvider(rows), { S0: true });
    const cad = getChartAnimationData(
      filteredConfig,
      dataFor([{ c: 0, a: 100, b: 5 }, { c: 1, a: 80, b: 10 }]),
      dataFor([{ c: 0, a: 100, b: 25 }, { c: 1, a: 80, b: 50 }])
    ) as any;

    for (const phase of [cad.axisExpansionData, cad.axisContractionData]) {
      const filtered = phase.deltas.domain.series.filtered;
      expect(phase.deltaPercentage).toBeGreaterThanOrEqual(filtered.deltaPercentage);
      expect(filtered.deltas.S1.deltaPercentage).toBeGreaterThan(0);
      expect(filtered.deltas.S1.deltaFactor).toBeGreaterThanOrEqual(1);
    }
  });
});

// Regression: getMaxDeltaPercentage omitted the tooltip key — a tooltip-only transition degraded
// to a 0-duration jump and mixed transitions under-interpolated before snapping.
describe('tooltip value deltas drive the phase pacing', () => {
  it('counts a tooltip-only change and keeps its factor >= 1', () => {
    const tooltipConfig = makeConfig({
      categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
      series: [{ property: 'a', tooltipProperty: 'info', renderer: 'bar' }]
    });
    const dataFor = (rows: Record<string, number>[]) =>
      getChartData(tooltipConfig, new ArrayOfObjectsDataProvider(rows), {});
    const cad = getChartAnimationData(
      tooltipConfig,
      dataFor([{ c: 0, a: 10, info: 100 }, { c: 1, a: 20, info: 200 }]),
      dataFor([{ c: 0, a: 10, info: 900 }, { c: 1, a: 20, info: 50 }])
    ) as any;

    const raw = cad.valueChangeData.deltas.raw;
    expect(raw.deltas.S0.tooltip.deltaPercentage).toBeGreaterThan(0);
    expect(raw.deltaPercentage).toBeGreaterThanOrEqual(raw.deltas.S0.tooltip.deltaPercentage);
    expect(raw.deltas.S0.tooltip.deltaFactor).toBeGreaterThanOrEqual(1);
  });
});

// Regression: unfiltering a series paced a dead axis-expansion phase (null -> full extent domain
// delta); hidden series must not stretch durations, but their deltas stay for end/final domains.
describe('hidden series are excluded from axis phase pacing', () => {
  const pacingConfig = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [{ property: 'a', renderer: 'bar' }, { property: 'b', renderer: 'bar' }]
  });
  const bId = pacingConfig.series[1].id;
  // b stays inside a's extent so toggling it never changes any axis domain
  const rows = [{ c: 0, a: 0, b: 10 }, { c: 1, a: 100, b: 90 }];
  const dataFor = (filtered: Record<string, boolean>) =>
    getChartData(pacingConfig, new ArrayOfObjectsDataProvider(rows), filtered);

  it('unfiltering starts the value phase immediately (no dead expansion phase)', () => {
    const cad = getChartAnimationData(pacingConfig, dataFor({ [bId]: true }), dataFor({})) as any;
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltaPercentage).toBeGreaterThan(0);
    // domain bookkeeping still lands the returning series' scale for the value phase
    expect(cad.axisExpansionData.final.seriesData.filtered.domains[bId].domain).toEqual([10, 90]);
  });

  it('filtering has no dead contraction tail', () => {
    const cad = getChartAnimationData(pacingConfig, dataFor({}), dataFor({ [bId]: true })) as any;
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
    expect(cad.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });

  it('a data change confined to a series hidden on both sides paces neither union phase', () => {
    const filtered = { [bId]: true };
    const cad = getChartAnimationData(pacingConfig,
      getChartData(pacingConfig, new ArrayOfObjectsDataProvider(rows), filtered),
      getChartData(pacingConfig, new ArrayOfObjectsDataProvider([{ c: 0, a: 0, b: 40 }, { c: 1, a: 100, b: 60 }]), filtered)) as any;
    expect(cad.axisExpansionData.deltaPercentage).toBe(0);
    expect(cad.axisContractionData.deltaPercentage).toBe(0);
  });
});
