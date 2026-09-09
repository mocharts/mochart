/**
 * Interactions on the animated chart (animate: true): tooltip focus tweens and data tweens
 * driven deterministically on a fake clock (same technique as the golden suite).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { installFakeFrameClock, runFrames, mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssClass, getIdCssClass, getCssSelector, getCssClassMatchSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;
const FRAME_MS = 16;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: true },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  installFakeFrameClock();
  mochart = await import('../../src');
});

function mountChart(config: MochartInputConfig, callbacks: Partial<DefaultChartProps> = {}, data: readonly unknown[] = rows) {
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return { container, handle };
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

function chartRoot(container: Element): Element {
  const root = container.querySelector(getChartRootCssSelector());
  expect(root).not.toBeNull();
  return root!;
}

describe('animated chart interactions', () => {
  it('settles the initial value animation and renders series shapes', () => {
    const { container } = mountChart(makeConfig());
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelectorAll(getCssClassMatchSelector(getCssClass('series'))).length).toBeGreaterThan(0);
  });

  it('animates focus when the tooltip opens and settles', () => {
    const { container } = mountChart(makeConfig());
    runFrames();
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
    // the focus tween queued frames; run them to completion
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    // closing animates focus back out
    mouse(root, 'click', 100, 100);
    runFrames();
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('interrupts a running focus animation with a new focus target', () => {
    const { container } = mountChart(makeConfig({ tooltip: { followPointer: true } }));
    runFrames();
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    // advance only a few frames so the focus tween is mid-flight, then refocus
    vi.advanceTimersByTime(FRAME_MS * 3);
    mouse(root, 'mousemove', 790, 100);
    runFrames();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
  });

  it('animates a data update and settles on the new values', () => {
    const { container, handle } = mountChart(makeConfig());
    runFrames();

    const nextRows = [
      { month: 'Jan', sales: 40 },
      { month: 'Feb', sales: 10 },
      { month: 'Mar', sales: 25 },
      { month: 'Apr', sales: 5 }
    ];
    handle.update({ data: nextRows } as Partial<DefaultChartProps>);
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    // the new category made it into the rendered chart
    expect(chartRoot(container).innerHTML).toContain('Apr');
  });

  it('animates series filtering from the legend', () => {
    const { container } = mountChart(makeConfig({
      legend: { visible: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    }), {}, rows.map(row => ({ ...row, costs: row.sales / 2 })));
    runFrames();

    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')))!;
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);

    // unfilter and settle again
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies a controlled series focus set before the first animated frame', () => {
    const config = () => makeConfig({ series: [{ property: 'sales' }, { property: 'costs' }] });
    const data = rows.map(row => ({ ...row, costs: row.sales / 2 }));
    const lineOpacity = (container: Element, seriesId: string) =>
      container.querySelector(getCssClassMatchSelector(getIdCssClass('series', seriesId)) + ' ' + getCssSelector('seriesLine'))!.getAttribute('stroke-opacity');

    // reference: the same controlled focus applied after the chart settled
    const reference = mountChart(config(), {}, data);
    runFrames();
    reference.handle.update({ focusedSeriesId: 'S1' } as Partial<DefaultChartProps>);
    runFrames();

    // regression: the update lands before any frame, while chartData is null
    const early = mountChart(config(), {}, data);
    early.handle.update({ focusedSeriesId: 'S1' } as Partial<DefaultChartProps>);
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);

    expect(lineOpacity(early.container, 'S1')).toBe('1');
    expect(lineOpacity(early.container, 'S1')).toBe(lineOpacity(reference.container, 'S1'));
    expect(lineOpacity(early.container, 'S0')).toBe(lineOpacity(reference.container, 'S0'));
  });

  it('interrupts a running data animation with another data update', () => {
    const { handle } = mountChart(makeConfig());
    runFrames();

    handle.update({ data: rows.map(row => ({ ...row, sales: row.sales * 2 })) } as Partial<DefaultChartProps>);
    // mid-flight, push another update
    vi.advanceTimersByTime(FRAME_MS * 3);
    handle.update({ data: rows.map(row => ({ ...row, sales: row.sales * 3 })) } as Partial<DefaultChartProps>);
    const frames = runFrames();
    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
