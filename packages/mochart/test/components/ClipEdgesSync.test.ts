/**
 * Clipped-edges hot path: the clip indicator's edges are recomputed only when the config or data
 * changes, and keep their identity while the clipping itself is unchanged, so the indicator skips
 * tooltip tracking and same-clipping data updates.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installFakeFrameClock, runFrames, mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { installSvgMeasurementShims } from './svgShims';
import type { ChartHandle } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

// value axis max 10: the second row overflows the top edge
const overflowing = [{ c: 'a', v: 5 }, { c: 'b', v: 50 }];
const overflowingMore = [{ c: 'a', v: 6 }, { c: 'b', v: 70 }];
const contained = [{ c: 'a', v: 5 }, { c: 'b', v: 8 }];

function makeConfig(): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    tooltip: { followPointer: true },
    categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
    valueAxes: [{ min: 0, max: 10 }],
    series: [{ property: 'v', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');
let syncSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  installFakeFrameClock();
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
  const { default: ClipIndicator } = await import('../../src/components/ClipIndicator');
  syncSpy = vi.spyOn(ClipIndicator.prototype, 'sync');
});

function mountChart(data: readonly unknown[] = overflowing): { container: Element; handle: ChartHandle<DefaultChartProps> } {
  syncSpy.mockClear();
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config: makeConfig(), data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  runFrames();
  return { container, handle };
}

function bandEdges(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('clipIndicator') + ' > g')]
    .map(group => (group.getAttribute('class') ?? '').replace(/^.*band-/, ''));
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

describe('clipped edges sync', () => {
  it('does not re-sync the clip indicator while the tooltip tracks the pointer', () => {
    const { container } = mountChart();
    expect(bandEdges(container)).toEqual(['top']);
    const root = container.querySelector(getChartRootCssSelector())!;
    const before = syncSpy.mock.calls.length;

    mouse(root, 'mouseenter', 100, 100);
    const tooltip = container.querySelector(getCssSelector('tooltip'));
    expect(tooltip).not.toBeNull();
    for (let x = 120; x < 780; x += 60) {
      mouse(root, 'mousemove', x, 200);
    }
    expect(tooltip!.textContent).toContain('b');
    runFrames();

    expect(syncSpy).toHaveBeenCalledTimes(before);
  });

  it('does not re-sync the clip indicator when new data clips the same edges', () => {
    const { container, handle } = mountChart();
    const before = syncSpy.mock.calls.length;

    handle.update({ data: overflowingMore } as Partial<DefaultChartProps>);
    runFrames();

    expect(bandEdges(container)).toEqual(['top']);
    expect(syncSpy).toHaveBeenCalledTimes(before);
  });

  it('re-syncs the clip indicator when new data changes the clipping', () => {
    const { container, handle } = mountChart();
    const before = syncSpy.mock.calls.length;

    handle.update({ data: contained } as Partial<DefaultChartProps>);
    runFrames();
    expect(bandEdges(container)).toEqual([]);
    expect(syncSpy.mock.calls.length).toBeGreaterThan(before);

    const after = syncSpy.mock.calls.length;
    handle.update({ data: overflowing } as Partial<DefaultChartProps>);
    runFrames();
    expect(bandEdges(container)).toEqual(['top']);
    expect(syncSpy.mock.calls.length).toBeGreaterThan(after);
  });
});
