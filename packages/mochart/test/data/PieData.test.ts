import { describe, it, expect } from 'vitest';
import { getPieSliceAngles, getPieSliceFractions, getPieSliceFractionMap, sweepPieSliceAngles, degreesToRadians } from '../../src/data/PieData';
import { getRadialLayoutInfo } from '../../src/layout/RadialLayout';
import type { PieConfig } from '../../src/types/config';
import type { SeriesValueObject } from '../../src/types/data';
import type { LayoutInfo } from '../../src/types/layout';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';

const TWO_PI = Math.PI * 2;

const seriesConfig = (id: string) => ({ id }) as EnhancedSeriesConfig;
// Mirrors the built defaults, including the conditional endAngle default of
// startAngle + 360 (a full circle unless overridden).
const pieConfig = (overrides: Partial<PieConfig> = {}) => ({
  innerRadiusFraction: 0, outerRadiusFraction: 1, startAngle: 0,
  endAngle: (overrides.startAngle ?? 0) + 360, padAngle: 0, cornerRadius: 0,
  focusOffsetFraction: 0, label: { visible: false, type: 'percent', valueFormat: 'auto', radiusFraction: 0.5, minFraction: 0.05 },
  centerLabel: { text: null }, centerTotal: { visible: false, format: 'auto' },
  ...overrides
}) as PieConfig;
const values = (plain: (number | undefined)[] | null) => ({ plain }) as SeriesValueObject;

describe('getPieSliceFractions', () => {
  const configs = [seriesConfig('a'), seriesConfig('b'), seriesConfig('c')];

  it('clamps missing, non-finite and non-positive values to 0', () => {
    const scalars: Record<string, number | null | undefined> = { a: 30, b: -5, c: undefined };
    const { total, values: clamped, fractions } = getPieSliceFractions(configs, id => scalars[id]);
    expect(total).toBe(30);
    expect(clamped).toEqual([30, 0, 0]);
    expect(fractions).toEqual([1, 0, 0]);
  });

  it('yields all-zero fractions for a non-positive total', () => {
    const { total, fractions } = getPieSliceFractions(configs, () => 0);
    expect(total).toBe(0);
    expect(fractions).toEqual([0, 0, 0]);
  });

  it('keeps the fractions correct when the values sum past Number.MAX_VALUE', () => {
    const scalars: Record<string, number | null | undefined> = { a: Number.MAX_VALUE, b: Number.MAX_VALUE, c: 0 };
    const { total, values: clamped, fractions } = getPieSliceFractions(configs, id => scalars[id]);
    expect(total).toBe(Infinity);
    expect(clamped).toEqual([Number.MAX_VALUE, Number.MAX_VALUE, 0]);
    expect(fractions).toEqual([0.5, 0.5, 0]);
  });

  it('divides plainly right up to the overflow boundary', () => {
    const half = Number.MAX_VALUE / 2;
    const scalars: Record<string, number | null | undefined> = { a: half, b: half, c: 0 };
    const { total, fractions } = getPieSliceFractions(configs, id => scalars[id]);
    expect(total).toBe(Number.MAX_VALUE);
    expect(fractions).toEqual([0.5, 0.5, 0]);
  });

  it('keys the fraction map by series id', () => {
    const scalars: Record<string, number | null | undefined> = { a: 30, b: 10, c: null };
    expect(getPieSliceFractionMap(configs, id => scalars[id])).toEqual({ a: 0.75, b: 0.25, c: 0 });
  });

  it('normalizes the same way the slice angles do', () => {
    // the tooltip reads one category's scalars, the slices read per-category arrays —
    // both must agree on each slice's share
    const angles = getPieSliceAngles(configs, { a: values([30]), b: values([10]), c: values(null) }, pieConfig());
    const scalars: Record<string, number | null | undefined> = { a: 30, b: 10, c: null };
    const fractionMap = getPieSliceFractionMap(configs, id => scalars[id]);
    expect(fractionMap.a).toBe(angles.a.fraction);
    expect(fractionMap.b).toBe(angles.b.fraction);
  });
});

describe('getPieSliceAngles', () => {
  it('divides the circle proportionally in series config order', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b')],
      { a: values([3]), b: values([1]) },
      pieConfig()
    );
    expect(angles.a.startAngle).toBe(0);
    expect(angles.a.endAngle).toBeCloseTo(TWO_PI * 0.75, 10);
    expect(angles.a.fraction).toBeCloseTo(0.75, 10);
    expect(angles.b.startAngle).toBeCloseTo(TWO_PI * 0.75, 10);
    expect(angles.b.endAngle).toBeCloseTo(TWO_PI, 10);
  });

  it('offsets all slices by startAngle degrees', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a')],
      { a: values([1]) },
      pieConfig({ startAngle: 90 })
    );
    expect(angles.a.startAngle).toBeCloseTo(degreesToRadians(90), 10);
    expect(angles.a.endAngle).toBeCloseTo(degreesToRadians(90) + TWO_PI, 10);
  });

  it('skips filtered (null) series and renormalizes the remainder', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b'), seriesConfig('c')],
      { a: values([1]), b: values(null), c: values([1]) },
      pieConfig()
    );
    expect(angles.a.fraction).toBeCloseTo(0.5, 10);
    expect(angles.b.fraction).toBe(0);
    expect(angles.c.fraction).toBeCloseTo(0.5, 10);
    expect(angles.c.endAngle).toBeCloseTo(TWO_PI, 10);
  });

  it('clamps negative and missing values to zero-width slices', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b'), seriesConfig('c')],
      { a: values([-2]), b: values([undefined]), c: values([4]) },
      pieConfig()
    );
    expect(angles.a.fraction).toBe(0);
    expect(angles.b.fraction).toBe(0);
    expect(angles.c.fraction).toBe(1);
  });

  it('returns an empty map when the total is not positive', () => {
    expect(getPieSliceAngles([seriesConfig('a')], { a: values([0]) }, pieConfig())).toEqual({});
    expect(getPieSliceAngles([seriesConfig('a')], { a: values(null) }, pieConfig())).toEqual({});
  });

  it('still divides the circle when the values sum past Number.MAX_VALUE', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b')],
      { a: values([Number.MAX_VALUE]), b: values([Number.MAX_VALUE]) },
      pieConfig()
    );
    expect(angles.a.endAngle).toBeCloseTo(Math.PI, 10);
    expect(angles.b.startAngle).toBeCloseTo(Math.PI, 10);
    expect(angles.b.endAngle).toBeCloseTo(TWO_PI, 10);
  });

  it('divides a partial span for half/gauge pies', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b')],
      { a: values([1]), b: values([1]) },
      pieConfig({ startAngle: -90, endAngle: 90 })
    );
    expect(angles.a.startAngle).toBeCloseTo(degreesToRadians(-90), 10);
    expect(angles.a.endAngle).toBeCloseTo(0, 10);
    expect(angles.b.endAngle).toBeCloseTo(degreesToRadians(90), 10);
  });

  it('runs counterclockwise when endAngle is less than startAngle', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a')],
      { a: values([1]) },
      pieConfig({ startAngle: 90, endAngle: -90 })
    );
    expect(angles.a.startAngle).toBeCloseTo(degreesToRadians(90), 10);
    expect(angles.a.endAngle).toBeCloseTo(degreesToRadians(-90), 10);
  });
});

describe('sweepPieSliceAngles', () => {
  it('scales every slice toward the start angle by the given percentage', () => {
    const angles = getPieSliceAngles(
      [seriesConfig('a'), seriesConfig('b')],
      { a: values([1]), b: values([3]) },
      pieConfig({ startAngle: 90 })
    );
    const swept = sweepPieSliceAngles(angles, pieConfig({ startAngle: 90 }), 0.5);
    const startOffset = degreesToRadians(90);
    expect(swept.a.startAngle).toBeCloseTo(startOffset, 10);
    expect(swept.a.endAngle).toBeCloseTo(startOffset + (angles.a.endAngle - startOffset) * 0.5, 10);
    expect(swept.b.endAngle).toBeCloseTo(startOffset + Math.PI, 10);
    // fractions and values survive the sweep (labels/center total rely on them)
    expect(swept.b.fraction).toBe(angles.b.fraction);
    expect(swept.b.value).toBe(angles.b.value);
  });

  it('collapses everything onto the start angle at 0 and is identity at 1', () => {
    const angles = getPieSliceAngles([seriesConfig('a')], { a: values([2]) }, pieConfig());
    const collapsed = sweepPieSliceAngles(angles, pieConfig(), 0);
    expect(collapsed.a.startAngle).toBe(0);
    expect(collapsed.a.endAngle).toBe(0);
    expect(sweepPieSliceAngles(angles, pieConfig(), 1)).toBe(angles);
  });
});

describe('getRadialLayoutInfo', () => {
  const layout = (width: number, height: number) => ({ x: 10, y: 20, width, height }) as LayoutInfo;

  it('centers the circle and sizes the radius from the shorter side', () => {
    const info = getRadialLayoutInfo(layout(400, 300), pieConfig());
    expect(info).toEqual({ cx: 200, cy: 150, innerRadius: 0, outerRadius: 150 });
  });

  it('applies outerRadiusFraction and innerRadiusFraction', () => {
    const info = getRadialLayoutInfo(layout(400, 300), pieConfig({ outerRadiusFraction: 0.8, innerRadiusFraction: 0.5 }));
    expect(info.outerRadius).toBeCloseTo(120, 10);
    expect(info.innerRadius).toBeCloseTo(60, 10);
  });

  it('reserves room for focusOffsetFraction so an exploded slice stays inside the rect', () => {
    const info = getRadialLayoutInfo(layout(400, 300), pieConfig({ focusOffsetFraction: 0.1 }));
    expect(info.outerRadius).toBeCloseTo(150 / 1.1, 10);
    expect(info.outerRadius * 1.1).toBeCloseTo(150, 10);
    expect(info.cx).toBeCloseTo(200, 10);
    expect(info.cy).toBeCloseTo(150, 10);
  });

  it('fits a half-pie span into the rect instead of reserving the empty half', () => {
    const info = getRadialLayoutInfo(layout(400, 300), pieConfig({ startAngle: -90, endAngle: 90 }));
    // bounding box is 2 wide x 1 tall: radius fits min(400/2, 300/1)
    expect(info.outerRadius).toBeCloseTo(200, 10);
    expect(info.cx).toBeCloseTo(200, 10);
    // the arc (bbox y in [-1, 0]) is vertically centered: pivot at 150 + 100
    expect(info.cy).toBeCloseTo(250, 10);
  });

  it('fits a quarter span against its own bounding box', () => {
    const info = getRadialLayoutInfo(layout(300, 300), pieConfig({ startAngle: 0, endAngle: 90 }));
    // bbox is the top-right unit square: 1 x 1
    expect(info.outerRadius).toBeCloseTo(300, 10);
    expect(info.cx).toBeCloseTo(0, 10);
    expect(info.cy).toBeCloseTo(300, 10);
  });
});
