import { describe, it, expect } from 'vitest';
import { path } from 'd3-path';
import type { Path } from 'd3-path';
import { getColumnGenerator, getLineGenerator, getRangeLineGenerator, getAreaGenerator } from '../../src/utils/SeriesShapes';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';
import type { SeriesPositionData, StackData } from '../../src/types/data';

function seriesConfig(overrides: object = {}): EnhancedSeriesConfig {
  return {
    id: 'S', stack: null, cap: { type: null, size: 10, expand: true, onlyStackOuter: false },
    seriesStackConfig: undefined, bar: { minExtent: 0 }, curve: { type: 'linear' }, ...overrides
  } as unknown as EnhancedSeriesConfig;
}

// One bar: its slot starts at `category` and is `categoryValueExtent` wide; `current` is the value
// end, `prior` the base end, `series` the raw series pixel (equal to `prior` for a below-base bar).
function barPositions(opts: { current: number; prior: number; series?: number; category?: number; categoryValueExtent?: number }): SeriesPositionData {
  const { current, prior, series = current, category = 10, categoryValueExtent = 20 } = opts;
  return {
    length: 1, skipped: false, skipCategoryIndexMap: {}, categoryValueExtent,
    getOffsetCategoryPosition: () => category,
    getSeriesExtent: () => Math.abs(current - prior),
    getSeriesPosition: () => series,
    getPriorSeriesPosition: () => prior,
    getCurrentSeriesPosition: () => current
  } as unknown as SeriesPositionData;
}

const noStack = {} as unknown as StackData;

function column(config: EnhancedSeriesConfig, positions: SeriesPositionData, inverted = false, stackData: StackData = noStack): string {
  return getColumnGenerator(config, positions, inverted, stackData)(0);
}

// Expected geometry serialised through the same d3-path the generator uses.
function pathOf(build: (p: Path) => void): string {
  const p = path();
  build(p);
  return String(p);
}

// Upright: slot x 10–30, bar from base pixel 100 up to value pixel 40 (60px tall).
const upBar = barPositions({ current: 40, prior: 100 });
// Upright below the base: raw series pixel equals the prior, the generator swaps ends.
const downBar = barPositions({ current: 100, prior: 160, series: 160 });
// Upright short bar: 6px tall, shorter than the 10px cap.
const shortBar = barPositions({ current: 94, prior: 100 });
// Inverted: slot y 10–30, bar from base pixel 100 right to value pixel 160.
const rightBar = barPositions({ current: 160, prior: 100 });
// Inverted below the base: value pixel 40 left of the base.
const leftBar = barPositions({ current: 100, prior: 40, series: 40 });
const shortRightBar = barPositions({ current: 106, prior: 100 });

describe('getColumnGenerator', () => {
  describe('no cap', () => {
    it('draws a rect between the value and base ends', () => {
      expect(column(seriesConfig(), upBar)).toBe(pathOf(p => p.rect(10, 40, 20, 60)));
      expect(column(seriesConfig(), downBar)).toBe(pathOf(p => p.rect(10, 100, 20, 60)));
    });

    it('draws a rect across the slot when inverted', () => {
      expect(column(seriesConfig(), rightBar, true)).toBe(pathOf(p => p.rect(100, 10, 60, 20)));
      expect(column(seriesConfig(), leftBar, true)).toBe(pathOf(p => p.rect(40, 10, 60, 20)));
    });

    it('never draws a slot narrower than one pixel', () => {
      const sliver = barPositions({ current: 40, prior: 100, categoryValueExtent: 0.25 });
      expect(column(seriesConfig(), sliver)).toBe(pathOf(p => p.rect(10, 40, 1, 60)));
    });
  });

  describe('point cap', () => {
    const point = (cap: object = {}) => seriesConfig({ cap: { type: 'point', size: 10, expand: false, ...cap } });

    it('draws a pentagon whose tip is the value end, cap base capSize inward', () => {
      expect(column(point(), upBar)).toBe(pathOf(p => {
        p.moveTo(10, 50); p.lineTo(20, 40); p.lineTo(30, 50); p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
    });

    it('points the cap away from the base for a below-base bar', () => {
      expect(column(point(), downBar)).toBe(pathOf(p => {
        p.moveTo(10, 150); p.lineTo(20, 160); p.lineTo(30, 150); p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
    });

    it('points the cap away from the base for a negative stack segment', () => {
      // stack segment growing downward: value end below the prior end, raw pixel is the value end
      const negativeSegment = barPositions({ current: 160, prior: 100, series: 160 });
      expect(column(point(), negativeSegment)).toBe(column(point(), downBar));
    });

    it('shrinks a bar shorter than the cap to a narrower triangle', () => {
      // 6/10 of the slot width, centred, no base rectangle
      expect(column(point(), shortBar)).toBe(pathOf(p => {
        p.moveTo(14, 100); p.lineTo(20, 94); p.lineTo(26, 100); p.closePath();
      }));
    });

    it('keeps the full slot width for a short bar with capExpand', () => {
      expect(column(point({ expand: true }), shortBar)).toBe(pathOf(p => {
        p.moveTo(10, 100); p.lineTo(20, 94); p.lineTo(30, 100); p.closePath();
      }));
    });

    it('draws the inverted pentagon along the slot', () => {
      expect(column(point(), rightBar, true)).toBe(pathOf(p => {
        p.moveTo(150, 10); p.lineTo(160, 20); p.lineTo(150, 30); p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
      expect(column(point(), leftBar, true)).toBe(pathOf(p => {
        p.moveTo(50, 10); p.lineTo(40, 20); p.lineTo(50, 30); p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
    });

    it('shrinks a short inverted bar across the slot', () => {
      expect(column(point(), shortRightBar, true)).toBe(pathOf(p => {
        p.moveTo(100, 14); p.lineTo(106, 20); p.lineTo(100, 26); p.closePath();
      }));
    });
  });

  describe('curve cap', () => {
    const curve = (cap: object = {}) => seriesConfig({ cap: { type: 'curve', size: 10, expand: false, ...cap } });

    it('draws a quadratic cap whose control point mirrors the cap base across the value end', () => {
      expect(column(curve(), upBar)).toBe(pathOf(p => {
        p.moveTo(10, 50); p.quadraticCurveTo(20, 30, 30, 50); p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
    });

    it('shrinks a short bar to a narrower curve peaking at the value end', () => {
      expect(column(curve(), shortBar)).toBe(pathOf(p => {
        p.moveTo(14, 100); p.quadraticCurveTo(20, 88, 26, 100); p.closePath();
      }));
    });

    it('draws the inverted curve along the slot in both directions', () => {
      expect(column(curve(), rightBar, true)).toBe(pathOf(p => {
        p.moveTo(150, 10); p.quadraticCurveTo(170, 20, 150, 30); p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
      expect(column(curve(), leftBar, true)).toBe(pathOf(p => {
        p.moveTo(50, 10); p.quadraticCurveTo(30, 20, 50, 30); p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
    });
  });

  describe('round cap', () => {
    const round = (cap: object = {}) => seriesConfig({ cap: { type: 'round', size: 10, expand: false, ...cap } });

    it('rounds the value-end corners with a radius bounded by the slot width', () => {
      // radius = min(capSize 10, (20 - 4) / 2 = 8, extent 60) = 8
      expect(column(round(), upBar)).toBe(pathOf(p => {
        p.moveTo(10, 100); p.arcTo(10, 40, 18, 40, 8); p.lineTo(22, 40); p.arcTo(30, 40, 30, 100, 8);
        p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
    });

    it('rounds the far end of a below-base bar', () => {
      expect(column(round(), downBar)).toBe(pathOf(p => {
        p.moveTo(10, 100); p.arcTo(10, 160, 18, 160, 8); p.lineTo(22, 160); p.arcTo(30, 160, 30, 100, 8);
        p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
    });

    it('bounds the radius by the bar extent', () => {
      const stub = barPositions({ current: 96, prior: 100 });
      // radius = min(10, 8, 4) = 4; shorter than the cap, so like point/curve it closes straight across the base
      expect(column(round({ expand: true }), stub)).toBe(pathOf(p => {
        p.moveTo(10, 100); p.arcTo(10, 96, 14, 96, 4); p.lineTo(26, 96); p.arcTo(30, 96, 30, 100, 4); p.closePath();
      }));
    });

    it('falls back to a rect when the slot is too narrow to round', () => {
      const narrow = barPositions({ current: 40, prior: 100, categoryValueExtent: 4 });
      expect(column(round(), narrow)).toBe(pathOf(p => p.rect(10, 40, 4, 60)));
      const narrowInverted = barPositions({ current: 160, prior: 100, categoryValueExtent: 4 });
      expect(column(round(), narrowInverted, true)).toBe(pathOf(p => p.rect(100, 10, 60, 4)));
    });

    it('narrows a short bar without capExpand and closes across its own base', () => {
      // narrows by min(capSize - extent = 4, 8) = 4 → x 12–28, radius min(10, 8, 6) = 6
      expect(column(round(), shortBar)).toBe(pathOf(p => {
        p.moveTo(12, 100); p.arcTo(12, 94, 18, 94, 6); p.lineTo(22, 94); p.arcTo(28, 94, 28, 100, 6); p.closePath();
      }));
    });

    it('narrows a short inverted bar around the shifted slot edges', () => {
      // slot y 10–30 narrows to 12–28; the first arc corner sits on the shifted edge, not the slot edge
      expect(column(round(), shortRightBar, true)).toBe(pathOf(p => {
        p.moveTo(100, 12); p.arcTo(106, 12, 106, 18, 6); p.lineTo(106, 22); p.arcTo(106, 28, 100, 28, 6); p.closePath();
      }));
    });

    it('rounds the inverted bar along the slot', () => {
      expect(column(round(), rightBar, true)).toBe(pathOf(p => {
        p.moveTo(100, 10); p.arcTo(160, 10, 160, 18, 8); p.lineTo(160, 22); p.arcTo(160, 30, 100, 30, 8);
        p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
      expect(column(round(), leftBar, true)).toBe(pathOf(p => {
        p.moveTo(100, 10); p.arcTo(40, 10, 40, 18, 8); p.lineTo(40, 22); p.arcTo(40, 30, 100, 30, 8);
        p.lineTo(100, 30); p.lineTo(100, 10); p.closePath();
      }));
    });
  });

  describe('barMinExtent', () => {
    it('widens a zero-extent bar to the minimum, centred on its position', () => {
      const tick = barPositions({ current: 100, prior: 100 });
      expect(column(seriesConfig({ bar: { minExtent: 6 } }), tick)).toBe(pathOf(p => p.rect(10, 97, 20, 6)));
      expect(column(seriesConfig({ bar: { minExtent: 6 } }), tick, true)).toBe(pathOf(p => p.rect(97, 10, 6, 20)));
    });

    it('widens a bar shorter than the minimum around its centre', () => {
      const thin = barPositions({ current: 99, prior: 101 });
      expect(column(seriesConfig({ bar: { minExtent: 6 } }), thin)).toBe(pathOf(p => p.rect(10, 97, 20, 6)));
    });

    it('leaves bars at or above the minimum alone', () => {
      const tall = barPositions({ current: 90, prior: 100 });
      expect(column(seriesConfig({ bar: { minExtent: 6 } }), tall)).toBe(pathOf(p => p.rect(10, 90, 20, 10)));
      expect(column(seriesConfig({ bar: { minExtent: 0 } }), barPositions({ current: 100, prior: 100 })))
        .toBe(pathOf(p => p.rect(10, 100, 20, 0)));
    });

    it('feeds the widened extent to the cap so a thin bar still gets its full cap', () => {
      const thin = barPositions({ current: 99, prior: 101 });
      const config = seriesConfig({ bar: { minExtent: 10 }, cap: { type: 'point', size: 10, expand: false } });
      // 10px tall now equals the cap size: full pentagon, cap pointing up from 105 to 95
      expect(column(config, thin)).toBe(pathOf(p => {
        p.moveTo(10, 105); p.lineTo(20, 95); p.lineTo(30, 105); p.lineTo(30, 105); p.lineTo(10, 105); p.closePath();
      }));
      // a below-base bar widens the other way and the cap follows
      const thinBelow = barPositions({ current: 100, prior: 102, series: 102 });
      expect(column(config, thinBelow)).toBe(pathOf(p => {
        p.moveTo(10, 96); p.lineTo(20, 106); p.lineTo(30, 96); p.lineTo(30, 96); p.lineTo(10, 96); p.closePath();
      }));
    });

    it('widens a zero-extent bar in the positive direction with its cap pointing outward', () => {
      const tick = barPositions({ current: 100, prior: 100 });
      const config = seriesConfig({ bar: { minExtent: 10 }, cap: { type: 'point', size: 10, expand: false } });
      expect(column(config, tick)).toBe(pathOf(p => {
        p.moveTo(10, 105); p.lineTo(20, 95); p.lineTo(30, 105); p.lineTo(30, 105); p.lineTo(10, 105); p.closePath();
      }));
      expect(column(config, tick, true)).toBe(pathOf(p => {
        p.moveTo(95, 10); p.lineTo(105, 20); p.lineTo(95, 30); p.lineTo(95, 30); p.lineTo(95, 10); p.closePath();
      }));
    });
  });

  describe('stack outer caps', () => {
    const stackData = {
      filteredOuterPositiveSeriesIds: { st: ['S', 'S', 'T'] },
      filteredOuterNegativeSeriesIds: { st: [undefined, 'S', undefined] }
    } as unknown as StackData;
    const three = (raw: SeriesPositionData) => ({ ...raw, length: 3 }) as unknown as SeriesPositionData;
    const rect = pathOf(p => p.rect(10, 40, 20, 60));

    it('uses the stack outerCap settings when the series has no cap of its own', () => {
      const config = seriesConfig({ stack: 'st', seriesStackConfig: { outerCap: { type: 'point', size: 10, expand: false } } });
      const generator = getColumnGenerator(config, three(upBar), false, stackData);
      expect(generator(0)).toBe(pathOf(p => {
        p.moveTo(10, 50); p.lineTo(20, 40); p.lineTo(30, 50); p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      }));
      // outer on the negative side counts too
      expect(generator(1)).toBe(generator(0));
      // not outer at category 2
      expect(generator(2)).toBe(rect);
    });

    it('lets the series cap override the stack outer cap and, without cap.onlyStackOuter, caps every segment', () => {
      const config = seriesConfig({ stack: 'st', cap: { type: 'curve', size: 10, expand: false, onlyStackOuter: false },
        seriesStackConfig: { outerCap: { type: 'point', size: 4, expand: true } } });
      const generator = getColumnGenerator(config, three(upBar), false, stackData);
      const curveCap = pathOf(p => {
        p.moveTo(10, 50); p.quadraticCurveTo(20, 30, 30, 50); p.lineTo(30, 100); p.lineTo(10, 100); p.closePath();
      });
      expect(generator(0)).toBe(curveCap);
      expect(generator(2)).toBe(curveCap);
    });

    it('caps only outer segments with capOnlyStackOuter', () => {
      const config = seriesConfig({ stack: 'st', cap: { type: 'point', size: 10, expand: false, onlyStackOuter: true } });
      const generator = getColumnGenerator(config, three(upBar), false, stackData);
      expect(generator(0)).not.toBe(rect);
      expect(generator(2)).toBe(rect);
    });

    it('draws plain rects for a stacked series without caps anywhere', () => {
      const config = seriesConfig({ stack: 'st', seriesStackConfig: { outerCap: { type: null, size: 5, expand: true } } });
      expect(getColumnGenerator(config, three(upBar), false, stackData)(0)).toBe(rect);
    });
  });
});

// Regression: the stack outer-cap test indexed raw-category-indexed outer series ids with the
// compacted position index, so once a category was skipped ('connect') caps landed on the wrong segments.
describe('stacked bar outer caps with skipped categories', () => {
  const config = {
    id: 'B', stack: 'st', cap: { type: 'point', size: 4, expand: false, onlyStackOuter: true },
    seriesStackConfig: null, bar: { minExtent: 0 }
  } as unknown as EnhancedSeriesConfig;

  // three raw categories with the middle one skipped: compacted 0 → raw 0, compacted 1 → raw 2
  const seriesPositionData = {
    length: 2,
    skipped: true,
    skipCategoryIndexMap: { 0: 0, 1: 2 },
    categoryValueExtent: 10,
    getOffsetCategoryPosition: (_: null, i: number) => 20 * i,
    getSeriesExtent: () => 10,
    getSeriesPosition: () => 50,
    getPriorSeriesPosition: () => 80,
    getCurrentSeriesPosition: () => 50
  } as unknown as SeriesPositionData;

  // series B is the outer positive series only at raw category 2
  const stackData = {
    filteredOuterPositiveSeriesIds: { st: ['A', 'A', 'B'] },
    filteredOuterNegativeSeriesIds: { st: [undefined, undefined, undefined] }
  } as unknown as StackData;

  it('caps the segment that is outer at its raw category, not its compacted index', () => {
    const generator = getColumnGenerator(config, seriesPositionData, false, stackData);
    // compacted 1 is raw category 2, where B is the outer series — the point cap draws line segments
    expect(generator(1)).toContain('L');
    // compacted 0 is raw category 0, where A is outer — B draws a plain uncapped rect
    expect(generator(0)).not.toContain('L');
  });
});

describe('line and area generators', () => {
  const categories = [0, 100, 200];
  const series = [10, 20, 30];
  const priors = [50, 60, 70];
  function linePositions(defined: (i: number) => boolean = () => true): SeriesPositionData {
    return {
      length: 3,
      getDefined: (_: unknown, i: number) => defined(i),
      getCategoryPosition: (_: unknown, i: number) => categories[i],
      getSeriesPosition: (_: unknown, i: number) => series[i],
      getCurrentSeriesPosition: (_: unknown, i: number) => series[i],
      getPriorSeriesPosition: (_: unknown, i: number) => priors[i]
    } as unknown as SeriesPositionData;
  }
  const linear = seriesConfig();

  it('draws the series positions against the category positions', () => {
    expect(getLineGenerator(linear, linePositions(), false)()).toBe('M0,10L100,20L200,30');
    expect(getLineGenerator(linear, linePositions(), true)()).toBe('M10,0L20,100L30,200');
  });

  it('draws the range line through the prior positions', () => {
    expect(getRangeLineGenerator(linear, linePositions(), false)()).toBe('M0,50L100,60L200,70');
    expect(getRangeLineGenerator(linear, linePositions(), true)()).toBe('M50,0L60,100L70,200');
  });

  it('fills the area between the current and prior positions', () => {
    expect(getAreaGenerator(linear, linePositions(), false)()).toBe('M0,10L100,20L200,30L200,70L100,60L0,50Z');
    expect(getAreaGenerator(linear, linePositions(), true)()).toBe('M10,0L20,100L30,200L70,200L60,100L50,0Z');
  });

  it('breaks the path at undefined categories', () => {
    const gapped = linePositions(i => i !== 1);
    expect(getLineGenerator(linear, gapped, false)()).toBe('M0,10ZM200,30Z');
    expect(getRangeLineGenerator(linear, gapped, false)()).toBe('M0,50ZM200,70Z');
    expect(getAreaGenerator(linear, gapped, false)()).toBe('M0,10L0,50ZM200,30L200,70Z');
  });

  it('applies the configured curve and its parameter', () => {
    const wobble = { ...linePositions(), getSeriesPosition: (_: unknown, i: number) => [10, 40, 30][i] } as unknown as SeriesPositionData;
    const monotone = getLineGenerator(seriesConfig({ curve: { type: 'monotoneX' } }), wobble, false)()!;
    expect(monotone.startsWith('M0,10C')).toBe(true);
    const cardinal = getLineGenerator(seriesConfig({ curve: { type: 'cardinal' } }), wobble, false)();
    const slack = getLineGenerator(seriesConfig({ curve: { type: 'cardinal', param: 0 } }), wobble, false)();
    const taut = getLineGenerator(seriesConfig({ curve: { type: 'cardinal', param: 1 } }), wobble, false)();
    // d3's cardinal defaults to tension 0; tension 1 collapses the control points onto the line
    expect(cardinal).toBe(slack);
    expect(taut).not.toBe(slack);
    expect(taut).toBe('M0,10C0,10,100,40,100,40C100,40,200,30,200,30');
    // a parameter on a curve without one is ignored
    expect(getLineGenerator(seriesConfig({ curve: { type: 'step', param: 1 } }), wobble, false)())
      .toBe(getLineGenerator(seriesConfig({ curve: { type: 'step' } }), wobble, false)());
  });
});
