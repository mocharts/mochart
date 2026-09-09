import { describe, it, expect } from 'vitest';
import { getSeriesPositionData } from '../../src/utils/SeriesPositions';
import { enhanceConfig } from '../../src';
import type { MochartInputConfig } from '../../src';
import type { AxisScale, SeriesValueObject } from '../../src/types/data';
import type { LayoutInfo } from '../../src/types/layout';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

function enhance(input: object): EnhancedMochartConfig {
  return enhanceConfig({ version: '1.0.0', ...input } as unknown as MochartInputConfig) as unknown as EnhancedMochartConfig;
}

function makeScale(map: (value: number) => number, domain: [number, number], range: [number, number]): AxisScale {
  return Object.assign((value: unknown) => map(value as number), {
    domain: () => domain,
    range: () => range
  }) as unknown as AxisScale;
}

// Upright value axis: value 0 at the plot bottom (pixel 200), value 100 at the top (pixel 0).
const uprightScale = makeScale(value => 200 - 2 * value, [0, 100], [200, 0]);
// Inverted value axis: value 0 at pixel 0, value 100 at pixel 200.
const invertedScale = makeScale(value => 2 * value, [0, 100], [0, 200]);

const upright = { inverted: false } as unknown as LayoutInfo;
const inverted = { inverted: true } as unknown as LayoutInfo;

// Five categories 100px apart, each 40px wide and centred on its position.
const categoryValueData = {
  spacingInfo: { categoryRange: [0, 400] as [number, number], categoryValueExtent: 40, categoryValueOffset: 20 },
  positions: [0, 100, 200, 300, 400]
};

function values(max: number[], min: number[] | null = null): SeriesValueObject {
  return { min, max } as unknown as SeriesValueObject;
}

const NA = NaN;

describe('getSeriesPositionData', () => {
  describe('plain series with missingValueMode break (default)', () => {
    const config = enhance({ series: [{ property: 'v' }] });
    const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
      values([10, NA, 30.3, 40, 50]), upright);

    it('floors scaled positions and leaves missing categories undefined', () => {
      expect(data.seriesPositions).toEqual([180, undefined, 139, 120, 100]);
      expect(data.seriesPriorPositions).toBeNull();
      expect(data.length).toBe(5);
      expect(data.skipped).toBe(false);
      expect(data.skipCategoryIndexMap).toEqual({});
      expect(data.categoryDefinedPositions).toBeNull();
      expect(data.seriesDefinedPositions).toBeNull();
    });

    it('marks only the missing category undefined', () => {
      expect([0, 1, 2, 3, 4].map(i => data.getDefined(null, i))).toEqual([true, false, true, true, true]);
    });

    it('offsets the category position by half the category extent', () => {
      expect(data.categoryValueExtent).toBe(40);
      expect(data.categoryValueOffset).toBe(-20);
      expect(data.getCategoryPosition(null, 1)).toBe(100);
      expect(data.getOffsetCategoryPosition(null, 1)).toBe(80);
    });

    it('spans from the range start when the axis has no base, missing categories collapsing there', () => {
      expect(data.getSeriesPosition(null, 0)).toBe(180);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(180);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(200);
      expect(data.getSeriesExtent(null, 0)).toBe(20);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(200);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(200);
      expect(data.getSeriesExtent(null, 1)).toBe(0);
    });
  });

  describe('missingValueMode base', () => {
    it('positions missing categories at the base and treats them as defined', () => {
      const config = enhance({ valueAxes: [{ base: 20 }], series: [{ property: 'v', missingValueMode: 'base' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, NA, 30, NA, 50]), upright);
      expect(data.seriesPositions).toEqual([180, 160, 140, 160, 100]);
      expect(data.getDefined(null, 1)).toBe(true);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(160);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(160);
      expect(data.getSeriesExtent(null, 1)).toBe(0);
    });

    it('uses the range start as the missing position when the axis has no base', () => {
      const config = enhance({ series: [{ property: 'v', missingValueMode: 'base' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, NA, 30, 40, 50]), upright);
      expect(data.seriesPositions[1]).toBe(200);
      expect(data.getDefined(null, 1)).toBe(true);
    });

    it('fills both ends of a wholly missing ranged category with the base', () => {
      const config = enhance({ valueAxes: [{ base: 20 }], series: [{ property: 'v', rangeProperty: 'r', missingValueMode: 'base' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, NA, 30, 40, 50], [30, NA, 10, 40, 60]), upright);
      expect(data.seriesPositions[1]).toBe(160);
      expect(data.seriesPriorPositions![1]).toBe(160);
      expect(data.getSeriesExtent(null, 1)).toBe(0);
    });
  });

  describe('value axis base', () => {
    const plain = (base: number) => enhance({ valueAxes: [{ base }], series: [{ property: 'v' }] });

    it('splits bars at the base pixel: current is the near end, prior the far end', () => {
      const config = plain(50);
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([80, 20, 50, NA, 50]), upright);
      // 80 sits above the base (pixel 40 < 100): the bar hangs from the base down to the value
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(40);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(100);
      expect(data.getSeriesExtent(null, 0)).toBe(60);
      // 20 sits below the base (pixel 160 > 100): current stays at the base, prior reaches the value
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(100);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(160);
      expect(data.getSeriesExtent(null, 1)).toBe(60);
      // exactly at the base: zero extent
      expect(data.getSeriesExtent(null, 2)).toBe(0);
      // missing stays undefined at both ends
      expect(data.getCurrentSeriesPosition(null, 3)).toBeUndefined();
      expect(data.getPriorSeriesPosition(null, 3)).toBeUndefined();
    });

    it('swaps current and prior on an inverted layout', () => {
      const config = plain(50);
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, invertedScale,
        values([80, 20, 50, NA, 50]), inverted);
      // 80 → pixel 160, base → 100
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(160);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(100);
      // 20 → pixel 40
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(100);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(40);
      expect(data.getSeriesExtent(null, 1)).toBe(60);
    });

    it('clamps a base below the domain to the range start', () => {
      const config = plain(-50);
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([80, 20, 50, 40, 50]), upright);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(200);
      expect(data.getSeriesExtent(null, 0)).toBe(160);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(200);
    });

    it('clamps a base above the domain to the range end', () => {
      const config = plain(150);
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([80, 20, 50, 40, 50]), upright);
      // every value sits below the base pixel 0, so current stays at 0 and prior reaches the value
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(0);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(40);
      expect(data.getSeriesExtent(null, 1)).toBe(160);
    });
  });

  describe('ranged series (non-stacked)', () => {
    // only the bar renderer sorts each pair; a ranged line/area keeps property on the series side
    const rangeConfig = (extra: object = {}) => enhance({ series: [{ property: 'v', rangeProperty: 'r', renderer: 'bar', ...extra }] });
    const rangeValues = values([10, NA, 30, 5, NA], [20, 15, NA, 40, NA]);

    it('keeps property on the series side for a ranged line so crossing bounds do not swap', () => {
      const config = rangeConfig({ renderer: 'line' });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        rangeValues, upright);
      // 10/20 → 180/160: unsorted, seriesPositions stays the property pixel
      expect(data.seriesPositions[0]).toBe(180);
      expect(data.seriesPriorPositions![0]).toBe(160);
      expect(data.seriesPositions[3]).toBe(190);
      expect(data.seriesPriorPositions![3]).toBe(120);
      expect(data.getSeriesPosition(null, 0)).toBe(180);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(160);
      // back-fill of a half-missing pair still applies
      expect(data.seriesPositions[1]).toBe(170);
      expect(data.seriesPriorPositions![1]).toBe(170);
      expect(data.getSeriesExtent(null, 3)).toBe(70);
    });

    it('orders each bar pair so seriesPositions holds the near pixel and back-fills the absent end', () => {
      const config = rangeConfig();
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        rangeValues, upright);
      // 10/20 → 180/160: swapped so seriesPositions is the smaller pixel
      expect(data.seriesPositions[0]).toBe(160);
      expect(data.seriesPriorPositions![0]).toBe(180);
      // value missing, range 15 → both ends copy the range end
      expect(data.seriesPositions[1]).toBe(170);
      expect(data.seriesPriorPositions![1]).toBe(170);
      // range missing, value 30 → both ends copy the value end
      expect(data.seriesPositions[2]).toBe(140);
      expect(data.seriesPriorPositions![2]).toBe(140);
      // 5/40 → 190/120: swapped
      expect(data.seriesPositions[3]).toBe(120);
      expect(data.seriesPriorPositions![3]).toBe(190);
      // both missing → value stays undefined, prior sits at the range start
      expect(data.seriesPositions[4]).toBeUndefined();
      expect(data.seriesPriorPositions![4]).toBe(200);
      expect(data.getDefined(null, 4)).toBe(false);
    });

    it('serves current and prior straight from the ordered arrays', () => {
      const config = rangeConfig();
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        rangeValues, upright);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(160);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(180);
      expect(data.getSeriesExtent(null, 0)).toBe(20);
      expect(data.getSeriesExtent(null, 1)).toBe(0);
      expect(data.getSeriesExtent(null, 3)).toBe(70);
    });

    it('orders pairs the other way on an inverted layout', () => {
      const config = rangeConfig();
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, invertedScale,
        rangeValues, inverted);
      // 10/20 → 20/40: seriesPositions holds the larger pixel when inverted
      expect(data.seriesPositions[0]).toBe(40);
      expect(data.seriesPriorPositions![0]).toBe(20);
      expect(data.seriesPositions[3]).toBe(80);
      expect(data.seriesPriorPositions![3]).toBe(10);
      // both missing → prior at the inverted range start, pixel 0
      expect(data.seriesPriorPositions![4]).toBe(0);
    });

    it('drops half-missing pairs entirely under partialRangeIsMissing', () => {
      const config = rangeConfig({ partialRangeIsMissing: true });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        rangeValues, upright);
      expect(data.seriesPositions[1]).toBeUndefined();
      expect(data.seriesPriorPositions![1]).toBe(200);
      expect(data.seriesPositions[2]).toBeUndefined();
      expect(data.seriesPriorPositions![2]).toBe(200);
      expect(data.getDefined(null, 1)).toBe(false);
      expect(data.getDefined(null, 2)).toBe(false);
      // complete pairs are unaffected
      expect(data.seriesPositions[0]).toBe(160);
      expect(data.seriesPriorPositions![0]).toBe(180);
    });

    it('keeps range accessors even when the axis has a base', () => {
      const config = enhance({ valueAxes: [{ base: 50 }], series: [{ property: 'v', rangeProperty: 'r', renderer: 'bar' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([80, 20, 30, 40, 50], [90, 10, 30, 40, 50]), upright);
      // 80/90 lie wholly above the base; the bar spans the pair, not the base
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(20);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(40);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(160);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(180);
    });
  });

  describe('missingValueMode connect (skip compaction)', () => {
    it('compacts a plain series to its defined categories and maps compact indices back', () => {
      const config = enhance({ series: [{ property: 'v', missingValueMode: 'connect' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, NA, 30, NA, 50]), upright);
      expect(data.skipped).toBe(true);
      expect(data.length).toBe(3);
      expect(data.skipCategoryIndexMap).toEqual({ 0: 0, 1: 2, 2: 4 });
      expect(data.seriesPositions).toEqual([180, undefined, 140, undefined, 100]);
      expect(data.categoryDefinedPositions).toEqual([0, 200, 400]);
      expect(data.seriesDefinedPositions).toEqual([180, 140, 100]);
      expect(data.seriesPriorDefinedPositions).toBeNull();
      expect(data.getDefined(null, 1)).toBe(true);
      expect(data.getCategoryPosition(null, 1)).toBe(200);
      expect(data.getOffsetCategoryPosition(null, 1)).toBe(180);
      expect(data.getSeriesPosition(null, 1)).toBe(140);
      expect(data.getCurrentSeriesPosition(null, 2)).toBe(100);
      expect(data.getPriorSeriesPosition(null, 2)).toBe(200);
      expect(data.getSeriesExtent(null, 2)).toBe(100);
    });

    it('applies the base split over the compact arrays', () => {
      const config = enhance({ valueAxes: [{ base: 50 }], series: [{ property: 'v', missingValueMode: 'connect' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([80, NA, 20, NA, 50]), upright);
      expect(data.length).toBe(3);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(40);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(100);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(100);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(160);
      expect(data.getSeriesExtent(null, 2)).toBe(0);
    });

    it('compacts prior positions alongside a ranged series', () => {
      const config = enhance({ series: [{ property: 'v', rangeProperty: 'r', renderer: 'bar', missingValueMode: 'connect' }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, NA, 30, NA, 50], [20, NA, NA, 15, 60]), upright);
      // category 3 keeps its range end after back-fill, so only category 1 is skipped
      expect(data.length).toBe(4);
      expect(data.skipCategoryIndexMap).toEqual({ 0: 0, 1: 2, 2: 3, 3: 4 });
      expect(data.categoryDefinedPositions).toEqual([0, 200, 300, 400]);
      expect(data.seriesDefinedPositions).toEqual([160, 140, 170, 80]);
      expect(data.seriesPriorDefinedPositions).toEqual([180, 140, 170, 100]);
      expect(data.getCurrentSeriesPosition(null, 3)).toBe(80);
      expect(data.getPriorSeriesPosition(null, 3)).toBe(100);
      expect(data.getSeriesExtent(null, 3)).toBe(20);
    });
  });

  describe('stacked series', () => {
    const stacked = (extra: object = {}) => enhance({
      seriesStacks: [{ id: 'S' }],
      series: [{ property: 'a', ...extra }, { property: 'b', ...extra }]
    });
    // stack top / prior stack top for the second series
    const stackValues = values([30, NA, 50, 60, 70], [10, NA, 20, 40, 60]);

    it('takes stack tops and priors as given, without ordering, and falls back to the base', () => {
      const config = stacked();
      expect(config.valueAxes[0].base).toBe(0);
      const data = getSeriesPositionData(config.categoryAxis, config.series[1], categoryValueData, uprightScale,
        stackValues, upright);
      expect(data.seriesPositions).toEqual([140, undefined, 100, 80, 60]);
      expect(data.seriesPriorPositions).toEqual([180, undefined, 160, 120, 80]);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(140);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(180);
      expect(data.getSeriesExtent(null, 0)).toBe(40);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(200);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(200);
      expect(data.getSeriesExtent(null, 1)).toBe(0);
    });

    it('does not swap current and prior on an inverted layout', () => {
      const config = stacked();
      const data = getSeriesPositionData(config.categoryAxis, config.series[1], categoryValueData, invertedScale,
        stackValues, inverted);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(60);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(20);
      expect(data.getSeriesExtent(null, 0)).toBe(40);
    });

    it('compacts stack tops and priors under missingValueMode connect', () => {
      const config = stacked({ missingValueMode: 'connect' });
      const data = getSeriesPositionData(config.categoryAxis, config.series[1], categoryValueData, uprightScale,
        stackValues, upright);
      expect(data.length).toBe(4);
      expect(data.skipCategoryIndexMap).toEqual({ 0: 0, 1: 2, 2: 3, 3: 4 });
      expect(data.seriesDefinedPositions).toEqual([140, 100, 80, 60]);
      expect(data.seriesPriorDefinedPositions).toEqual([180, 160, 120, 80]);
      expect(data.getCurrentSeriesPosition(null, 1)).toBe(100);
      expect(data.getPriorSeriesPosition(null, 1)).toBe(160);
    });

    // Regression: the connect path sorted stack tops against priors like unstacked ranges, so a
    // negative segment (top below its prior) rendered at the prior and its cap pointed at the base
    it('keeps a negative stack segment\'s top and prior in place under missingValueMode connect', () => {
      const config = stacked({ missingValueMode: 'connect' });
      // scale spans -100..100 across 200px so negative stack values map below the base
      const signedScale = makeScale(value => 100 - value, [-100, 100], [200, 0]);
      const negativeStackValues = values([-30, NA, -50, -60, -70], [-10, NA, -20, -40, -60]);
      const data = getSeriesPositionData(config.categoryAxis, config.series[1], categoryValueData, signedScale,
        negativeStackValues, upright);
      expect(data.seriesDefinedPositions).toEqual([130, 150, 160, 170]);
      expect(data.seriesPriorDefinedPositions).toEqual([110, 120, 140, 160]);
      expect(data.getCurrentSeriesPosition(null, 0)).toBe(130);
      expect(data.getPriorSeriesPosition(null, 0)).toBe(110);
    });
  });

  describe('series groups', () => {
    const grouped = enhance({
      categoryAxis: { categoryPaddingFraction: { inner: 0.2, outer: 0.1 } },
      seriesGroups: [{ id: 'G' }],
      series: [{ property: 'a' }, { property: 'b' }]
    });

    it('splits the category extent into padded sub-slots by group index', () => {
      const first = getSeriesPositionData(grouped.categoryAxis, grouped.series[0], categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50]), upright);
      const second = getSeriesPositionData(grouped.categoryAxis, grouped.series[1], categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50]), upright);
      // 40px slot / 2 series = 20px each, less 20% inner padding = 16px, centred within its 20px
      expect(first.categoryValueExtent).toBe(16);
      expect(first.categoryValueOffset).toBe(-18);
      expect(second.categoryValueExtent).toBe(16);
      expect(second.categoryValueOffset).toBe(2);
      expect(first.getOffsetCategoryPosition(null, 1)).toBe(82);
      expect(second.getOffsetCategoryPosition(null, 1)).toBe(102);
    });

    it('applies barWidthFraction inside the group sub-slot', () => {
      const config = enhance({
        categoryAxis: { categoryPaddingFraction: { inner: 0.2, outer: 0.1 } },
        seriesGroups: [{ id: 'G' }],
        series: [{ property: 'a' }, { property: 'b', bar: { widthFraction: 0.5 } }]
      });
      const second = getSeriesPositionData(config.categoryAxis, config.series[1], categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50]), upright);
      expect(second.categoryValueExtent).toBe(8);
      expect(second.categoryValueOffset).toBe(6);
    });

    it('gives stack-mates in a group one shared sub-slot, so two stacks make two columns', () => {
      const config = enhance({
        categoryAxis: { categoryPaddingFraction: { inner: 0.2, outer: 0.1 } },
        seriesGroups: [{ id: 'G' }],
        seriesStacks: [{ id: 'S1' }, { id: 'S2' }],
        series: [
          { property: 'a', stack: 'S1' }, { property: 'b', stack: 'S1' },
          { property: 'c', stack: 'S2' }, { property: 'd', stack: 'S2' }
        ]
      });
      const offsets = config.series.map(series => getSeriesPositionData(config.categoryAxis, series, categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50], [0, 0, 0, 0, 0]), upright).categoryValueOffset);
      // two sub-slots (one per stack), same geometry as two ungrouped-stack series
      expect(offsets).toEqual([-18, -18, 2, 2]);
    });

    it('mixes stacked and unstacked series: one sub-slot per stack plus one per lone series', () => {
      const config = enhance({
        seriesGroups: [{ id: 'G' }],
        seriesStacks: [{ id: 'S1' }],
        series: [{ property: 'a', stack: 'S1' }, { property: 'b', stack: null }, { property: 'c', stack: 'S1' }]
      });
      expect(config.seriesGroups[0].subSlotCount).toBe(2);
      expect(config.seriesGroups[0].subSlotIndicesById).toEqual({ [config.series[0].id]: 0, [config.series[1].id]: 1, [config.series[2].id]: 0 });
    });
  });

  describe('barWidthFraction and barAlignFraction', () => {
    const narrow = (barAlignFraction?: number) => {
      const config = enhance({ series: [{ property: 'v', bar: { widthFraction: 0.5, ...(barAlignFraction === undefined ? {} : { alignFraction: barAlignFraction }) } }] });
      return getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50]), upright);
    };

    it('narrows the bar and centres it by default', () => {
      const data = narrow();
      expect(data.categoryValueExtent).toBe(20);
      expect(data.categoryValueOffset).toBe(-10);
      expect(data.getOffsetCategoryPosition(null, 2)).toBe(190);
    });

    it('aligns to the slot start at 0 and the slot end at 1', () => {
      expect(narrow(0).categoryValueOffset).toBe(-20);
      expect(narrow(1).categoryValueOffset).toBe(0);
      expect(narrow(0.25).categoryValueOffset).toBe(-15);
    });

    it('leaves the slot untouched at the default width', () => {
      const config = enhance({ series: [{ property: 'v', bar: { alignFraction: 0 } }] });
      const data = getSeriesPositionData(config.categoryAxis, config.series[0], categoryValueData, uprightScale,
        values([10, 20, 30, 40, 50]), upright);
      expect(data.categoryValueExtent).toBe(40);
      expect(data.categoryValueOffset).toBe(-20);
    });
  });
});

// Horizontal-waterfall shape: ranged bars with the skip flags createWaterfall
// emits, value axis based at the domain minimum.
const waterfallConfig = enhance({
  plot: { inverted: true },
  categoryAxis: { property: 'step', type: 'string', scale: 'ordinal' },
  valueAxes: [{ base: 0 }],
  series: [{ property: 'end', rangeProperty: 'start', renderer: 'bar', missingValueMode: 'connect', partialRangeIsMissing: true }]
});

// An inverted value axis ranges [0, extent], so the domain minimum maps to
// pixel 0 exactly - the value the old || fallback treated as missing.
const waterfallScale = makeScale(value => value * 10, [0, 30], [0, 300]);

const waterfallCategoryValueData = {
  spacingInfo: { categoryRange: [0, 300] as [number, number], categoryValueExtent: 40, categoryValueOffset: 0 },
  positions: [0, 100, 200]
};

describe('getSeriesPositionData with a pixel-0 prior position', () => {
  const positionData = getSeriesPositionData(waterfallConfig.categoryAxis, waterfallConfig.series[0],
    waterfallCategoryValueData, waterfallScale, values([10, 20, 30], [0, 10, 20]), inverted);

  it('keeps the first bar spanning from pixel 0 instead of collapsing it', () => {
    expect(positionData.getPriorSeriesPosition(null, 0)).toBe(0);
    expect(positionData.getCurrentSeriesPosition(null, 0)).toBe(100);
    expect(positionData.getSeriesExtent(null, 0)).toBe(100);
  });

  it('leaves bars with nonzero priors untouched', () => {
    expect(positionData.getPriorSeriesPosition(null, 1)).toBe(100);
    expect(positionData.getSeriesExtent(null, 1)).toBe(100);
    expect(positionData.getSeriesExtent(null, 2)).toBe(100);
  });
});
