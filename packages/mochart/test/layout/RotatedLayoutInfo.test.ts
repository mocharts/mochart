import { describe, it, expect } from 'vitest';
import { getRotatedBounds, getRotatedZeroBounds } from '../../src/layout/RotatedLayoutInfo';
import { ANCHOR_START, ANCHOR_MIDDLE, ANCHOR_END } from '../../src/config/core/constants';
import type { Anchor } from '../../src/config/core/constants';
import type { Bounds, Size } from '../../src/types/geometry';

const ANCHORS: Anchor[] = [ANCHOR_START, ANCHOR_MIDDLE, ANCHOR_END];
const S = Math.SQRT1_2; // sin 45° = cos 45°

// independent oracle: rotate the four unrotated corners about the origin and take their extent
function expectedBounds(bounds: Size, angle: number, anchor: Anchor): Bounds {
  const radians = angle * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const left = anchor === ANCHOR_START ? 0 : anchor === ANCHOR_MIDDLE ? -bounds.width / 2 : -bounds.width;
  const xs = [left, left + bounds.width];
  const ys = [-bounds.height / 2, bounds.height / 2];
  const rotated = xs.flatMap(x => ys.map(y => ({ x: x * cos - y * sin, y: x * sin + y * cos })));
  const minX = Math.min(...rotated.map(p => p.x));
  const maxX = Math.max(...rotated.map(p => p.x));
  const minY = Math.min(...rotated.map(p => p.y));
  const maxY = Math.max(...rotated.map(p => p.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function expectBoundsClose(actual: Bounds, expected: Bounds): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.width).toBeCloseTo(expected.width, 10);
  expect(actual.height).toBeCloseTo(expected.height, 10);
}

describe('getRotatedZeroBounds', () => {
  const size = { width: 100, height: 20 };

  it('keeps the size and centers vertically on the anchor', () => {
    for (const anchor of ANCHORS) {
      const bounds = getRotatedZeroBounds(size, anchor);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(20);
      expect(bounds.y).toBe(-10);
    }
  });

  it('places x per anchor: start at 0, middle centered, end fully left', () => {
    expect(getRotatedZeroBounds(size, ANCHOR_START).x).toBe(0);
    expect(getRotatedZeroBounds(size, ANCHOR_MIDDLE).x).toBe(-50);
    expect(getRotatedZeroBounds(size, ANCHOR_END).x).toBe(-100);
  });

  it('matches getRotatedBounds at angle 0', () => {
    for (const anchor of ANCHORS) {
      expectBoundsClose(getRotatedBounds(size, 0, anchor), getRotatedZeroBounds(size, anchor));
    }
  });

  it('returns all zeros for an empty size', () => {
    const bounds = getRotatedZeroBounds({ width: 0, height: 0 }, ANCHOR_END);
    expect([bounds.x, bounds.y, bounds.width, bounds.height].map(Math.abs)).toEqual([0, 0, 0, 0]);
  });
});

describe('getRotatedBounds', () => {
  const size = { width: 100, height: 20 };

  it('swaps width and height at ±90°', () => {
    for (const anchor of ANCHORS) {
      for (const angle of [90, -90]) {
        const bounds = getRotatedBounds(size, angle, anchor);
        expect(bounds.width).toBeCloseTo(20, 10);
        expect(bounds.height).toBeCloseTo(100, 10);
      }
    }
  });

  it('start anchor at 90° hangs the label below the anchor, centered horizontally', () => {
    expectBoundsClose(getRotatedBounds(size, 90, ANCHOR_START), { x: -10, y: 0, width: 20, height: 100 });
  });

  it('start anchor at -90° stands the label above the anchor', () => {
    expectBoundsClose(getRotatedBounds(size, -90, ANCHOR_START), { x: -10, y: -100, width: 20, height: 100 });
  });

  it('end anchor at 90° stands the label above the anchor', () => {
    expectBoundsClose(getRotatedBounds(size, 90, ANCHOR_END), { x: -10, y: -100, width: 20, height: 100 });
  });

  it('end anchor at -90° hangs the label below the anchor', () => {
    expectBoundsClose(getRotatedBounds(size, -90, ANCHOR_END), { x: -10, y: 0, width: 20, height: 100 });
  });

  it('middle anchor at ±90° is centered on the anchor', () => {
    for (const angle of [90, -90]) {
      expectBoundsClose(getRotatedBounds(size, angle, ANCHOR_MIDDLE), { x: -10, y: -50, width: 20, height: 100 });
    }
  });

  it('end anchor at -45° (the usual category tick rotation) runs down-left from the anchor', () => {
    // corners rotate onto multiples of 1/√2; the top-right corner sits 10/√2 above the anchor
    expectBoundsClose(getRotatedBounds(size, -45, ANCHOR_END), { x: -110 * S, y: -10 * S, width: 120 * S, height: 120 * S });
  });

  it('start anchor at 45° runs down-right from the anchor', () => {
    expectBoundsClose(getRotatedBounds(size, 45, ANCHOR_START), { x: -10 * S, y: -10 * S, width: 120 * S, height: 120 * S });
  });

  it('middle anchor bounds are always centered on the origin', () => {
    for (const angle of [-170, -135, -60, -30, 15, 45, 75, 120, 180]) {
      const bounds = getRotatedBounds(size, angle, ANCHOR_MIDDLE);
      expect(bounds.x).toBeCloseTo(-bounds.width / 2, 10);
      expect(bounds.y).toBeCloseTo(-bounds.height / 2, 10);
    }
  });

  it('start and end anchors mirror through the origin', () => {
    for (const angle of [-135, -45, -10, 30, 60, 150]) {
      const start = getRotatedBounds(size, angle, ANCHOR_START);
      const end = getRotatedBounds(size, angle, ANCHOR_END);
      expect(end.width).toBeCloseTo(start.width, 10);
      expect(end.height).toBeCloseTo(start.height, 10);
      expect(end.x).toBeCloseTo(-(start.x + start.width), 10);
      expect(end.y).toBeCloseTo(-(start.y + start.height), 10);
    }
  });

  it('is the tight box around the four rotated corners for every anchor and angle', () => {
    const sizes: Size[] = [size, { width: 20, height: 100 }, { width: 37, height: 13 }, { width: 0, height: 0 }];
    for (const s of sizes) {
      for (const anchor of ANCHORS) {
        for (let angle = -180; angle <= 180; angle += 15) {
          expectBoundsClose(getRotatedBounds(s, angle, anchor), expectedBounds(s, angle, anchor));
        }
      }
    }
  });

  it('is unchanged by full turns', () => {
    for (const anchor of ANCHORS) {
      expectBoundsClose(getRotatedBounds(size, 30 + 360, anchor), getRotatedBounds(size, 30, anchor));
      expectBoundsClose(getRotatedBounds(size, -45 - 360, anchor), getRotatedBounds(size, -45, anchor));
    }
  });
});
