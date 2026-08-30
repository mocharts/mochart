// While loading: id-keyed handling keeps working, category-keyed is suppressed, whatever is open can be dismissed
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartEventPayload, ChartFocus, ChartSeriesClickPayload, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;
const rows = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }, { month: 'Mar', sales: 30 }];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 'S0', property: 'sales' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, extra: Partial<DefaultChartProps> = {}) {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...extra
  } as DefaultChartProps));
  return { container, handle };
}

const root = (container: Element) => container.querySelector(getChartRootCssSelector())!;

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('while loading, the chart still reports pointer movement', () => {
  it('fires enter and leave, so the two stay paired', () => {
    const enters: ChartEventPayload[] = [];
    const leaves: ChartEventPayload[] = [];
    const { container, handle } = mountChart(makeConfig(), {
      onChartMouseEnter: payload => { enters.push(payload); },
      onChartMouseLeave: payload => { leaves.push(payload); }
    });
    handle.update({ loading: true } as Partial<DefaultChartProps>);

    mouse(root(container), 'mouseenter', 100, 100);
    expect(enters.length).toBe(1);
    mouse(root(container), 'mousemove', -10, 100);
    expect(leaves.length).toBe(1);
  });

  it('notices the pointer leaving during a load', () => {
    // the leave the old code never saw: the "pointer is inside" flag latched on, turning every later entry into a move
    const enters: ChartEventPayload[] = [];
    const leaves: ChartEventPayload[] = [];
    const { container, handle } = mountChart(makeConfig(), {
      onChartMouseEnter: payload => { enters.push(payload); },
      onChartMouseLeave: payload => { leaves.push(payload); }
    });

    mouse(root(container), 'mouseenter', 100, 100);
    expect(enters.length).toBe(1);

    handle.update({ loading: true } as Partial<DefaultChartProps>);
    mouse(root(container), 'mousemove', -10, 100);
    expect(leaves.length).toBe(1);
    handle.update({ loading: false } as Partial<DefaultChartProps>);

    mouse(root(container), 'mouseenter', 100, 100);
    expect(enters.length).toBe(2);
  });
});

describe('while loading, the chart does not commit', () => {
  it('ignores clicks on the plot', () => {
    const clicks: ChartEventPayload[] = [];
    const { container, handle } = mountChart(makeConfig(), { onChartClick: payload => { clicks.push(payload); } });
    handle.update({ loading: true } as Partial<DefaultChartProps>);

    mouse(root(container), 'mouseenter', 100, 100);
    mouse(root(container), 'click', 100, 100);
    expect(clicks.length).toBe(0);
  });

  it('ignores series activation, which names a category that may not survive', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const { container, handle } = mountChart(makeConfig(), { onSeriesClick: payload => { clicks.push(payload); } });
    const shape = container.querySelector(getCssSelector('seriesBar') + ', ' + getCssSelector('seriesMarker') + ', ' + getCssSelector('seriesLine'))!;
    handle.update({ loading: true } as Partial<DefaultChartProps>);

    shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks.length).toBe(0);
  });

  it('does not open a follow-pointer tooltip on entry', () => {
    const { container, handle } = mountChart(makeConfig({ tooltip: { followPointer: true } }));
    handle.update({ loading: true } as Partial<DefaultChartProps>);

    mouse(root(container), 'mouseenter', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
  });

  it('leaves an already-open follow-pointer tooltip on its category', () => {
    const focuses: ChartFocus[] = [];
    const { container, handle } = mountChart(
      makeConfig({ tooltip: { visible: true, followPointer: true, applyFocus: true } }),
      { onFocus: focus => { focuses.push(focus); } }
    );
    const chartRoot = root(container);
    mouse(chartRoot, 'mouseenter', 100, 300);
    mouse(chartRoot, 'mousemove', 100, 300);
    const opened = container.querySelector(getCssSelector('tooltip'))!.textContent;

    handle.update({ loading: true } as Partial<DefaultChartProps>);
    focuses.length = 0;
    mouse(chartRoot, 'mousemove', 700, 300);
    // the move path commits a category position too, so it is gated like the enter path
    expect(container.querySelector(getCssSelector('tooltip'))!.textContent).toBe(opened);
    expect(focuses).toEqual([]);

    handle.update({ loading: false } as Partial<DefaultChartProps>);
    mouse(chartRoot, 'mousemove', 700, 300);
    expect(container.querySelector(getCssSelector('tooltip'))!.textContent).not.toBe(opened);
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: 2 });
  });
});

describe('while loading, ids keep working', () => {
  it('still focuses a value axis on hover', () => {
    const focuses: ChartFocus[] = [];
    const { container, handle } = mountChart(makeConfig(), { onFocus: focus => { focuses.push(focus); } });
    handle.update({ loading: true } as Partial<DefaultChartProps>);

    const axisInner = container.querySelector(getCssSelector('valueAxis') + ' > g')!;
    mouse(axisInner, 'pointerenter', 40, 300);
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedValueAxisId: 'VA0' });
  });
});
