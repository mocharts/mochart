/**
 * Arbitration of the chart's error/loading/no-data states: error wins over the loading overlay, and
 * "a provided error (including '' or 0) is the error state; null/undefined are not".
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createChart, createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import { enhanceConfig } from '../../src/config/helper';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import type { ChartFactoryContext, DefaultChartProps, ManagedChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssClass, getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{ property: 'sales' }]
} as unknown as MochartInputConfig;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 }
];

function mountChart(extra: Partial<DefaultChartProps>): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...extra
  } as DefaultChartProps));
  return container;
}

const stateClassPattern = new RegExp('(' + [getCssClass('loading'), getCssClass('noData'), getCssClass('error')].join('|') + ')');

function stateClasses(container: Element): string[] {
  return [...container.querySelectorAll('[class]')]
    .map(el => el.getAttribute('class')!)
    .filter(c => stateClassPattern.test(c));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('chart state arbitration', () => {
  it('renders a normal chart with neither error nor loading', () => {
    const container = mountChart({});
    expect(stateClasses(container)).toEqual([]);
    expect(container.querySelector('path, rect' + getCssSelector('seriesBar') + ', svg')).not.toBeNull();
  });

  it('shows the loading overlay while loading', () => {
    const container = mountChart({ loading: true });
    expect(stateClasses(container)).toEqual([getCssClass('loading')]);
    expect(container.textContent).toContain('Loading...');
  });

  it('shows the error content in its own slot class for an error', () => {
    const container = mountChart({ error: 'boom' });
    expect(stateClasses(container)).toEqual([getCssClass('error')]);
    expect(container.textContent).toContain('boom');
  });

  it('lets the error state win when error and loading are both set', () => {
    const container = mountChart({ error: 'boom', loading: true });
    expect(stateClasses(container)).toEqual([getCssClass('error')]);
    expect(container.textContent).toContain('boom');
    expect(container.textContent).not.toContain('Loading...');
  });

  it('treats explicitly provided falsy errors as the error state', () => {
    expect(stateClasses(mountChart({ error: '' }))).toEqual([getCssClass('error')]);
    const zeroError = mountChart({ error: 0 });
    expect(stateClasses(zeroError)).toEqual([getCssClass('error')]);
    expect(zeroError.textContent).toContain('0');
  });

  it('does not enter the error state for null or undefined', () => {
    expect(stateClasses(mountChart({ error: null }))).toEqual([]);
    expect(stateClasses(mountChart({ error: undefined }))).toEqual([]);
  });

  it('shows the message of an Error instance', () => {
    const container = mountChart({ error: new Error('fetch failed') });
    expect(stateClasses(container)).toEqual([getCssClass('error')]);
    expect(container.textContent).toContain('fetch failed');
    expect(container.textContent).not.toContain('{}');
  });

  it('renders plain error objects as JSON and survives circular ones', () => {
    expect(mountChart({ error: { code: 500 } }).textContent).toContain('{"code":500}');
    const circular: Record<string, unknown> = { code: 500 };
    circular.self = circular;
    const container = mountChart({ error: circular });
    expect(stateClasses(container)).toEqual([getCssClass('error')]);
    expect(container.textContent).toContain('[object Object]');
  });
});

// Regression: the internal read delegate reached the factories, losing instanceof, refresh() and custom members
describe('the provider handed to the state factories', () => {
  class CountingProvider extends ArrayOfObjectsDataProvider {
    readonly label = 'mine';
    rowCount(): number {
      return this.getPropertyValues('month')!.length;
    }
  }

  function seenProvider(): unknown {
    let seen: unknown = 'NOT CALLED';
    const container = mountContainer();
    trackHandle(createChart(container, {
      mochartConfig: enhanceConfig(config),
      dataProvider: new CountingProvider(rows),
      width: WIDTH,
      height: HEIGHT,
      error: 'boom',
      getErrorComponent: (context: ChartFactoryContext) => {
        seen = context.dataProvider;
        return 'error';
      }
    } as unknown as ManagedChartProps));
    return seen;
  }

  it('is the host\'s own provider', () => {
    const seen = seenProvider();
    expect(seen).toBeInstanceOf(CountingProvider);
    expect((seen as CountingProvider).label).toBe('mine');
    expect((seen as CountingProvider).rowCount()).toBe(rows.length);
  });
});

// Regression: style was a default parameter, so any caller value replaced the position: relative the tooltip needs
describe('the chart root position', () => {
  function rootStyle(style?: unknown): CSSStyleDeclaration {
    const container = mountChart(style === undefined ? {} : { style } as Partial<DefaultChartProps>);
    return (container.querySelector(getCssSelector('chart')) as HTMLElement).style;
  }

  it('is relative by default', () => {
    expect(rootStyle().position).toBe('relative');
  });

  it('survives a caller style that says nothing about position', () => {
    expect(rootStyle({ background: '#fff' }).position).toBe('relative');
    expect(rootStyle('background: #fff').position).toBe('relative');
    expect(rootStyle('').position).toBe('relative');
  });

  it('keeps the caller style alongside it', () => {
    expect(rootStyle({ background: '#fff' }).background).toContain('255');
    expect(rootStyle('background: #fff').background).toContain('255');
  });

  // any non-static value is a containing block, so an explicit one still wins
  it('lets an explicit position win', () => {
    expect(rootStyle({ position: 'absolute' }).position).toBe('absolute');
    expect(rootStyle('position: sticky').position).toBe('sticky');
  });
});

describe('the no-size state', () => {
  function chartSvg(width: number, height: number): SVGSVGElement | null {
    return mountChart({ width, height } as Partial<DefaultChartProps>).querySelector('svg');
  }

  it('renders the chart at a positive size', () => {
    const svg = chartSvg(WIDTH, HEIGHT);
    expect(svg?.getAttribute('width')).toBe(String(WIDTH));
  });

  // Regression: the root message tracked one inserted node, and inserting a fragment empties it, so every
  // resync appended another copy of the factory's content and left the previous one in place
  it('replaces, not stacks, a fragment returned by the factory across resyncs', () => {
    const container = mountContainer();
    const getNoSizeComponent = () => {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(document.createTextNode('no '));
      fragment.appendChild(document.createTextNode('size'));
      return fragment;
    };
    const handle = trackHandle(createDefaultChart(container, {
      config, data: rows, width: 100, height: 0, getNoSizeComponent
    } as DefaultChartProps));
    expect(container.textContent).toBe('no size');
    handle.update({ width: 200 });
    handle.update({ width: 300 });
    expect(container.textContent).toBe('no size');
    handle.update({ height: HEIGHT });
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toContain('no size');
  });

  // Regression: only an exact 0 took the no-size route, so negative and non-finite sizes reached the svg
  it('takes the no-size route for any non-positive or non-finite size', () => {
    for (const [width, height] of [[0, HEIGHT], [WIDTH, 0], [-100, -50], [NaN, HEIGHT], [WIDTH, NaN]]) {
      expect(chartSvg(width, height), `${width}x${height}`).toBeNull();
    }
  });
});

// Regression: only a config going away was structural, so one arriving after mount (bindings while loading) threw
describe('a mochartConfig arriving after mount', () => {
  function mountManaged(props: Partial<ManagedChartProps>): { container: Element; handle: ChartHandle<ManagedChartProps> } {
    const container = mountContainer();
    const handle = trackHandle(createChart(container, {
      mochartConfig: null, dataProvider: null, width: WIDTH, height: HEIGHT, ...props
    } as unknown as ManagedChartProps));
    return { container, handle };
  }

  const enhanced = () => enhanceConfig(config);
  const provider = () => new ArrayOfObjectsDataProvider(rows);
  const seriesCount = (container: Element) => container.querySelectorAll(getCssSelector('series')).length;

  it('renders the series once the config and provider arrive', () => {
    const { container, handle } = mountManaged({ loading: true });
    expect(seriesCount(container)).toBe(0);

    handle.update({ mochartConfig: enhanced(), dataProvider: provider(), loading: false });
    expect(seriesCount(container)).toBe(1);
  });

  it('survives the config going away and coming back', () => {
    const { container, handle } = mountManaged({});
    handle.update({ mochartConfig: enhanced(), dataProvider: provider() });
    expect(seriesCount(container)).toBe(1);

    handle.update({ mochartConfig: null, dataProvider: null, loading: true });
    expect(seriesCount(container)).toBe(0);

    handle.update({ mochartConfig: enhanced(), dataProvider: provider(), loading: false });
    expect(seriesCount(container)).toBe(1);
  });

  it('accepts the arriving config through replace()', () => {
    const { container, handle } = mountManaged({});
    handle.replace({
      mochartConfig: enhanced(), dataProvider: provider(), width: WIDTH, height: HEIGHT
    } as unknown as ManagedChartProps);
    expect(seriesCount(container)).toBe(1);
  });
});
