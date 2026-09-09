// The `.svelte.test.ts` name lets the svelte plugin compile this file so the
// `$state` rune is available for driving prop updates.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart, DefaultChart } from '../src/index';
import Loading from './Loading.svelte';
import ConfigError from './ConfigError.svelte';
import MountMutation from './MountMutation.svelte';
import TrackedLoading, { destroyLog } from './TrackedLoading.svelte';

beforeAll(() => {
  // jsdom has no SVG layout engine; return zero sizes so the library takes its
  // documented default-bounds fallbacks (same shims as the golden tests).
  const svgProto = globalThis.SVGElement.prototype as any;
  if (typeof svgProto.getComputedTextLength !== 'function') {
    svgProto.getComputedTextLength = () => 0;
  }
  if (typeof svgProto.getSubStringLength !== 'function') {
    svgProto.getSubStringLength = () => 0;
  }
  if (typeof svgProto.getBBox !== 'function') {
    svgProto.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  }
});

function rawConfig(categoryProperty = 'name'): any {
  return {
    version: '1.0.0',
    title: { text: 'Test Chart' },
    categoryAxis: { property: categoryProperty, type: 'string', scale: 'ordinal' },
    seriesDefaults: { renderer: 'bar' },
    series: [{ property: 'value', title: 'Value' }],
    animation: { enabled: false }
  };
}

const rows = [
  { name: 'A', period: 'P1', value: 10 },
  { name: 'B', period: 'P2', value: 20 },
  { name: 'C', period: 'P3', value: 30 }
];

function target() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('Chart', () => {
  it('mounts an svg chart, applies prop updates, and cleans up on unmount', () => {
    const el = target();
    const mochartConfig = enhanceConfig(rawConfig());
    expect(mochartConfig.validation.valid).toBe(true);
    const props = $state({
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 400,
      height: 300
    });

    const instance = mount(Chart, { target: el, props });
    flushSync();
    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('400');
    expect(svg!.getAttribute('height')).toBe('300');
    expect(el.textContent).toContain('Test Chart');

    props.width = 500;
    flushSync();
    expect(el.querySelector('svg')!.getAttribute('width')).toBe('500');

    void unmount(instance);
    flushSync();
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });
});

describe('Chart auto-sizing', () => {
  it('tracks the container size when width/height are omitted', () => {
    const observed: Array<{ callback: ResizeObserverCallback }> = [];
    class FakeResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        observed.push({ callback: this.callback });
      }
      disconnect() {}
      unobserve() {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(240);
    try {
      const el = target();
      const props = $state({ config: rawConfig(), data: rows });
      const instance = mount(DefaultChart, { target: el, props });
      flushSync();
      const svg = el.querySelector('svg');
      expect(svg!.getAttribute('width')).toBe('320');
      expect(svg!.getAttribute('height')).toBe('240');

      widthSpy.mockReturnValue(500);
      heightSpy.mockReturnValue(400);
      for (const { callback } of observed) {
        callback([], undefined as unknown as ResizeObserver);
      }
      expect(svg!.getAttribute('width')).toBe('500');
      expect(svg!.getAttribute('height')).toBe('400');

      void unmount(instance);
      el.remove();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
      delete (globalThis as any).ResizeObserver;
    }
  });
});

describe('placeholder components', () => {
  it('renders loadingComponent with the chart context, updates it, and removes it', () => {
    const el = target();
    const props = $state({
      mochartConfig: null as any,
      dataProvider: null as any,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });

    const instance = mount(Chart, { target: el, props });
    flushSync();
    expect(el.textContent).toContain('Loading 400x300');

    props.width = 500;
    flushSync();
    expect(el.textContent).toContain('Loading 500x300');

    props.loading = false;
    flushSync();
    expect(el.textContent).not.toContain('Loading');

    void unmount(instance);
    flushSync();
    el.remove();
  });

  // Regression: a component swap only reached the slot on the next factory call, which the core's
  // factory gate skips while nothing else about the state changed
  it('re-renders the placeholder when only the component prop changes', () => {
    const el = target();
    const props = $state({
      mochartConfig: null as any, dataProvider: null as any, loading: true, loadingComponent: Loading as any, width: 400, height: 300
    });
    const instance = mount(Chart, { target: el, props });
    flushSync();
    expect(el.textContent).toContain('Loading 400x300');

    props.loadingComponent = ConfigError;
    flushSync();
    expect(el.textContent).toContain('Bad config 400x300');
    expect(el.textContent).not.toContain('Loading');

    void unmount(instance);
    flushSync();
    el.remove();
  });

  it('renders configErrorComponent when the config fails validation', () => {
    const el = target();
    const mochartConfig = enhanceConfig({ ...rawConfig(), unknownExtra: 1 });
    expect(mochartConfig.validation.valid).toBe(false);

    const instance = mount(Chart, {
      target: el,
      props: {
        mochartConfig,
        dataProvider: new ArrayOfObjectsDataProvider(rows),
        configErrorComponent: ConfigError,
        width: 400,
        height: 300
      }
    });
    flushSync();
    expect(el.textContent).toContain('Bad config 400x300');

    void unmount(instance);
    flushSync();
    el.remove();
  });
});

describe('DefaultChart', () => {
  it('enhances a raw config and updates data and structural config', () => {
    const el = target();
    const props = $state({
      config: rawConfig(),
      data: rows,
      width: 400,
      height: 300
    });

    const instance = mount(DefaultChart, { target: el, props });
    flushSync();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Test Chart');
    expect(el.textContent).not.toContain('D');

    props.data = [...rows, { name: 'D', period: 'P4', value: 40 }];
    flushSync();
    expect(el.textContent).toContain('D');

    props.config = rawConfig('period');
    props.data = rows;
    flushSync();
    expect(el.textContent).toContain('P1');
    expect(el.textContent).not.toContain('A');

    void unmount(instance);
    flushSync();
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });

  it('accepts the loading prop and renders loadingComponent over the chart', () => {
    const el = target();
    const props = $state({
      config: rawConfig(),
      data: rows,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });

    const instance = mount(DefaultChart, { target: el, props });
    flushSync();
    // the loading overlay factory receives the plot-area bounds, not the outer size
    expect(el.textContent).toContain('Loading');

    props.loading = false;
    flushSync();
    expect(el.textContent).not.toContain('Loading');

    void unmount(instance);
    flushSync();
    el.remove();
  });
});

// Regression: run-counting skipped the whole first $effect run, so a prop
// change made in the parent's onMount (which flushes after the chart's) was
// silently dropped.
describe('pre-effect prop changes', () => {
  it('applies a prop change made in the parent onMount', () => {
    const el = target();
    const mochartConfig = enhanceConfig(rawConfig());
    const instance = mount(MountMutation, {
      target: el,
      props: { mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(rows) }
    });
    flushSync();
    expect(el.querySelector('svg')!.getAttribute('width')).toBe('500');

    void unmount(instance);
    el.remove();
  });
});

// Regression: a prop deleted from the spread never reached the chart, so the
// previous value survived every later update.
describe('removed props', () => {
  it('clears the loading state when the prop is deleted', () => {
    const el = target();
    const mochartConfig = enhanceConfig(rawConfig());
    const props: { mochartConfig: any; dataProvider: any; loading?: boolean; width: number; height: number } = $state({
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      loading: true,
      width: 400,
      height: 300
    });
    const instance = mount(Chart, { target: el, props });
    flushSync();
    expect(el.querySelector('.mochart-loading')).not.toBeNull();

    delete props.loading;
    flushSync();
    expect(el.querySelector('.mochart-loading')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();

    void unmount(instance);
    el.remove();
  });
});

// Regression: clearing the prop left the mounted instance alive in its detached container, so its onDestroy never ran.
// Regression: the slot's instance stayed mounted in the detached container after the chart left the
// state, so its effects kept running and re-entry reused the stale instance
describe('placeholder instances across chart states', () => {
  it('destroys the placeholder when the chart leaves the state and mounts a fresh one on re-entry', async () => {
    const el = target();
    const before = destroyLog.destroyed;
    const props = $state({
      config: rawConfig(), data: rows, loading: true, loadingComponent: TrackedLoading, width: 400, height: 300
    });
    const instance = mount(DefaultChart, { target: el, props });
    flushSync();
    expect(el.textContent).toContain('Custom loading');

    props.loading = false;
    flushSync();
    await Promise.resolve();
    expect(el.textContent).not.toContain('Custom loading');
    expect(destroyLog.destroyed).toBe(before + 1);

    props.loading = true;
    flushSync();
    await Promise.resolve();
    expect(el.textContent).toContain('Custom loading');
    expect(destroyLog.destroyed).toBe(before + 1);

    void unmount(instance);
    flushSync();
    expect(destroyLog.destroyed).toBe(before + 2);
    el.remove();
  });
});

describe('removed placeholder components', () => {
  it('destroys the placeholder instance when the component is cleared', () => {
    const el = target();
    const before = destroyLog.destroyed;
    const props: { mochartConfig: any; dataProvider: any; loading: boolean; loadingComponent?: any; width: number; height: number } = $state({
      mochartConfig: null,
      dataProvider: null,
      loading: true,
      loadingComponent: TrackedLoading,
      width: 400,
      height: 300
    });
    const instance = mount(Chart, { target: el, props });
    flushSync();
    expect(el.textContent).toContain('Custom loading');
    expect(destroyLog.destroyed).toBe(before);

    props.loadingComponent = undefined;
    flushSync();
    expect(destroyLog.destroyed).toBe(before + 1);

    // the released slot is rebuilt when the prop comes back
    props.loadingComponent = TrackedLoading;
    flushSync();
    expect(el.textContent).toContain('Custom loading');
    expect(destroyLog.destroyed).toBe(before + 1);

    void unmount(instance);
    flushSync();
    el.remove();
  });
});

// Regression: style directives dropped the host's own width when the explicit width was removed
describe('host style with explicit sizes', () => {
  it('restores the host style width when the explicit width is removed', () => {
    const el = target();
    const props = $state({
      mochartConfig: enhanceConfig(rawConfig()),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      style: 'width: 300px; margin: 4px',
      width: 400 as number | undefined,
      height: 300
    });
    const instance = mount(Chart, { target: el, props });
    flushSync();
    const containerDiv = el.firstElementChild as HTMLDivElement;
    expect(containerDiv.style.width).toBe('400px');
    expect(containerDiv.style.margin).toBe('4px');

    props.width = undefined;
    flushSync();
    expect(containerDiv.style.width).toBe('300px');
    expect(containerDiv.style.height).toBe('300px');
    expect(containerDiv.style.margin).toBe('4px');

    void unmount(instance);
    el.remove();
  });
});

describe('dataTestId', () => {
  it('applies and removes data-testid on the container div', () => {
    const el = target();
    const props = $state({
      mochartConfig: enhanceConfig(rawConfig()),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 400,
      height: 300,
      dataTestId: 'revenue-chart' as string | undefined
    });
    const instance = mount(Chart, { target: el, props });
    flushSync();
    const containerDiv = el.firstElementChild as HTMLDivElement;
    expect(containerDiv.getAttribute('data-testid')).toBe('revenue-chart');

    props.dataTestId = undefined;
    flushSync();
    expect(containerDiv.getAttribute('data-testid')).toBeNull();

    void unmount(instance);
    el.remove();
  });
});

describe('refresh', () => {
  it('re-reads in-place data mutations through the instance method', () => {
    const el = target();
    const data = [...rows];
    const component = mount(DefaultChart, { target: el, props: { config: rawConfig(), data, width: 400, height: 300 } });
    flushSync();
    expect(el.textContent).toContain('C');
    expect(el.textContent).not.toContain('D');

    data.push({ name: 'D', period: 'P4', value: 40 });
    (component as { refresh(): void }).refresh();
    expect(el.textContent).toContain('D');
    void unmount(component);
  });
});

// The callback maps are string-to-string plumbing — a dropped or misspelled row ships and the callback never fires — and core switches behaviour on callback presence, so every row gets a delivery case.
describe('interaction callbacks', () => {
  async function mountCallbacks(callbacks: Record<string, unknown>, config = rawConfig()) {
    const el = target();
    const instance = mount(DefaultChart, {
      target: el, props: { config, data: rows, width: 400, height: 300, ...callbacks } as any
    });
    flushSync();
    return { el, dispose: () => { void unmount(instance); } };
  }

  function mouse(target: Element, type: string, clientX: number, clientY: number) {
    target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
  }

  it('delivers onSeriesLayoutBoundsChange on mount', async () => {
    const onSeriesLayoutBoundsChange = vi.fn();
    const { el, dispose } = await mountCallbacks({ onSeriesLayoutBoundsChange });
    expect(onSeriesLayoutBoundsChange).toHaveBeenCalled();
    const bounds = onSeriesLayoutBoundsChange.mock.calls[0][0] as { width: number; height: number };
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    dispose();
    el.remove();
  });

  it('delivers the pointer callbacks and onFocus', async () => {
    const spies = {
      onChartMouseEnter: vi.fn(), onChartMouseMove: vi.fn(),
      onChartMouseLeave: vi.fn(), onChartClick: vi.fn(), onFocus: vi.fn()
    };
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({})
    } as DOMRect));
    try {
      const { el, dispose } = await mountCallbacks(spies);
      const chartRoot = el.querySelector('[data-mochart-version]')!;

      mouse(chartRoot, 'mouseenter', 100, 100);
      expect(spies.onChartMouseEnter).toHaveBeenCalledTimes(1);
      mouse(chartRoot, 'mousemove', 200, 100);
      expect(spies.onChartMouseMove).toHaveBeenCalledTimes(1);
      mouse(chartRoot, 'click', 200, 100);
      expect(spies.onChartClick).toHaveBeenCalledTimes(1);
      expect(spies.onFocus).toHaveBeenCalled();
      mouse(chartRoot, 'mousemove', -10, 100);
      expect(spies.onChartMouseLeave).toHaveBeenCalledTimes(1);

      dispose();
      el.remove();
    }
    finally {
      rect.mockRestore();
    }
  });

  it('delivers onTitleClick, and the title becomes a control because the prop is present', async () => {
    const onTitleClick = vi.fn();
    const { el, dispose } = await mountCallbacks({ onTitleClick });
    const title = el.querySelector('.mochart-title')!;
    expect(title.getAttribute('role')).toBe('button');
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onTitleClick).toHaveBeenCalledTimes(1);
    dispose();
    el.remove();
  });

  it('delivers onSeriesFilter from a legend click', async () => {
    const onSeriesFilter = vi.fn();
    const { el, dispose } = await mountCallbacks({ onSeriesFilter }, { ...rawConfig(), legend: { visible: true } });
    el.querySelector('.mochart-legend-item')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    dispose();
    el.remove();
  });

  it('delivers onSeriesClick from a series click', async () => {
    const onSeriesClick = vi.fn();
    const { el, dispose } = await mountCallbacks({ onSeriesClick });
    el.querySelector('.mochart-series path, .mochart-series rect')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSeriesClick).toHaveBeenCalledTimes(1);
    dispose();
    el.remove();
  });

  it('delivers onSliceClick from a pie slice click', async () => {
    const onSliceClick = vi.fn();
    const { el, dispose } = await mountCallbacks({ onSliceClick }, { ...rawConfig(), chart: { type: 'pie' } });
    el.querySelector('.mochart-series path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSliceClick).toHaveBeenCalledTimes(1);
    dispose();
    el.remove();
  });
});
