/**
 * Config-only <defs> hot path: gradients and patterns are rebuilt only when the config (or its ids)
 * changes, never on tooltip tracking or data tweens, and always after the chart body is recreated.
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

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

// same months and domains: a value-only tween
const swappedRows = [
  { month: 'Jan', sales: 30, costs: 13 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 10, costs: 5 }
];

function makeConfig(stopColor = '#1f77b4', animate = false): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: animate },
    tooltip: { followPointer: true },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    linearGradients: [{
      id: 'fade', x1: 0, y1: 0, x2: 0, y2: 1,
      stops: [{ offset: 0, color: stopColor, opacity: 0.9 }, { offset: 1, color: stopColor, opacity: 0.05 }]
    }],
    patterns: [{ id: 'lines', type: 'lines' }],
    series: [
      { id: 'S0', property: 'sales', renderer: 'area', gradient: 'fade' },
      { id: 'S1', property: 'costs', renderer: 'bar', pattern: 'lines' }
    ]
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');
let Chart: typeof import('../../src/components/Chart').default;
let syncSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  installFakeFrameClock();
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
  ({ default: Chart } = await import('../../src/components/Chart'));
  syncSpy = vi.spyOn(Chart.prototype, 'syncConfigDefs');
});

function mountChart(config: MochartInputConfig): { container: Element; handle: ChartHandle<DefaultChartProps> } {
  syncSpy.mockClear();
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  runFrames();
  return { container, handle };
}

/** The chart svg's own <defs> — the tooltip icons keep separate defs inside the tooltip. */
function chartDefs(container: Element): Element {
  return container.querySelector(getChartRootCssSelector() + ' > svg > defs')!;
}

function gradientNode(container: Element): Element | null {
  return chartDefs(container).querySelector(':scope > linearGradient');
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

describe('config-only defs sync', () => {

  it('does not rebuild the defs while the tooltip tracks the pointer', () => {
    const { container } = mountChart(makeConfig());
    const root = container.querySelector(getChartRootCssSelector())!;
    const before = syncSpy.mock.calls.length;

    // hover opens the tooltip and each move re-syncs the chart with the tracked category
    mouse(root, 'mouseenter', 100, 100);
    const tooltip = container.querySelector(getCssSelector('tooltip'));
    expect(tooltip).not.toBeNull();
    for (let x = 120; x < 780; x += 60) {
      mouse(root, 'mousemove', x, 200);
    }
    expect(tooltip!.textContent).toContain('Mar');
    runFrames();

    expect(syncSpy).toHaveBeenCalledTimes(before);
  });

  it('does not rebuild the defs during a data tween', () => {
    const { container, handle } = mountChart(makeConfig('#1f77b4', true));
    const gradient = gradientNode(container);
    const before = syncSpy.mock.calls.length;

    handle.update({ data: swappedRows } as Partial<DefaultChartProps>);
    const frames = runFrames();

    expect(frames).toBeGreaterThan(0);
    expect(syncSpy).toHaveBeenCalledTimes(before);
    // the same gradient node stays mounted
    expect(gradientNode(container)).toBe(gradient);
  });

  it('rebuilds the defs when the config changes', () => {
    const { container, handle } = mountChart(makeConfig());
    const before = syncSpy.mock.calls.length;

    handle.update({ config: makeConfig('#ff0000') } as Partial<DefaultChartProps>);
    runFrames();

    expect(syncSpy).toHaveBeenCalledTimes(before + 1);
    const stop = gradientNode(container)!.querySelector('stop')!;
    expect(stop.getAttribute('stop-color')).toBe('#ff0000');
  });

  it('rebuilds the defs after the chart body is recreated under the same config', () => {
    const config = makeConfig();
    const { container, handle } = mountChart(config);
    const before = syncSpy.mock.calls.length;

    // no size tears the body down and replaces it with the no-size message
    handle.update({ width: 0 } as Partial<DefaultChartProps>);
    runFrames();
    expect(container.querySelector(getChartRootCssSelector() + ' > svg')).toBeNull();

    handle.update({ width: WIDTH } as Partial<DefaultChartProps>);
    runFrames();

    expect(syncSpy.mock.calls.length).toBeGreaterThan(before);
    expect(gradientNode(container)).not.toBeNull();
    expect(chartDefs(container).querySelector(':scope > pattern')).not.toBeNull();
  });
});
