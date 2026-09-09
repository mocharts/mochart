/**
 * Per-category shape records: bars, markers and labels keep the same key, class name and handler
 * functions across syncs (no per-frame closures or strings), while still routing to the series'
 * current callbacks.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { CategoryShapeCache } from '../../src/utils/CategoryShapes';
import type { CategoryCallbacks, CategoryShape } from '../../src/utils/CategoryShapes';
import type { ChartFocus, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getIdCssSelector, mochartCssClasses } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];
const otherRows = [
  { month: 'Jan', sales: 15 },
  { month: 'Feb', sales: 25 },
  { month: 'Mar', sales: 35 }
];

function makeConfig(seriesOverrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 'sales', property: 'sales', renderer: 'bar', marker: { shape: 'circle' }, labelProperty: 'sales', ...seriesOverrides }]
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, callbacks: Partial<DefaultChartProps> = {}) {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return { container, handle };
}

/** the handlers the render layer has registered on a shape, keyed by event type */
function listeners(shape: Element): Record<string, EventListener | null | undefined> {
  return (shape as Element & { _listeners?: Record<string, EventListener | null | undefined> })._listeners ?? {};
}

function shape(container: Element, classKey: 'seriesBar' | 'seriesMarker' | 'seriesLabel', index: number): Element {
  const node = container.querySelector(getIdCssSelector(classKey, index));
  expect(node, classKey + ' ' + index).not.toBeNull();
  return node!;
}

function mouse(target: Element, type: string): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('CategoryShapeCache', () => {
  it('returns the same record per index, keyed and classed by that index, and calls the current callbacks', () => {
    const first: CategoryCallbacks = { onCategoryEnter: vi.fn(), onCategoryLeave: vi.fn(), onCategoryClick: vi.fn() };
    const second: CategoryCallbacks = { onCategoryEnter: vi.fn(), onCategoryLeave: vi.fn(), onCategoryClick: vi.fn() };
    let current = first;
    const cache = new CategoryShapeCache('seriesBar', () => current);

    const shape = cache.get(2);
    expect(cache.get(2)).toBe(shape);
    expect(cache.get(1)).not.toBe(shape);
    expect(shape.key).toBe(2);
    expect(shape.className).toBe(mochartCssClasses['seriesBar'] + 2);

    const event = new Event('click');
    shape.onPointerEnter(event);
    expect(first.onCategoryEnter).toHaveBeenCalledWith(2);

    current = second;
    shape.onClick(event);
    expect(second.onCategoryClick).toHaveBeenCalledWith(2, event);
    expect(first.onCategoryClick).not.toHaveBeenCalled();
  });

  it('extends each record once through the given factory', () => {
    const callbacks: CategoryCallbacks = { onCategoryEnter: vi.fn(), onCategoryLeave: vi.fn(), onCategoryClick: vi.fn() };
    const extend = vi.fn((shape: CategoryShape) => ({ ...shape, text: '' }));
    const cache = new CategoryShapeCache('seriesLabel', () => callbacks, extend);

    const label = cache.get(0);
    label.text = 'a';
    expect(cache.get(0).text).toBe('a');
    expect(extend).toHaveBeenCalledTimes(1);
  });
});

describe('series shape handlers across syncs', () => {
  it('keeps the same handler functions on bars, markers and labels through a data update', () => {
    const { container, handle } = mountChart(makeConfig({ focusCategoryOnHover: true, focusCategoryOnClick: true }));
    const before = (['seriesBar', 'seriesMarker', 'seriesLabel'] as const).map(key => ({ ...listeners(shape(container, key, 1)) }));

    handle.update({ data: otherRows } as Partial<DefaultChartProps>);

    (['seriesBar', 'seriesMarker', 'seriesLabel'] as const).forEach((key, i) => {
      const after = listeners(shape(container, key, 1));
      expect(after.pointerenter, key).toBe(before[i].pointerenter);
      expect(after.pointerleave, key).toBe(before[i].pointerleave);
      expect(after.click, key).toBe(before[i].click);
    });
  });

  it('routes through the same handlers to callbacks rebuilt by a config change', () => {
    const focuses: ChartFocus[] = [];
    const { container, handle } = mountChart(makeConfig(), { onFocus: focus => focuses.push(focus) });
    const bar = shape(container, 'seriesBar', 1);
    const handler = listeners(bar).pointerenter;

    // no hover focus configured: the handler is wired but the series callback is a no-op
    mouse(bar, 'pointerenter');
    expect(focuses).toEqual([]);

    handle.update({ config: makeConfig({ focusCategoryOnHover: true }) } as Partial<DefaultChartProps>);

    expect(listeners(shape(container, 'seriesBar', 1)).pointerenter).toBe(handler);
    mouse(shape(container, 'seriesBar', 1), 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: 1 });
  });
});
