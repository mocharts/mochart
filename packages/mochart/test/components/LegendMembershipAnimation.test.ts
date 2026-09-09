// Flipping showInLegend is not structural: the chart keeps animating from where it is, driven on a fake clock here
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from './helpers';
import { getCssClass, getIdCssClass } from '../../src/utils/ChartDom';

const seriesIdClass = (seriesId: string) => getIdCssClass('series', seriesId);
const seriesBarClass = getCssClass('seriesBar');
const legendItemClass = getCssClass('legendItem');

const WIDTH = 800;
const HEIGHT = 600;
const FRAME_MS = 16;

const ITEMS = [
  { label: 'Mon', sales: 10, costs: 4 },
  { label: 'Tue', sales: 20, costs: 8 }
];

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function makeConfig(costsShowInLegend: boolean) {
  return mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true },
    legend: { visible: true },
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'sales', property: 'sales', renderer: 'bar' },
      { id: 'costs', property: 'costs', renderer: 'bar', showInLegend: costsShowInLegend }
    ]
  } as never);
}

function mountChart(costsShowInLegend: boolean) {
  const container = mountContainer();
  const chart = mochart.createChart(container, {
    mochartConfig: makeConfig(costsShowInLegend),
    dataProvider: new mochart.ArrayOfObjectsDataProvider(ITEMS) as never,
    width: WIDTH,
    height: HEIGHT
  });
  return { container, chart };
}

function barHeights(container: Element, seriesId: string): number[] {
  const paths = container.querySelectorAll(`.${seriesIdClass(seriesId)} path[class*="${seriesBarClass}"]`);
  return Array.from(paths).map((path) => {
    const d = path.getAttribute('d') ?? '';
    const match = /^M(-?[\d.]+),(-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)/.exec(d);
    expect(match, `unexpected bar path: ${d}`).not.toBeNull();
    return Math.abs(Number(match![4]));
  });
}

function legendItemCount(container: Element): number {
  return container.querySelectorAll(`.${legendItemClass}`).length;
}

describe('showInLegend updates on a mounted animated chart', () => {
  it('adds the legend item without replaying the opening animation', () => {
    const { container, chart } = mountChart(false);
    runFrames();
    const settled = barHeights(container, 'sales');
    expect(settled.every(height => height > 0)).toBe(true);
    expect(legendItemCount(container)).toBe(1);

    chart.update({ mochartConfig: makeConfig(true) });
    // the frame straight after the flip is where a rebuild shows: the opening animation restarts and the bars collapse
    vi.advanceTimersByTime(FRAME_MS);
    expect(legendItemCount(container)).toBe(2);
    expect(barHeights(container, 'sales')).toEqual(settled);

    runFrames();
    expect(barHeights(container, 'sales')).toEqual(settled);
    chart.destroy();
  });

  it('removes the legend item without replaying the opening animation', () => {
    const { container, chart } = mountChart(true);
    runFrames();
    const settled = barHeights(container, 'sales');
    expect(legendItemCount(container)).toBe(2);

    chart.update({ mochartConfig: makeConfig(false) });
    vi.advanceTimersByTime(FRAME_MS);
    expect(legendItemCount(container)).toBe(1);
    expect(barHeights(container, 'sales')).toEqual(settled);

    runFrames();
    expect(barHeights(container, 'sales')).toEqual(settled);
    chart.destroy();
  });

  // legend sizes are measured a frame after the legend draws, so this frame has no entry for the series that just joined
  it('survives the frame straight after the flip, before the new item is measured', () => {
    const { container, chart } = mountChart(false);
    runFrames();

    chart.update({ mochartConfig: makeConfig(true) });
    vi.advanceTimersByTime(FRAME_MS);
    expect(legendItemCount(container)).toBe(2);
    expect(() => runFrames()).not.toThrow();
    expect(legendItemCount(container)).toBe(2);
    chart.destroy();
  });
});
