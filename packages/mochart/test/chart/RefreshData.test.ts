/**
 * ChartHandle.refresh(): the escape hatch for in-place data mutation — update() detects changes by
 * object identity only, so mutated arrays/providers need refresh() to be re-read and re-rendered.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function getCategoryLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('text'))
    .map(text => text.textContent ?? '')
    .filter(label => ['a', 'b', 'c'].includes(label));
}

import type { MochartInputConfig } from '../../src/types/config';

const config = {
  version: '1.0.0',
  categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
  series: [{ property: 'value', renderer: 'bar' }]
} as unknown as MochartInputConfig;

describe('createDefaultChart refresh', () => {
  it('renders a category pushed onto the same data array only after refresh', () => {
    const data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 3 }
    ];
    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, { config, data, width: 300, height: 200 });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    data.push({ label: 'c', value: 2 });
    chart.update({ data });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']); // identity unchanged, mutation not seen

    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b', 'c']);
    chart.destroy();
  });
});

describe('createChart refresh', () => {
  it('remaps an uncontrolled focused category after an in-place reorder', () => {
    const data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 3 },
      { label: 'c', value: 2 }
    ];
    const dataProvider = new mochart.ArrayOfObjectsDataProvider(data);
    const mochartConfig = mochart.enhanceConfig({
      ...config,
      animation: { enabled: false }
    } as never);
    const focuses: { focusedCategoryIndex: number }[] = [];
    const props = {
      mochartConfig,
      dataProvider,
      width: 300,
      height: 200,
      onFocus: (focus: { focusedCategoryIndex: number }) => focuses.push(focus)
    };

    const container = mountContainer();
    const chart = mochart.createChart(container, { ...props, focusedCategoryIndex: 1 });
    runFrames();
    // Release the controlled value while retaining the internally applied focus on b.
    chart.replace(props);

    const [a, b, c] = data;
    data.splice(0, data.length, b, a, c);
    chart.refresh();
    runFrames();

    expect(focuses.map(focus => focus.focusedCategoryIndex)).toEqual([0]);
    chart.destroy();
  });

  it('remaps focus after an in-place reorder of a live provider with no refresh hook', () => {
    const liveCategories = ['a', 'b', 'c'];
    const liveValues: Record<string, number> = { a: 1, b: 3, c: 2 };
    const dataProvider = {
      getPropertyValues: (property: string) =>
        property === 'label' ? [...liveCategories] : liveCategories.map(label => liveValues[label])
    };
    const mochartConfig = mochart.enhanceConfig({
      ...config,
      animation: { enabled: false }
    } as never);
    const focuses: { focusedCategoryIndex: number }[] = [];
    const props = {
      mochartConfig,
      dataProvider,
      width: 300,
      height: 200,
      onFocus: (focus: { focusedCategoryIndex: number }) => focuses.push(focus)
    };

    const container = mountContainer();
    const chart = mochart.createChart(container, { ...props, focusedCategoryIndex: 1 });
    runFrames();
    chart.replace(props);

    // The old ordering survives only in the chart's own snapshot: the provider
    // reads live, so by refresh() time the mutation has already happened.
    liveCategories.splice(0, liveCategories.length, 'b', 'a', 'c');
    chart.refresh();
    runFrames();

    expect(focuses.map(focus => focus.focusedCategoryIndex)).toEqual([0]);
    chart.destroy();
  });

  it('tolerates a null provider (loading hosts) across mount, refresh and update', () => {
    const mochartConfig = mochart.enhanceConfig(config as never);
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig, dataProvider: null as never, loading: true, width: 300, height: 200
    });
    runFrames();
    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container)).toEqual([]);

    const data = [{ label: 'a', value: 1 }, { label: 'b', value: 3 }];
    chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(data), loading: false });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);
    chart.destroy();
  });

  it('re-reads a stateless built-in row provider on refresh', () => {
    const data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 3 }
    ];
    const dataProvider = new mochart.ArrayOfObjectsDataProvider(data);
    const mochartConfig = mochart.enhanceConfig(config as never);
    expect(mochartConfig.validation.valid).toBe(true);

    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig, dataProvider, width: 300, height: 200
    });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    data.push({ label: 'c', value: 2 });
    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b', 'c']);
    chart.destroy();
  });

  // Regression: category values were aliased from the provider, so pushing onto a zero-copy provider's
  // arrays changed the rendered data's category count and the new bar snapped instead of entering.
  it('animates a category pushed in place onto a zero-copy provider as an addition', () => {
    const data = { label: ['a', 'b'], value: [1, 3] };
    const dataProvider = new mochart.ObjectOfArraysDataProvider(data);
    const mochartConfig = mochart.enhanceConfig({ ...config, animation: { enabled: true } } as never);
    expect(mochartConfig.validation.valid).toBe(true);

    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig, dataProvider, width: 300, height: 200
    });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    data.label.push('c');
    data.value.push(2);
    chart.refresh();
    const seriesBar = () => container.querySelectorAll(getCssSelector('seriesBar'));
    const paths = new Set<string>();
    while (runFrames(1) > 0) {
      const bars = seriesBar();
      if (bars.length === 3) {
        paths.add(bars[2].getAttribute('d')!);
      }
    }
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b', 'c']);
    // the entering bar takes many distinct shapes on its way in rather than snapping
    expect(paths.size).toBeGreaterThan(5);
    chart.destroy();
  });

  it('re-reads a live custom provider on refresh', () => {
    const liveCategories = ['a', 'b'];
    const liveValues: Record<string, number> = { a: 1, b: 3, c: 2 };
    const dataProvider = {
      getPropertyValues: (property: string) =>
        property === 'label' ? [...liveCategories] : liveCategories.map(label => liveValues[label])
    };
    const mochartConfig = mochart.enhanceConfig(config as never);
    expect(mochartConfig.validation.valid).toBe(true);

    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig, dataProvider, width: 300, height: 200
    });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    liveCategories.push('c');
    chart.update({ width: 301 }); // unrelated update: provider identity unchanged, mutation not seen
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b', 'c']);
    chart.destroy();
  });

  // Regression: with no config the chart's props were identical across refresh(), so the renderer
  // skipped sync and never re-read the provider's getLoading()/getError()
  it('re-reads a provider\'s getLoading() on refresh with no config loaded', () => {
    let loading = true;
    const dataProvider = { getPropertyValues: () => undefined, getLoading: () => loading };
    const container = mountContainer();
    const chart = mochart.createChart(container, { mochartConfig: null as never, dataProvider, width: 300, height: 200 });
    runFrames();
    expect(container.textContent).toContain('Loading...');

    loading = false;
    chart.refresh();
    runFrames();
    expect(container.textContent).not.toContain('Loading...');
    chart.destroy();
  });

  it('re-reads a provider\'s getError() on refresh with no config loaded', () => {
    let error = 'first failure';
    const dataProvider = { getPropertyValues: () => undefined, getError: () => error };
    const container = mountContainer();
    const chart = mochart.createChart(container, { mochartConfig: null as never, dataProvider, width: 300, height: 200 });
    runFrames();
    expect(container.textContent).toContain('first failure');

    error = 'second failure';
    chart.refresh();
    runFrames();
    expect(container.textContent).toContain('second failure');
    expect(container.textContent).not.toContain('first failure');
    chart.destroy();
  });
});

// Regression: the animated source read the previous provider's validity off the old read delegate,
// which reads live after refresh(), so an in-place validity flip never routed through start()
describe('animated createChart refresh across a provider validity flip', () => {
  const animatedConfig = { ...config, animation: { enabled: true } };
  const rows = [{ label: 'a', value: 1 }, { label: 'b', value: 3 }];

  function liveProvider(error: () => unknown, data = rows) {
    const inner = new mochart.ArrayOfObjectsDataProvider(data);
    return { getPropertyValues: (property: string) => inner.getPropertyValues(property), getError: error };
  }

  it('renders the data once a provider that mounted with an error clears it in place', () => {
    let error: string | undefined = 'boom';
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig: mochart.enhanceConfig(animatedConfig as never), dataProvider: liveProvider(() => error), width: 300, height: 200
    });
    runFrames();
    expect(container.textContent).toContain('boom');

    error = undefined;
    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);
    chart.destroy();
  });

  it('shows the error, then the data again, as a provider turns invalid and back in place', () => {
    let error: string | undefined;
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig: mochart.enhanceConfig(animatedConfig as never), dataProvider: liveProvider(() => error), width: 300, height: 200
    });
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);

    error = 'boom';
    chart.refresh();
    runFrames();
    expect(container.textContent).toContain('boom');
    expect(getCategoryLabels(container)).toEqual([]);

    error = undefined;
    rows.push({ label: 'c', value: 2 });
    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b', 'c']);
    chart.destroy();
  });

  // Regression: an unrelated update() recorded the in-place flip as "valid, already started", so the
  // following refresh() skipped start() and tweened against null chart data
  it('renders the data after an in-place error clear, an unrelated update and a refresh', () => {
    let error: string | undefined = 'boom';
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig: mochart.enhanceConfig(animatedConfig as never), dataProvider: liveProvider(() => error, [{ label: 'a', value: 1 }, { label: 'b', value: 3 }]), width: 300, height: 200
    });
    runFrames();
    expect(container.textContent).toContain('boom');

    error = undefined;
    chart.update({ width: 301 });
    runFrames();
    chart.update({ focusedCategoryIndex: 1 });
    runFrames();
    expect(getCategoryLabels(container)).toEqual([]);

    chart.refresh();
    runFrames();
    expect(getCategoryLabels(container).sort()).toEqual(['a', 'b']);
    chart.destroy();
  });

  it('drops its chart data when the provider turns invalid behind a fresh read identity', async () => {
    const { AnimatedDataSource } = await import('../../src/chart/AnimatedDataSource');
    let error: string | undefined = undefined;
    const provider = liveProvider(() => error);
    const base = {
      mochartConfig: mochart.enhanceConfig(animatedConfig as never) as never,
      filteredSeriesIds: {}, focusedCategoryIndex: -1, focusedValueAxisId: null, focusedSeriesId: null
    };
    const source = new AnimatedDataSource(() => {});
    const first = { ...base, dataProvider: { ...provider } };
    source.start(first);
    runFrames();
    expect(source.chartData).not.toBeNull();

    error = 'boom';
    source.update(first, { ...base, dataProvider: { ...provider } });
    expect(source.chartData).toBeNull();
    expect(source.focusData).toBeNull();
    source.dispose();
  });
});
