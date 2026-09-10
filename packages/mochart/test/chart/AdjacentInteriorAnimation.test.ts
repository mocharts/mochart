/**
 * animateBaseFromAdjacent for values that enter or leave at an existing
 * category: an interior line point animates from or onto the line between its
 * neighbours, and a leading or trailing one onto the one neighbour it has, so
 * the series never spikes to the axis base and its removal at the end of the
 * value phase is invisible.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer } from '../components/helpers';
import { getCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';
import type { DataObject } from '../../src/types/data';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

/** The line path's points, from its M/L commands. */
function linePoints(container: Element): { x: number; y: number }[] {
  const path = container.querySelector(getIdCssSelector('series', 's') + ' path' + getCssSelector('seriesLine'))!;
  const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i]!, y: numbers[i + 1]! });
  }
  return points;
}

function mountLine(rows: DataObject[]) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
    valueAxes: [{ id: 'va', min: 0, max: 100 }],
    series: [{ id: 's', property: 'v', axis: 'va', renderer: 'line' }]
  });
  const container = mountContainer();
  const props = { mochartConfig, width: 400, height: 200 };
  const chart = createChart(container, { ...props, dataProvider: new ArrayOfObjectsDataProvider(rows) });
  runFrames();
  return {
    container,
    update: (nextRows: DataObject[]) => chart.update({ ...props, dataProvider: new ArrayOfObjectsDataProvider(nextRows) }),
    destroy: () => chart.destroy()
  };
}

/** The line's points on every frame of the tween that still shows `count` points. */
function tweenPoints(container: Element, count: number): { x: number; y: number }[][] {
  const frames: { x: number; y: number }[][] = [];
  for (let frame = 0; frame < 80; frame++) {
    const points = linePoints(container);
    if (points.length === count) {
      frames.push(points);
    }
    advanceFrames(1);
  }
  return frames;
}

describe('an interior line point that leaves', () => {
  it('collapses onto the segment between its neighbours instead of the base', () => {
    const { container, update, destroy } = mountLine([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    expect(linePoints(container)).toHaveLength(3);

    // B leaves. The old behaviour animated it to the base (0), a spike below both neighbours.
    update([{ label: 'A', v: 60 }, { label: 'C', v: 40 }]);
    const frames = tweenPoints(container, 3);
    expect(frames.length).toBeGreaterThan(0);
    for (const [a, b, c] of frames) {
      // B starts above both neighbours (80 over 60 and 40) and must end on the
      // segment between them; it may never pass below them toward the base.
      expect(b!.y).toBeLessThanOrEqual(Math.max(a!.y, c!.y) + 1);
    }
    runFrames();
    expect(linePoints(container)).toHaveLength(2);
    destroy();
  });
});

describe('an interior line point that enters', () => {
  it('rises from the segment between its neighbours instead of the base', () => {
    const { container, update, destroy } = mountLine([{ label: 'A', v: 60 }, { label: 'C', v: 40 }]);
    update([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const frames = tweenPoints(container, 3);
    expect(frames.length).toBeGreaterThan(0);
    for (const [a, b, c] of frames) {
      expect(b!.y).toBeLessThanOrEqual(Math.max(a!.y, c!.y) + 1);
    }
    runFrames();
    expect(linePoints(container)).toHaveLength(3);
    destroy();
  });
});

describe('a leading value that goes missing at a category that stays', () => {
  it('collapses onto its one neighbour instead of the base', () => {
    const { container, update, destroy } = mountLine([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const [, b] = linePoints(container);
    update([{ label: 'A' }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const frames = tweenPoints(container, 3);
    expect(frames.length).toBeGreaterThan(0);
    for (const [a] of frames) {
      // A starts below B (60 under 80) and moves up to B's height, never down toward the base
      expect(a!.y).toBeGreaterThanOrEqual(b!.y - 1);
      expect(a!.y).toBeLessThanOrEqual(frames[0]![0]!.y + 1);
    }
    runFrames();
    expect(linePoints(container)).toHaveLength(2);
    destroy();
  });

  it('is the same move a leading category makes when it is removed', () => {
    const blanked = mountLine([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    blanked.update([{ label: 'A' }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const blankedFrames = tweenPoints(blanked.container, 3);
    blanked.destroy();

    const removed = mountLine([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    removed.update([{ label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const removedFrames = tweenPoints(removed.container, 3);
    removed.destroy();

    // the value phase runs the same way; only the category phase that follows differs
    expect(blankedFrames.length).toBeGreaterThan(0);
    expect(blankedFrames.map(([a]) => a!.y)).toEqual(removedFrames.slice(0, blankedFrames.length).map(([a]) => a!.y));
  });
});

describe('a trailing value that appears at a category that stays', () => {
  it('rises from its one neighbour instead of the base', () => {
    const { container, update, destroy } = mountLine([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C' }]);
    const [, b] = linePoints(container);
    update([{ label: 'A', v: 60 }, { label: 'B', v: 80 }, { label: 'C', v: 40 }]);
    const frames = tweenPoints(container, 3);
    expect(frames.length).toBeGreaterThan(0);
    for (const [, , c] of frames) {
      // C ends below B (40 under 80) and starts at B's height, never at the base below both
      expect(c!.y).toBeGreaterThanOrEqual(b!.y - 1);
      expect(c!.y).toBeLessThanOrEqual(frames[frames.length - 1]![2]!.y + 1);
    }
    destroy();
  });
});
