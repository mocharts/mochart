import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp, createSSRApp, defineComponent, h, markRaw, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { App } from 'vue';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart, DefaultChart } from '../src/index';
import type { ChartRef } from '../src/index';

beforeAll(() => {
  // jsdom has no SVG layout engine; return zero sizes so the library takes its
  // documented default-bounds fallbacks (same shims as the golden tests).
  const svgProto = (globalThis as any).SVGElement.prototype;
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

function mountWith(component: any, props: Record<string, any>): { el: HTMLDivElement; app: App; state: Record<string, any> } {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const state = reactive({ ...props });
  const app = createApp({ render: () => h(component, { ...state }) });
  app.mount(el);
  return { el, app, state };
}

describe('Chart', () => {
  it('mounts an svg chart, applies prop updates, and cleans up on unmount', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    expect(mochartConfig.validation.valid).toBe(true);
    const { el, app, state } = mountWith(Chart, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 400,
      height: 300
    });

    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('400');
    expect(svg!.getAttribute('height')).toBe('300');
    expect(el.textContent).toContain('Test Chart');

    state.width = 500;
    await nextTick();
    expect(el.querySelector('svg')!.getAttribute('width')).toBe('500');

    app.unmount();
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });
});

describe('Chart auto-sizing', () => {
  it('tracks the container size when width/height are omitted', () => {
    const observed: { callback: ResizeObserverCallback }[] = [];
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
    (globalThis as any).ResizeObserver = FakeResizeObserver;
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(240);
    try {
      const { el, app } = mountWith(DefaultChart, { config: rawConfig(), data: rows });
      const svg = el.querySelector('svg');
      expect(svg!.getAttribute('width')).toBe('320');
      expect(svg!.getAttribute('height')).toBe('240');

      widthSpy.mockReturnValue(500);
      heightSpy.mockReturnValue(400);
      for (const { callback } of observed) {
        callback([], undefined as any);
      }
      expect(svg!.getAttribute('width')).toBe('500');
      expect(svg!.getAttribute('height')).toBe('400');

      app.unmount();
      el.remove();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
      delete (globalThis as any).ResizeObserver;
    }
  });
});

describe('placeholder components', () => {
  // Regression: the error prop's default typed it as `undefined`, so a real error value failed to type-check
  it('accepts an unknown error value and renders the error state', async () => {
    const errorValue: unknown = new Error('boom');
    // a typed h() call: with the prop typed `undefined` this line fails to compile
    const vnode = h(Chart, { mochartConfig: null, dataProvider: null, error: errorValue, width: 400, height: 300 });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({ render: () => vnode });
    app.mount(el);
    expect(el.textContent).toContain('boom');
    app.unmount();
    el.remove();
  });

  it('renders loadingComponent with the chart context, updates it, and removes it', async () => {
    const Loading = markRaw(
      defineComponent({
        name: 'Loading',
        props: { width: Number, height: Number },
        setup: (props) => () => h('div', `Loading ${props.width}x${props.height}`)
      })
    );
    const { el, app, state } = mountWith(Chart, {
      mochartConfig: null,
      dataProvider: null,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });

    await nextTick();
    expect(el.textContent).toContain('Loading 400x300');

    state.width = 500;
    await nextTick();
    expect(el.textContent).toContain('Loading 500x300');

    state.loading = false;
    await nextTick();
    expect(el.textContent).not.toContain('Loading');

    app.unmount();
    el.remove();
  });

  // Regression: a component swap only reached the slot on the next factory call, which the core's
  // factory gate skips while nothing else about the state changed
  it('re-renders the placeholder when only the component prop changes', async () => {
    const First = markRaw(defineComponent({ name: 'First', setup: () => () => h('div', 'first placeholder') }));
    const Second = markRaw(defineComponent({ name: 'Second', setup: () => () => h('div', 'second placeholder') }));
    const { el, app, state } = mountWith(Chart, {
      mochartConfig: null, dataProvider: null, loading: true, loadingComponent: First, width: 400, height: 300
    });
    await nextTick();
    expect(el.textContent).toContain('first placeholder');

    state.loadingComponent = Second;
    await nextTick();
    expect(el.textContent).toContain('second placeholder');
    expect(el.textContent).not.toContain('first placeholder');

    app.unmount();
    el.remove();
  });

  // Regression: on the update path the placeholder rendered into its container before the core inserted it,
  // so its mounted hooks ran detached, unlike the initial mount path
  it('mounts a placeholder inside the document on both the initial and the update path', async () => {
    const log: string[] = [];
    const Loading = markRaw(
      defineComponent({
        name: 'Loading',
        setup: () => {
          const root = ref<HTMLElement | null>(null);
          onMounted(() => { log.push('mounted connected=' + root.value?.isConnected); });
          return () => h('div', { ref: root }, 'Custom loading');
        }
      })
    );
    const initial = mountWith(Chart, { mochartConfig: null, dataProvider: null, loading: true, loadingComponent: Loading, width: 400, height: 300 });
    await nextTick();
    expect(log).toEqual(['mounted connected=true']);
    initial.app.unmount();
    initial.el.remove();

    log.length = 0;
    const updated = mountWith(Chart, { mochartConfig: null, dataProvider: null, loading: false, loadingComponent: Loading, width: 400, height: 300 });
    await nextTick();
    updated.state.loading = true;
    await nextTick();
    expect(log).toEqual(['mounted connected=true']);
    expect(updated.el.textContent).toContain('Custom loading');
    updated.app.unmount();
    updated.el.remove();
  });

  it('renders configErrorComponent when the config fails validation', async () => {
    const mochartConfig = enhanceConfig({ ...rawConfig(), unknownExtra: 1 });
    expect(mochartConfig.validation.valid).toBe(false);
    const ConfigError = markRaw(
      defineComponent({
        name: 'ConfigError',
        props: { width: Number, height: Number },
        setup: (props) => () => h('div', `Bad config ${props.width}x${props.height}`)
      })
    );
    const { el, app } = mountWith(Chart, {
      mochartConfig: markRaw(mochartConfig),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      configErrorComponent: ConfigError,
      width: 400,
      height: 300
    });

    await nextTick();
    expect(el.textContent).toContain('Bad config 400x300');

    app.unmount();
    el.remove();
  });
});

describe('DefaultChart', () => {
  it('enhances a raw config and updates data and structural config', async () => {
    const { el, app, state } = mountWith(DefaultChart, {
      config: rawConfig(),
      data: rows,
      width: 400,
      height: 300
    });

    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Test Chart');
    expect(el.textContent).not.toContain('D');

    state.data = [...rows, { name: 'D', period: 'P4', value: 40 }];
    await nextTick();
    expect(el.textContent).toContain('D');

    state.config = rawConfig('period');
    state.data = rows;
    await nextTick();
    expect(el.textContent).toContain('P1');
    expect(el.textContent).not.toContain('A');

    app.unmount();
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });

  it('accepts the loading prop and renders loadingComponent over the chart', async () => {
    const Loading = markRaw(
      defineComponent({
        name: 'Loading',
        props: { width: Number, height: Number },
        setup: (props) => () => h('div', `Loading ${props.width}x${props.height}`)
      })
    );
    const { el, app, state } = mountWith(DefaultChart, {
      config: rawConfig(),
      data: rows,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });

    await nextTick();
    // the loading overlay factory receives the plot-area bounds, not the outer size
    expect(el.textContent).toContain('Loading');

    state.loading = false;
    await nextTick();
    expect(el.textContent).not.toContain('Loading');

    app.unmount();
    el.remove();
  });
});

// Regression: a cleared placeholder component left its stale factory in the
// chart, so the custom component kept rendering forever.
describe('removed placeholder components', () => {
  it('falls back to the built-in placeholder when the component is cleared', async () => {
    const Loading = markRaw(
      defineComponent({
        name: 'Loading',
        setup: () => () => h('div', 'Custom loading')
      })
    );
    const { el, app, state } = mountWith(Chart, {
      mochartConfig: null,
      dataProvider: null,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });
    await nextTick();
    expect(el.textContent).toContain('Custom loading');

    state.loadingComponent = undefined;
    await nextTick();
    expect(el.textContent).not.toContain('Custom loading');
    expect(el.querySelector('.mochart-loading')).not.toBeNull();

    app.unmount();
    el.remove();
  });

  // Regression: clearing the prop left the mounted instance alive in its detached container, so its hooks kept running.
  it('unmounts the placeholder instance when the component is cleared', async () => {
    let unmounted = 0;
    const Loading = markRaw(
      defineComponent({
        name: 'Loading',
        setup: () => {
          onUnmounted(() => { unmounted += 1; });
          return () => h('div', 'Custom loading');
        }
      })
    );
    const { el, app, state } = mountWith(Chart, {
      mochartConfig: null,
      dataProvider: null,
      loading: true,
      loadingComponent: Loading,
      width: 400,
      height: 300
    });
    await nextTick();
    expect(el.textContent).toContain('Custom loading');
    expect(unmounted).toBe(0);

    state.loadingComponent = undefined;
    await nextTick();
    expect(unmounted).toBe(1);

    // the released slot is rebuilt when the prop comes back
    state.loadingComponent = Loading;
    await nextTick();
    expect(el.textContent).toContain('Custom loading');
    expect(unmounted).toBe(1);

    app.unmount();
    el.remove();
  });
});

// Regression: a fallthrough container style used to override the explicit
// size props; the size props must win, like in the other bindings.
describe('size props vs container style', () => {
  it('keeps the explicit size when a fallthrough style sets a conflicting one', () => {
    const { el, app } = mountWith(Chart, {
      mochartConfig: enhanceConfig(rawConfig()),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 400,
      height: 300,
      style: 'width: 100%; margin: 4px'
    });
    const containerDiv = el.firstElementChild as HTMLDivElement;
    expect(containerDiv.style.width).toBe('400px');
    expect(containerDiv.style.margin).toBe('4px');
    app.unmount();
    el.remove();
  });
});

describe('dataTestId', () => {
  it('applies data-testid to the container div and wins over the fallthrough attr', async () => {
    const { el, app, state } = mountWith(Chart, {
      mochartConfig: enhanceConfig(rawConfig()),
      dataProvider: new ArrayOfObjectsDataProvider(rows),
      width: 400,
      height: 300,
      dataTestId: 'revenue-chart',
      'data-testid': 'native-attr'
    });
    const containerDiv = el.firstElementChild as HTMLDivElement;
    expect(containerDiv.getAttribute('data-testid')).toBe('revenue-chart');

    state.dataTestId = undefined;
    await nextTick();
    expect(containerDiv.getAttribute('data-testid')).toBe('native-attr');

    app.unmount();
    el.remove();
  });
});

describe('refresh', () => {
  // Regression: SetupContext.expose does not reach the instance type, so an InstanceType-typed template ref used to have no refresh at all.
  it('is on the inferred instance type of both components', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const chartRef = ref<InstanceType<typeof DefaultChart> | null>(null);
    const plainRef = ref<InstanceType<typeof Chart> | null>(null);
    const app = createApp({ render: () => h(DefaultChart, { ref: chartRef, config: rawConfig(), data: rows, width: 400, height: 300 }) });
    app.mount(el);
    await nextTick();
    expect(typeof chartRef.value!.refresh).toBe('function');
    chartRef.value!.refresh();
    expect(plainRef.value).toBeNull();
    // the instance type is a real type, not any: a never[] construct signature used to collapse it
    // @ts-expect-error nope is not on the instance
    void chartRef.value?.nope;
    // @ts-expect-error nope is not on the instance
    void plainRef.value?.nope;
    app.unmount();
    el.remove();
  });

  it('re-reads in-place data mutations through a template ref', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const data = [...rows];
    const chartRef = ref<ChartRef | null>(null);
    const app = createApp({ render: () => h(DefaultChart, { ref: chartRef, config: rawConfig(), data, width: 400, height: 300 }) });
    app.mount(el);
    await nextTick();
    expect(el.textContent).toContain('C');
    expect(el.textContent).not.toContain('D');

    data.push({ name: 'D', period: 'P4', value: 40 });
    chartRef.value!.refresh();
    expect(el.textContent).toContain('D');
    app.unmount();
  });
});

// The callback maps are string-to-string plumbing — a dropped or misspelled row ships and the callback never fires — and core switches behaviour on callback presence, so every row gets a delivery case.
describe('interaction callbacks', () => {
  function mountCallbacks(callbacks: Record<string, any>, config = rawConfig()) {
    return mountWith(DefaultChart, { config, data: rows, width: 400, height: 300, ...callbacks });
  }

  function mouse(target: Element, type: string, clientX: number, clientY: number) {
    target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
  }

  it('delivers onSeriesLayoutBoundsChange on mount', () => {
    const onSeriesLayoutBoundsChange = vi.fn();
    const { el, app } = mountCallbacks({ onSeriesLayoutBoundsChange });
    expect(onSeriesLayoutBoundsChange).toHaveBeenCalled();
    const bounds = onSeriesLayoutBoundsChange.mock.calls[0][0] as { width: number; height: number };
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    app.unmount();
    el.remove();
  });

  it('delivers the pointer callbacks and onFocus', () => {
    const spies = {
      onChartMouseEnter: vi.fn(), onChartMouseMove: vi.fn(),
      onChartMouseLeave: vi.fn(), onChartClick: vi.fn(), onFocus: vi.fn()
    };
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({})
    } as DOMRect));
    try {
      const { el, app } = mountCallbacks(spies);
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

      app.unmount();
      el.remove();
    }
    finally {
      rect.mockRestore();
    }
  });

  it('delivers onTitleClick, and the title becomes a control because the prop is present', () => {
    const onTitleClick = vi.fn();
    const { el, app } = mountCallbacks({ onTitleClick });
    const title = el.querySelector('.mochart-title')!;
    expect(title.getAttribute('role')).toBe('button');
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onTitleClick).toHaveBeenCalledTimes(1);
    app.unmount();
    el.remove();
  });

  it('delivers onSeriesFilter from a legend click', () => {
    const onSeriesFilter = vi.fn();
    const { el, app } = mountCallbacks({ onSeriesFilter }, { ...rawConfig(), legend: { visible: true } });
    el.querySelector('.mochart-legend-item')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    app.unmount();
    el.remove();
  });

  it('delivers onSeriesClick from a series click', () => {
    const onSeriesClick = vi.fn();
    const { el, app } = mountCallbacks({ onSeriesClick });
    el.querySelector('.mochart-series path, .mochart-series rect')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSeriesClick).toHaveBeenCalledTimes(1);
    app.unmount();
    el.remove();
  });

  it('delivers onSliceClick from a pie slice click', () => {
    const onSliceClick = vi.fn();
    const { el, app } = mountCallbacks({ onSliceClick }, { ...rawConfig(), chart: { type: 'pie' } });
    el.querySelector('.mochart-series path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSliceClick).toHaveBeenCalledTimes(1);
    app.unmount();
    el.remove();
  });
});

describe('hydration', () => {
  it('hydrates server output without warnings and mounts the chart in the browser', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const root = { render: () => h(Chart, { mochartConfig, dataProvider, width: 400, height: 300 }) };
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.innerHTML = await renderToString(createSSRApp(root));
    expect(el.querySelector('svg')).toBeNull();

    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createSSRApp(root);
    app.mount(el);
    await nextTick();
    expect(warnings).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Test Chart');
    warnings.mockRestore();
    errors.mockRestore();
    app.unmount();
    el.remove();
  });
});
