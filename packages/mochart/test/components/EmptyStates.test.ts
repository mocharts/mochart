// The "No Data" and "No Series" states and the six ChartFactories props, publicly overridable and previously untested
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createChart, createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import type { ChartFactoryContext, DefaultChartProps, ManagedChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(props: Partial<DefaultChartProps> = {}, config = makeConfig(), data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT, ...props
  } as DefaultChartProps));
  return container;
}

function marker(text: string) {
  return () => {
    const node = document.createElement('div');
    node.className = 'factory-marker';
    node.textContent = text;
    return node;
  };
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('no-data state', () => {
  it('renders the default message for a zero-row provider', () => {
    const container = mountChart({}, makeConfig(), []);
    const noData = container.querySelector(getCssSelector('noData'));
    expect(noData).not.toBeNull();
    expect(noData!.textContent).toContain('No Data');
  });

  it('positions the overlay inside the chart rather than at the origin', () => {
    const container = mountChart({}, makeConfig(), []);
    const overlay = container.querySelector<HTMLElement>(getCssSelector('noData'))!;

    // absolutely positioned from seriesLayoutInfo: a layout regression would park it at 0,0 and nothing would notice
    const left = Number.parseFloat(overlay.style.left);
    const top = Number.parseFloat(overlay.style.top);
    const width = Number.parseFloat(overlay.style.width);
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(width).toBeGreaterThan(0);
    expect(left + width).toBeLessThanOrEqual(WIDTH);
  });

  it('goes away when rows arrive', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: [], width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    expect(container.querySelector(getCssSelector('noData'))).not.toBeNull();

    handle.update({ config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps);
    expect(container.querySelector(getCssSelector('noData'))).toBeNull();
  });

  // emptying drops the derived axis data, so refilling rebuilds it the way a mount does
  // rather than updating the data built over no categories
  it('draws the same after emptying and refilling as it does freshly mounted', () => {
    const later = [{ month: 'Mar', sales: 30 }, { month: 'Apr', sales: 5 }, { month: 'May', sales: 12 }];
    const ticks = (element: Element) =>
      Array.from(element.querySelectorAll(getCssSelector('axisTickLabel') + ' text')).map(label => label.textContent);

    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    handle.update({ config: makeConfig(), data: [], width: WIDTH, height: HEIGHT } as DefaultChartProps);
    handle.update({ config: makeConfig(), data: later, width: WIDTH, height: HEIGHT } as DefaultChartProps);

    expect(ticks(container)).toEqual(ticks(mountChart({}, makeConfig(), later)));
  });

  // the empty plot runs both axis passes, so parts flagged *Front still draw
  it('draws front-flagged axis parts while there is no data', () => {
    const config = makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Cat', front: true } },
      valueAxes: [{ title: { text: 'Val', front: true }, axisLine: { front: true } }]
    });
    const empty = mountChart({}, config, []);
    const populated = mountChart({}, config, rows);
    for (const key of ['axisTitle', 'axisLine'] as const) {
      expect(empty.querySelectorAll(getCssSelector(key)).length).toBe(populated.querySelectorAll(getCssSelector(key)).length);
    }
    expect(empty.querySelectorAll(getCssSelector('axisTitle')).length).toBe(2);
    expect(empty.querySelectorAll(getCssSelector('axisLine')).length).toBe(2);
  });

  // the layout gives an axis hidden with its filtered series no band while loading, so the empty plot must not draw it there
  it('leaves an axis hidden when all its series are filtered out of the loading plot', () => {
    const config = makeConfig({
      valueAxes: [{ id: 'A', title: { text: 'Hidden' }, visibleWhenAllFiltered: false }, { id: 'B', title: { text: 'Shown' } }],
      series: [{ property: 'sales', axis: 'B' }]
    });
    const loading = mountChart({ loading: true }, config, []);
    expect(loading.querySelector(getIdCssSelector('valueAxis', 'A'))).toBeNull();
    expect(loading.querySelector(getIdCssSelector('valueAxis', 'B'))).not.toBeNull();
    expect(loading.textContent).not.toContain('Hidden');
    expect(loading.textContent).toContain('Shown');
  });
});

describe('no-series state', () => {
  it('renders the default message when the config declares no series', () => {
    const container = mountChart({}, makeConfig({ series: [] }));
    const noSeries = container.querySelector(getCssSelector('noSeries'));
    expect(noSeries).not.toBeNull();
    expect(noSeries!.textContent).toContain('No Series');
  });

  it('draws no series groups in that state', () => {
    const container = mountChart({}, makeConfig({ series: [] }));
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(0);
  });

  // Regression: the layout places no legend for zero series, but Legend/LegendClip were gated only on
  // legend.visible and destructured the missing layout info while rendering.
  it('renders the message with a visible legend and no series instead of throwing', () => {
    const container = mountChart({}, makeConfig({ series: [], legend: { visible: true } }));
    expect(container.querySelector(getCssSelector('noSeries'))).not.toBeNull();
    expect(container.querySelector(getCssSelector('legend'))).toBeNull();
  });
});

describe('ChartFactories overrides', () => {
  it('uses getNoDataComponent', () => {
    const container = mountChart({ getNoDataComponent: marker('custom empty') }, makeConfig(), []);
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom empty');
  });

  it('uses getNoSeriesComponent', () => {
    const container = mountChart({ getNoSeriesComponent: marker('custom no series') }, makeConfig({ series: [] }));
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom no series');
  });

  it('uses getLoadingComponent', () => {
    const container = mountChart({ loading: true, getLoadingComponent: marker('custom loading') });
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom loading');
  });

  // Regression: with no categories the no-data slot fell through to the loading factory as well, so the
  // overlay and the placeholder were mounted on top of each other and a custom factory ran twice
  it('renders the loading content once, in the loading overlay only', () => {
    let calls = 0;
    const loadingFactory = () => { calls++; return marker('custom loading')(); };
    const container = mountChart({ loading: true, getLoadingComponent: loadingFactory }, makeConfig(), []);

    expect(calls).toBe(1);
    expect(container.querySelectorAll('.factory-marker').length).toBe(1);
    expect(container.querySelector(getCssSelector('loading'))).not.toBeNull();
    expect(container.querySelector(getCssSelector('noData'))).toBeNull();
  });

  it('uses getErrorComponent', () => {
    const container = mountChart({ error: 'boom', getErrorComponent: marker('custom error') });
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom error');
  });

  it('uses getNoSizeComponent', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: rows, width: 0, height: 0,
      getNoSizeComponent: marker('custom no size')
    } as DefaultChartProps));
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom no size');
  });

  it('uses getConfigErrorComponent, and hands it the invalid config', () => {
    const seen: ChartFactoryContext[] = [];
    const container = mountChart({
      getConfigErrorComponent: (context: ChartFactoryContext) => {
        seen.push(context);
        return marker('custom config error')();
      }
    }, makeConfig({ series: [{ property: 'sales', renderer: 'nope' }] }));
    expect(container.querySelector('.factory-marker')!.textContent).toBe('custom config error');
    // the config as supplied, so the factory can report on what failed
    expect(seen[0].mochartConfig).not.toBeNull();
  });
});

// Regression: context members arrived per code path, so a factory could read undefined; every factory now gets all six
describe('the state factory context', () => {
  const contextKeys = ['dataProvider', 'error', 'hasData', 'height', 'mochartConfig', 'width'];

  function capture(seen: ChartFactoryContext[]) {
    return (context: ChartFactoryContext) => {
      seen.push(context);
      return marker('captured')();
    };
  }

  /** Content placed inside a laid-out chart is sized to the plot area, which axes make smaller. */
  function expectPlotBox(context: ChartFactoryContext): void {
    expect(context.width).toBeGreaterThan(0);
    expect(context.width).toBeLessThan(WIDTH);
    expect(context.height).toBeGreaterThan(0);
    expect(context.height).toBeLessThan(HEIGHT);
  }

  function mountManaged(extra: Partial<ManagedChartProps>): void {
    const container = mountContainer();
    trackHandle(createChart(container, {
      mochartConfig: null, dataProvider: null, width: WIDTH, height: HEIGHT, ...extra
    } as unknown as ManagedChartProps) as unknown as ChartHandle<DefaultChartProps>);
  }

  it('reaches getNoSizeComponent whole, sized to the chart', () => {
    const seen: ChartFactoryContext[] = [];
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: rows, width: 0, height: 0, getNoSizeComponent: capture(seen)
    } as DefaultChartProps));

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expect(seen[0].width).toBe(0);
    expect(seen[0].height).toBe(0);
    expect(seen[0].mochartConfig).not.toBeNull();
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBeUndefined();
    expect(seen[0].hasData).toBe(true);
  });

  it('reaches getConfigErrorComponent whole, with the invalid config', () => {
    const seen: ChartFactoryContext[] = [];
    mountChart({ getConfigErrorComponent: capture(seen) }, makeConfig({ series: [{ property: 'sales', renderer: 'nope' }] }));

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expect(seen[0].width).toBe(WIDTH);
    expect(seen[0].height).toBe(HEIGHT);
    expect(seen[0].mochartConfig!.validation.valid).toBe(false);
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBeUndefined();
    // an invalid config commits no chart data
    expect(seen[0].hasData).toBe(false);
  });

  it('reaches getNoSeriesComponent whole, sized to the plot area', () => {
    const seen: ChartFactoryContext[] = [];
    mountChart({ getNoSeriesComponent: capture(seen) }, makeConfig({ series: [] }));

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expectPlotBox(seen[0]);
    expect(seen[0].mochartConfig).not.toBeNull();
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBeUndefined();
    expect(seen[0].hasData).toBe(true);
  });

  it('reaches getNoDataComponent whole, with hasData false', () => {
    const seen: ChartFactoryContext[] = [];
    mountChart({ getNoDataComponent: capture(seen) }, makeConfig(), []);

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expectPlotBox(seen[0]);
    expect(seen[0].mochartConfig).not.toBeNull();
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBeUndefined();
    expect(seen[0].hasData).toBe(false);
  });

  it('reaches getLoadingComponent whole in the laid-out chart', () => {
    const seen: ChartFactoryContext[] = [];
    mountChart({ loading: true, getLoadingComponent: capture(seen) });

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expectPlotBox(seen[0]);
    expect(seen[0].mochartConfig).not.toBeNull();
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBeUndefined();
    expect(seen[0].hasData).toBe(true);
  });

  it('reaches getErrorComponent whole in the laid-out chart', () => {
    const seen: ChartFactoryContext[] = [];
    mountChart({ error: 'boom', getErrorComponent: capture(seen) });

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expectPlotBox(seen[0]);
    expect(seen[0].mochartConfig).not.toBeNull();
    expect(seen[0].dataProvider).not.toBeNull();
    expect(seen[0].error).toBe('boom');
    expect(seen[0].hasData).toBe(true);
  });

  it('reaches getLoadingComponent whole before a config arrives, sized to the chart', () => {
    const seen: ChartFactoryContext[] = [];
    mountManaged({ loading: true, getLoadingComponent: capture(seen) });

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expect(seen[0].width).toBe(WIDTH);
    expect(seen[0].height).toBe(HEIGHT);
    expect(seen[0].mochartConfig).toBeNull();
    expect(seen[0].dataProvider).toBeNull();
    expect(seen[0].error).toBeUndefined();
    expect(seen[0].hasData).toBe(false);
  });

  it('reaches getErrorComponent whole before a config arrives, sized to the chart', () => {
    const seen: ChartFactoryContext[] = [];
    mountManaged({ error: 'boom', getErrorComponent: capture(seen) });

    expect(Object.keys(seen[0]).sort()).toEqual(contextKeys);
    expect(seen[0].width).toBe(WIDTH);
    expect(seen[0].height).toBe(HEIGHT);
    expect(seen[0].mochartConfig).toBeNull();
    expect(seen[0].dataProvider).toBeNull();
    expect(seen[0].error).toBe('boom');
    expect(seen[0].hasData).toBe(false);
  });
});

// Regression: the overlays deduped on the factory's returned node, which the defaults mint fresh per call, so every
// pointer-driven setState tore the message down and rebuilt it; factories now run only when their inputs change
describe('state factory re-invocation', () => {
  function counting(text: string) {
    const calls: ChartFactoryContext[] = [];
    const factory = (context: ChartFactoryContext) => {
      calls.push(context);
      return marker(text)();
    };
    return { calls, factory };
  }

  function mouse(target: Element, type: string, clientX: number, clientY: number): void {
    target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
  }

  it('keeps the loading overlay content across pointer-driven state changes', () => {
    const { calls, factory } = counting('custom loading');
    const container = mountChart({ loading: true, getLoadingComponent: factory }, makeConfig({ tooltip: { followPointer: true } }));
    const root = container.querySelector(getCssSelector('chart'))!;
    const before = container.querySelector('.factory-marker')!;
    expect(calls.length).toBe(1);

    // pointer tracking stays live while loading, so each followPointer move is a setState → syncBody
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'mousemove', 200, 100);
    mouse(root, 'mousemove', 300, 100);
    expect(calls.length).toBe(1);
    expect(container.querySelector('.factory-marker')).toBe(before);
  });

  it('keeps the overlay content across a re-sync with unchanged inputs, and reruns the factory on resize', () => {
    const { calls, factory } = counting('custom loading');
    const container = mountContainer();
    const props = { config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT, loading: true, getLoadingComponent: factory } as DefaultChartProps;
    const handle = trackHandle(createDefaultChart(container, props));
    const before = container.querySelector('.factory-marker')!;
    expect(calls.length).toBe(1);

    // a fresh callback identity re-syncs the chart, as a host re-render with inline arrows does
    handle.update({ ...props, onChartMouseMove: () => {} });
    expect(calls.length).toBe(1);
    expect(container.querySelector('.factory-marker')).toBe(before);

    handle.update({ ...props, width: WIDTH - 100 });
    expect(calls.length).toBe(2);
    expect(calls[1].width).toBeLessThan(calls[0].width);
    expect(container.querySelector('.factory-marker')).not.toBe(before);
  });

  it('keeps the no-config loading message across a re-sync with unchanged inputs, and reruns the factory on resize', () => {
    const { calls, factory } = counting('custom loading');
    const container = mountContainer();
    const props = { mochartConfig: null, dataProvider: null, width: WIDTH, height: HEIGHT, loading: true, getLoadingComponent: factory } as unknown as ManagedChartProps;
    const handle = trackHandle(createChart(container, props) as unknown as ChartHandle<DefaultChartProps>);
    const before = container.querySelector('.factory-marker')!;
    expect(calls.length).toBe(1);

    (handle as unknown as ChartHandle<ManagedChartProps>).update({ ...props, onChartMouseMove: () => {} });
    expect(calls.length).toBe(1);
    expect(container.querySelector('.factory-marker')).toBe(before);

    (handle as unknown as ChartHandle<ManagedChartProps>).update({ ...props, width: WIDTH - 100 });
    expect(calls.length).toBe(2);
    expect(calls[1].width).toBe(WIDTH - 100);
    expect(container.querySelector('.factory-marker')).not.toBe(before);
  });
});

// Regression: the no-size state nulls chartRef but keeps the tooltip state open, and the next data
// change measured the tooltip through the missing ref
describe('no-size state with an open tooltip', () => {
  it('survives a data change while the chart has no size', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    const root = container.querySelector(getChartRootCssSelector())!;
    root.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
    root.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    handle.update({ width: 0, height: 0 } as Partial<DefaultChartProps>);
    expect(container.querySelector(getCssSelector('chartError'))).not.toBeNull();
    expect(() => handle.update({ data: [...rows, { month: 'Mar', sales: 30 }] } as Partial<DefaultChartProps>)).not.toThrow();

    handle.update({ width: WIDTH, height: HEIGHT } as Partial<DefaultChartProps>);
    expect(container.querySelector(getCssSelector('chartError'))).toBeNull();
  });
});
