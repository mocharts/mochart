import { describe, it, expect, beforeAll, vi } from 'vitest';
import { html, nothing, render } from 'lit-html';
import { AsyncDirective, directive } from 'lit-html/async-directive.js';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { chart, defaultChart } from '../src/index';
import type { ChartRef, PlaceholderProps } from '../src/index';

/** Stands in for whatever work a placeholder template starts: counts its own disconnection. */
class TrackDisconnect extends AsyncDirective {
  private log: { disconnected: number } | null = null;
  render(log: { disconnected: number }): unknown {
    this.log = log;
    return nothing;
  }
  protected override disconnected(): void {
    if (this.log !== null) {
      this.log.disconnected += 1;
    }
  }
}

const trackDisconnect = directive(TrackDisconnect);

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

function mountPoint(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// The directives mount their chart in a microtask after the render pass (so
// the container is connected before the initial measurement); flush it.
async function flushMount(): Promise<void> {
  await Promise.resolve();
}

describe('chart', () => {
  it('mounts an svg chart, applies prop updates, and cleans up on unmount', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    expect(mochartConfig.validation.valid).toBe(true);
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const el = mountPoint();
    const template = (width: number) => html`${chart({ mochartConfig, dataProvider, width, height: 300 })}`;

    render(template(400), el);
    await flushMount();

    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('400');
    expect(svg!.getAttribute('height')).toBe('300');
    expect(el.textContent).toContain('Test Chart');

    render(template(500), el);
    expect(el.querySelector('svg')!.getAttribute('width')).toBe('500');

    render(nothing, el);
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });
});

describe('chart container props', () => {
  it('applies className and style to the container div, with size props winning', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const el = mountPoint();
    render(
      html`${chart({ mochartConfig, dataProvider, className: 'my-chart', style: 'flex: 1 1 auto; width: 50px;', width: 400, height: 300 })}`,
      el
    );
    await flushMount();

    const container = el.querySelector('div.my-chart') as HTMLDivElement;
    expect(container).not.toBeNull();
    expect(container.style.flex).toBe('1 1 auto');
    expect(container.style.width).toBe('400px');
    expect(container.style.height).toBe('300px');

    render(nothing, el);
    el.remove();
  });

  it('applies and removes data-testid on the container div', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const el = mountPoint();
    const template = (dataTestId?: string) =>
      html`${chart({ mochartConfig, dataProvider, dataTestId, width: 400, height: 300 })}`;
    render(template('revenue-chart'), el);
    await flushMount();

    const container = el.querySelector('div[data-testid="revenue-chart"]') as HTMLDivElement;
    expect(container).not.toBeNull();

    render(template(undefined), el);
    expect(container.getAttribute('data-testid')).toBeNull();

    render(nothing, el);
    el.remove();
  });
});

describe('chart auto-sizing', () => {
  it('tracks the container size when width/height are omitted', async () => {
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
      const el = mountPoint();
      render(html`${defaultChart({ config: rawConfig(), data: rows })}`, el);
      await flushMount();

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

      render(nothing, el);
      el.remove();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
      delete (globalThis as any).ResizeObserver;
    }
  });
});

describe('placeholder templates', () => {
  it('renders loadingTemplate with the chart context, updates it, and removes it', async () => {
    const loadingTemplate = ({ width, height }: PlaceholderProps) => html`<div>Loading ${width}x${height}</div>`;
    const el = mountPoint();
    const template = (width: number, loading: boolean) =>
      html`${chart({ mochartConfig: null, dataProvider: null, loading, loadingTemplate, width, height: 300 })}`;

    render(template(400, true), el);
    await flushMount();
    expect(el.textContent).toContain('Loading 400x300');

    render(template(500, true), el);
    expect(el.textContent).toContain('Loading 500x300');

    render(template(500, false), el);
    expect(el.textContent).not.toContain('Loading');

    render(nothing, el);
    el.remove();
  });

  // Regression: a template change only reached the slot on the next factory call, which the core's
  // factory gate skips while nothing else about the state changed — so an inline template closing
  // over host state kept showing its first render
  it('re-renders an inline template that closes over changed host state', async () => {
    const el = mountPoint();
    const template = (progress: number) =>
      html`${chart({
        mochartConfig: null, dataProvider: null, loading: true, width: 400, height: 300,
        loadingTemplate: ({ width }: PlaceholderProps) => html`<div>Loading ${progress}% at ${width}</div>`
      })}`;

    render(template(10), el);
    await flushMount();
    expect(el.textContent).toContain('Loading 10% at 400');

    render(template(60), el);
    expect(el.textContent).toContain('Loading 60% at 400');
    expect(el.textContent).not.toContain('10%');

    render(nothing, el);
    el.remove();
  });

  it('renders configErrorTemplate when the config fails validation', async () => {
    const mochartConfig = enhanceConfig({ ...rawConfig(), unknownExtra: 1 });
    expect(mochartConfig.validation.valid).toBe(false);
    const configErrorTemplate = ({ width, height }: PlaceholderProps) => html`<div>Bad config ${width}x${height}</div>`;
    const el = mountPoint();
    render(
      html`${chart({
        mochartConfig,
        dataProvider: new ArrayOfObjectsDataProvider(rows),
        configErrorTemplate,
        width: 400,
        height: 300
      })}`,
      el
    );
    await flushMount();

    expect(el.textContent).toContain('Bad config 400x300');

    render(nothing, el);
    el.remove();
  });
});

describe('defaultChart', () => {
  it('enhances a raw config and updates data and structural config', async () => {
    const el = mountPoint();
    const template = (data: any[], config = rawConfig()) => html`${defaultChart({ config, data, width: 400, height: 300 })}`;

    render(template(rows), el);
    await flushMount();

    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Test Chart');
    expect(el.textContent).not.toContain('D');

    render(template([...rows, { name: 'D', period: 'P4', value: 40 }]), el);
    expect(el.textContent).toContain('D');

    render(template(rows, rawConfig('period')), el);
    expect(el.textContent).toContain('P1');
    expect(el.textContent).not.toContain('A');

    render(nothing, el);
    expect(el.querySelector('svg')).toBeNull();
    el.remove();
  });

  it('accepts the loading prop and renders loadingTemplate over the chart', async () => {
    const loadingTemplate = () => html`<div>Loading</div>`;
    const el = mountPoint();
    const template = (loading: boolean) =>
      html`${defaultChart({ config: rawConfig(), data: rows, loading, loadingTemplate, width: 400, height: 300 })}`;

    render(template(true), el);
    await flushMount();

    // the loading overlay factory receives the plot-area bounds, not the outer size
    expect(el.textContent).toContain('Loading');

    render(template(false), el);
    expect(el.textContent).not.toContain('Loading');

    render(nothing, el);
    el.remove();
  });
});

// Regression: clearing the prop left the rendered template alive in its detached container, so its directives were never disconnected.
describe('removed placeholder templates', () => {
  it('clears the placeholder template when the prop is removed', async () => {
    const log = { disconnected: 0 };
    const loadingTemplate = () => html`<div>Custom loading ${trackDisconnect(log)}</div>`;
    const el = mountPoint();
    const template = (extra: Record<string, unknown>) =>
      html`${chart({ mochartConfig: null, dataProvider: null, loading: true, width: 400, height: 300, ...extra })}`;

    render(template({ loadingTemplate }), el);
    await flushMount();
    expect(el.textContent).toContain('Custom loading');
    expect(log.disconnected).toBe(0);

    render(template({}), el);
    expect(el.textContent).not.toContain('Custom loading');
    expect(log.disconnected).toBe(1);

    // the released slot is rebuilt when the prop comes back
    render(template({ loadingTemplate }), el);
    expect(el.textContent).toContain('Custom loading');
    expect(log.disconnected).toBe(1);

    render(nothing, el);
    el.remove();
  });
});

// Regression: a prop absent from the next render kept its previous value.
describe('removed props', () => {
  it('clears the loading state when the prop is removed', async () => {
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const el = mountPoint();
    const template = (extra: Record<string, unknown>) =>
      html`${chart({ mochartConfig, dataProvider, width: 400, height: 300, ...extra })}`;

    render(template({ loading: true }), el);
    await flushMount();
    expect(el.querySelector('.mochart-loading')).not.toBeNull();

    render(template({}), el);
    expect(el.querySelector('.mochart-loading')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();

    render(nothing, el);
    el.remove();
  });
});

describe('refresh', () => {
  it('re-reads in-place data mutations through the chartRef handle', async () => {
    const el = mountPoint();
    const data = [...rows];
    let handle: ChartRef | null = null;
    render(html`${defaultChart({ config: rawConfig(), data, width: 400, height: 300, chartRef: (chartRefValue) => { handle = chartRefValue; } })}`, el);
    await flushMount();
    expect(handle).not.toBeNull();
    expect(el.textContent).toContain('C');
    expect(el.textContent).not.toContain('D');

    data.push({ name: 'D', period: 'P4', value: 40 });
    handle!.refresh();
    expect(el.textContent).toContain('D');
  });

  // Regression: a swapped-out chartRef callback was never told it lost the handle
  it('tells a replaced chartRef callback it lost the handle, like Lit ref()', async () => {
    const el = mountPoint();
    const first: (ChartRef | null)[] = [];
    const second: (ChartRef | null)[] = [];
    const chartFor = (chartRef: (value: ChartRef | null) => void) => html`${defaultChart({ config: rawConfig(), data: rows, width: 400, height: 300, chartRef })}`;
    render(chartFor(value => first.push(value)), el);
    await flushMount();
    render(chartFor(value => second.push(value)), el);
    expect(first).toEqual([expect.any(Object), null]);
    expect(second).toEqual([expect.any(Object)]);
    render(nothing, el);
    expect(second).toEqual([expect.any(Object), null]);
    expect(first).toHaveLength(2);
  });
});

// The callback maps are string-to-string plumbing — a dropped or misspelled row ships and the callback never fires — and core switches behaviour on callback presence, so every row gets a delivery case.
describe('interaction callbacks', () => {
  async function mountCallbacks(callbacks: Record<string, unknown>, config = rawConfig()) {
    const el = mountPoint();
    render(html`${defaultChart({ config, data: rows, width: 400, height: 300, ...callbacks })}`, el);
    await flushMount();
    return { el, dispose: () => { render(nothing, el); } };
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
