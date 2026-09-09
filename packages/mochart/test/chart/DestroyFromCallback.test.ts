/**
 * destroy() raised from inside a chart callback: the chart goes on to raise focus of its own after
 * the host callback returns, which must not reach the host or restart tweens on the disposed source.
 */
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { getChartRootCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

const WIDTH = 800;
const HEIGHT = 600;

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
});

const data = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function mountChart(props: Record<string, unknown>) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 'sales', property: 'sales', renderer: 'bar' }]
  });
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width: WIDTH, height: HEIGHT,
    ...props
  } as never);
  runFrames();
  return { chart, container };
}

function clickPlot(container: HTMLElement): void {
  const root = container.querySelector(getChartRootCssSelector())!;
  root.dispatchEvent(new MouseEvent('click', { clientX: WIDTH / 2, clientY: HEIGHT / 2, bubbles: true }));
}

describe('destroy() from a chart callback', () => {
  it('raises no focus and schedules no frames after a plot click destroys the chart', () => {
    const onFocus = vi.fn();
    const mounted = mountChart({ onFocus, onChartClick: () => mounted.chart.destroy() });
    onFocus.mockClear();

    clickPlot(mounted.container);

    expect(onFocus).not.toHaveBeenCalled();
    // the focus tween the click would have started must not run on the disposed source
    expect(runFrames()).toBe(0);
  });

  it('keeps raising focus for a click that does not destroy the chart', () => {
    const onFocus = vi.fn();
    const { chart, container } = mountChart({ onFocus, onChartClick: () => {} });
    onFocus.mockClear();

    clickPlot(container);
    runFrames();

    expect(onFocus).toHaveBeenCalled();
    chart.destroy();
  });
});

// Regression: the root element was removed with an unguarded removeChild, so a host that cleared the
// mount point itself got a NotFoundError out of destroy() and the rest of the teardown was skipped
describe('destroy() after the host emptied the container', () => {
  it('tears down without throwing', () => {
    const { chart, container } = mountChart({});
    container.replaceChildren();

    expect(() => chart.destroy()).not.toThrow();
    expect(container.childNodes.length).toBe(0);
  });

  it('still removes the chart when the container is untouched', () => {
    const { chart, container } = mountChart({});
    expect(container.childNodes.length).toBeGreaterThan(0);

    chart.destroy();
    expect(container.childNodes.length).toBe(0);
  });
});

// a debounced refresh that fires after unmount used to reach the host provider's refresh() hook,
// for a re-read the destroyed controller then skipped
describe('handle methods after destroy()', () => {
  it('does not call the provider refresh hook from a late refresh()', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales', renderer: 'bar' }]
    });
    let refreshes = 0;
    const provider = new ArrayOfObjectsDataProvider(data) as unknown as { refresh(): void };
    provider.refresh = () => { refreshes++; };
    const chart = createChart(mountContainer(), {
      mochartConfig, dataProvider: provider, width: WIDTH, height: HEIGHT
    } as never);
    runFrames();

    chart.refresh();
    expect(refreshes).toBe(1);

    chart.destroy();
    chart.refresh();
    expect(refreshes).toBe(1);
  });

  it('is safe to destroy twice and to update or replace afterwards', () => {
    const { chart } = mountChart({});
    chart.destroy();
    expect(() => {
      chart.destroy();
      chart.update({ width: 400 } as never);
      chart.replace({ width: 400 } as never);
      chart.refresh();
    }).not.toThrow();
  });
});
