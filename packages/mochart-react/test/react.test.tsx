import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act, createContext, useContext, useEffect } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Root } from 'react-dom/client';
import { enhanceConfig, ArrayOfObjectsDataProvider } from '@mochart/core';
import { Chart, DefaultChart } from '../src/index';
import type { ChartRef } from '../src/index';

declare global {
   
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function host(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, root: createRoot(container) };
}

describe('Chart', () => {
  it('mounts an svg chart, applies prop updates, and cleans up on unmount', () => {
    const { container, root } = host();
    const mochartConfig = enhanceConfig(rawConfig());
    expect(mochartConfig.validation.valid).toBe(true);
    const dataProvider = new ArrayOfObjectsDataProvider(rows);

    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={400} height={300} />);
    });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('400');
    expect(svg!.getAttribute('height')).toBe('300');
    expect(container.textContent).toContain('Test Chart');

    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={500} height={300} />);
    });
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('500');

    act(() => {
      root.unmount();
    });
    expect(container.querySelector('svg')).toBeNull();
    container.remove();
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
      const { container, root } = host();
      act(() => {
        root.render(<DefaultChart config={rawConfig()} data={rows} />);
      });
      const svg = container.querySelector('svg');
      expect(svg!.getAttribute('width')).toBe('320');
      expect(svg!.getAttribute('height')).toBe('240');

      widthSpy.mockReturnValue(500);
      heightSpy.mockReturnValue(400);
      for (const { callback } of observed) {
        callback([], undefined as any);
      }
      expect(svg!.getAttribute('width')).toBe('500');
      expect(svg!.getAttribute('height')).toBe('400');

      act(() => {
        root.unmount();
      });
      container.remove();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
      delete (globalThis as any).ResizeObserver;
    }
  });

  it('ignores the transform-scaled client rect when measuring the container', () => {
    // a mount during e.g. a dialog's scale(0.95) entry animation: the rect is
    // scaled, the layout size is not — and no resize event ever corrects it
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 380, height: 285 } as DOMRect);
    try {
      const { container, root } = host();
      act(() => {
        root.render(<DefaultChart config={rawConfig()} data={rows} />);
      });
      const svg = container.querySelector('svg');
      expect(svg!.getAttribute('width')).toBe('400');
      expect(svg!.getAttribute('height')).toBe('300');

      act(() => {
        root.unmount();
      });
      container.remove();
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
      rectSpy.mockRestore();
    }
  });
});

describe('placeholder components', () => {
  it('renders loadingComponent with the chart context, updates it, and removes it', () => {
    const { container, root } = host();
    function Loading({ width, height }: { width?: number; height?: number }) {
      return <div>Loading {width}x{height}</div>;
    }

    act(() => {
      root.render(
        <Chart mochartConfig={null} dataProvider={null} loading loadingComponent={Loading} width={400} height={300} />
      );
    });
    expect(container.textContent).toContain('Loading 400x300');

    act(() => {
      root.render(
        <Chart mochartConfig={null} dataProvider={null} loading loadingComponent={Loading} width={500} height={300} />
      );
    });
    expect(container.textContent).toContain('Loading 500x300');

    act(() => {
      root.render(
        <Chart
          mochartConfig={null}
          dataProvider={null}
          loading={false}
          loadingComponent={Loading}
          width={500}
          height={300}
        />
      );
    });
    expect(container.textContent).not.toContain('Loading');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  // Regression: the portal kept rendering into the detached slot container after the chart left the
  // state, so the placeholder's effects kept running and its stale instance came back on re-entry
  it('unmounts the placeholder when the chart leaves the state and remounts it fresh on re-entry', async () => {
    const { container, root } = host();
    const log: string[] = [];
    function Loading() {
      useEffect(() => {
        log.push('mount');
        return () => { log.push('unmount'); };
      }, []);
      return <div>Loading…</div>;
    }
    const render = (loading: boolean) => act(async () => {
      root.render(<DefaultChart config={rawConfig()} data={rows} loading={loading} loadingComponent={Loading} width={400} height={300} />);
    });

    await render(true);
    expect(container.textContent).toContain('Loading…');
    expect(log).toEqual(['mount']);

    await render(false);
    expect(container.textContent).not.toContain('Loading…');
    expect(log).toEqual(['mount', 'unmount']);

    await render(true);
    expect(container.textContent).toContain('Loading…');
    expect(log).toEqual(['mount', 'unmount', 'mount']);

    await act(async () => { root.unmount(); });
    expect(log).toEqual(['mount', 'unmount', 'mount', 'unmount']);
    container.remove();
  });

  it('renders configErrorComponent when the config fails validation', () => {
    const { container, root } = host();
    const mochartConfig = enhanceConfig({ ...rawConfig(), unknownExtra: 1 });
    expect(mochartConfig.validation.valid).toBe(false);
    function ConfigError({ width, height }: { width?: number; height?: number }) {
      return <div>Bad config {width}x{height}</div>;
    }

    act(() => {
      root.render(
        <Chart
          mochartConfig={mochartConfig}
          dataProvider={new ArrayOfObjectsDataProvider(rows)}
          configErrorComponent={ConfigError}
          width={400}
          height={300}
        />
      );
    });
    expect(container.textContent).toContain('Bad config 400x300');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  // Placeholders render through portals in the host tree, so they inherit the
  // app's context providers — and follow provider updates.
  it('gives placeholders the host tree context, including provider updates', () => {
    const { container, root } = host();
    const ThemeContext = createContext('light');
    function Loading() {
      return <div>Theme: {useContext(ThemeContext)}</div>;
    }

    act(() => {
      root.render(
        <ThemeContext.Provider value="dark">
          <Chart mochartConfig={null} dataProvider={null} loading loadingComponent={Loading} width={400} height={300} />
        </ThemeContext.Provider>
      );
    });
    expect(container.textContent).toContain('Theme: dark');

    act(() => {
      root.render(
        <ThemeContext.Provider value="sepia">
          <Chart mochartConfig={null} dataProvider={null} loading loadingComponent={Loading} width={400} height={300} />
        </ThemeContext.Provider>
      );
    });
    expect(container.textContent).toContain('Theme: sepia');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe('DefaultChart', () => {
  it('enhances a raw config and updates data and structural config', () => {
    const { container, root } = host();

    act(() => {
      root.render(<DefaultChart config={rawConfig()} data={rows} width={400} height={300} />);
    });
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('Test Chart');
    expect(container.textContent).not.toContain('D');

    act(() => {
      root.render(
        <DefaultChart config={rawConfig()} data={[...rows, { name: 'D', period: 'P4', value: 40 }]} width={400} height={300} />
      );
    });
    expect(container.textContent).toContain('D');

    act(() => {
      root.render(<DefaultChart config={rawConfig('period')} data={rows} width={400} height={300} />);
    });
    expect(container.textContent).toContain('P1');
    expect(container.textContent).not.toContain('A');

    act(() => {
      root.unmount();
    });
    expect(container.querySelector('svg')).toBeNull();
    container.remove();
  });

  it('accepts the loading prop and renders loadingComponent over the chart', () => {
    const { container, root } = host();
    function Loading({ width, height }: { width?: number; height?: number }) {
      return <div>Loading {width}x{height}</div>;
    }

    act(() => {
      root.render(
        <DefaultChart config={rawConfig()} data={rows} loading loadingComponent={Loading} width={400} height={300} />
      );
    });
    // the loading overlay factory receives the plot-area bounds, not the outer size
    expect(container.textContent).toContain('Loading');

    act(() => {
      root.render(
        <DefaultChart
          config={rawConfig()}
          data={rows}
          loading={false}
          loadingComponent={Loading}
          width={400}
          height={300}
        />
      );
    });
    expect(container.textContent).not.toContain('Loading');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

// Regression: the core handle merged partial props, so a prop absent from the
// next render kept its previous value instead of being unset.
describe('removed props', () => {
  it('clears the loading state when the prop is removed', () => {
    const { container, root } = host();
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);

    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} loading width={400} height={300} />);
    });
    expect(container.querySelector('.mochart-loading')).not.toBeNull();

    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={400} height={300} />);
    });
    expect(container.querySelector('.mochart-loading')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('falls back to the built-in placeholder when the component prop is removed', () => {
    const { container, root } = host();
    function Loading() {
      return <div>Custom loading</div>;
    }

    act(() => {
      root.render(<Chart mochartConfig={null} dataProvider={null} loading loadingComponent={Loading} width={400} height={300} />);
    });
    expect(container.textContent).toContain('Custom loading');

    act(() => {
      root.render(<Chart mochartConfig={null} dataProvider={null} loading width={400} height={300} />);
    });
    expect(container.textContent).not.toContain('Custom loading');
    expect(container.querySelector('.mochart-loading')).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

// Regression: the user's container style used to override the explicit size
// props; the size props must win, like in the other bindings.
describe('dataTestId', () => {
  it('applies and removes data-testid on the container div', () => {
    const { container, root } = host();
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={400} height={300} dataTestId="revenue-chart" />);
    });
    const containerDiv = container.firstElementChild as HTMLDivElement;
    expect(containerDiv.getAttribute('data-testid')).toBe('revenue-chart');
    act(() => {
      root.render(<Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={400} height={300} />);
    });
    expect(containerDiv.getAttribute('data-testid')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe('size props vs container style', () => {
  it('keeps the explicit size when the style sets a conflicting one', () => {
    const { container, root } = host();
    act(() => {
      root.render(<Chart mochartConfig={enhanceConfig(rawConfig())} dataProvider={new ArrayOfObjectsDataProvider(rows)}
        width={400} height={300} style={{ width: '100%', margin: '4px' }} />);
    });
    const containerDiv = container.firstElementChild as HTMLDivElement;
    expect(containerDiv.style.width).toBe('400px');
    expect(containerDiv.style.margin).toBe('4px');
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe('refresh', () => {
  it('re-reads in-place data mutations through the ref handle', () => {
    const { container, root } = host();
    const data = [...rows];
    const ref: { current: ChartRef | null } = { current: null };
    act(() => {
      root.render(<DefaultChart ref={ref} config={rawConfig()} data={data} width={400} height={300} />);
    });
    expect(container.textContent).toContain('C');
    expect(container.textContent).not.toContain('D');

    data.push({ name: 'D', period: 'P4', value: 40 });
    act(() => { ref.current!.refresh(); });
    expect(container.textContent).toContain('D');
    act(() => root.unmount());
  });
});

// The callback maps are string-to-string plumbing — a dropped or misspelled row ships and the callback never fires — and core switches behaviour on callback presence, so every row gets a delivery case.
describe('interaction callbacks', () => {
  function mountWithCallbacks(callbacks: Record<string, unknown>, config = rawConfig()) {
    const { container, root } = host();
    act(() => {
      root.render(<DefaultChart config={config} data={rows} width={400} height={300} {...callbacks} />);
    });
    return { container, root };
  }

  function mouse(target: Element, type: string, clientX: number, clientY: number) {
    act(() => {
      target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
    });
  }

  it('delivers onSeriesLayoutBoundsChange on mount', () => {
    const onSeriesLayoutBoundsChange = vi.fn();
    const { root } = mountWithCallbacks({ onSeriesLayoutBoundsChange });
    expect(onSeriesLayoutBoundsChange).toHaveBeenCalled();
    const bounds = onSeriesLayoutBoundsChange.mock.calls[0][0] as { width: number; height: number };
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    act(() => { root.unmount(); });
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
      const { container, root } = mountWithCallbacks(spies);
      const chartRoot = container.querySelector('[data-mochart-version]')!;

      mouse(chartRoot, 'mouseenter', 100, 100);
      expect(spies.onChartMouseEnter).toHaveBeenCalledTimes(1);

      mouse(chartRoot, 'mousemove', 200, 100);
      expect(spies.onChartMouseMove).toHaveBeenCalledTimes(1);

      mouse(chartRoot, 'click', 200, 100);
      expect(spies.onChartClick).toHaveBeenCalledTimes(1);
      expect(spies.onFocus).toHaveBeenCalled();

      mouse(chartRoot, 'mousemove', -10, 100);
      expect(spies.onChartMouseLeave).toHaveBeenCalledTimes(1);

      act(() => { root.unmount(); });
    }
    finally {
      rect.mockRestore();
    }
  });

  it('delivers onTitleClick, and the title becomes a control because the prop is present', () => {
    const onTitleClick = vi.fn();
    const { container, root } = mountWithCallbacks({ onTitleClick });
    const title = container.querySelector('.mochart-title')!;
    // presence-driven rendering: without the prop this is not a button at all
    expect(title.getAttribute('role')).toBe('button');
    act(() => { title.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onTitleClick).toHaveBeenCalledTimes(1);
    act(() => { root.unmount(); });
  });

  it('delivers onSeriesFilter from a legend click', () => {
    const onSeriesFilter = vi.fn();
    const { container, root } = mountWithCallbacks({ onSeriesFilter },
      { ...rawConfig(), legend: { visible: true } });
    const legendItem = container.querySelector('.mochart-legend-item')!;
    act(() => { legendItem.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onSeriesFilter).toHaveBeenCalledTimes(1);
    act(() => { root.unmount(); });
  });

  it('delivers onSeriesClick from a series click', () => {
    const onSeriesClick = vi.fn();
    const { container, root } = mountWithCallbacks({ onSeriesClick });
    const shape = container.querySelector('.mochart-series path, .mochart-series rect')!;
    act(() => { shape.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onSeriesClick).toHaveBeenCalledTimes(1);
    act(() => { root.unmount(); });
  });

  it('delivers onSliceClick from a pie slice click', () => {
    const onSliceClick = vi.fn();
    const { container, root } = mountWithCallbacks({ onSliceClick },
      { ...rawConfig(), chart: { type: 'pie' } });
    const slice = container.querySelector('.mochart-series path')!;
    act(() => { slice.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onSliceClick).toHaveBeenCalledTimes(1);
    act(() => { root.unmount(); });
  });
});

describe('hydration', () => {
  it('hydrates server output without warnings and mounts the chart in the browser', () => {
    const mochartConfig = enhanceConfig(rawConfig());
    const dataProvider = new ArrayOfObjectsDataProvider(rows);
    const element = <Chart mochartConfig={mochartConfig} dataProvider={dataProvider} width={400} height={300} />;
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(element);
    expect(container.querySelector('svg')).toBeNull();

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root!: Root;
    act(() => {
      root = hydrateRoot(container, element);
    });
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('Test Chart');
    errors.mockRestore();
    act(() => { root.unmount(); });
    container.remove();
  });
});
