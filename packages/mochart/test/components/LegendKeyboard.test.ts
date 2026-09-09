/**
 * Keyboard accessibility of legend filtering: legend items are buttons with
 * a roving tab stop — one item is Tab-reachable, arrows move between items,
 * Enter/Space toggles like a click, and aria-pressed tracks visibility
 * (pressed = series shown).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const rows = [
  { month: 'Jan', sales: 10, costs: 5, profit: 5 },
  { month: 'Feb', sales: 20, costs: 8, profit: 12 }
];

function makeConfig(legend: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    legend: { visible: true, ...legend },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 'sales' },
      { id: 'S1', property: 'costs' },
      { id: 'S2', property: 'profit' }
    ]
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: 800, height: 600 }));
  return container;
}

function legendItems(container: Element): SVGElement[] {
  return Array.from(container.querySelectorAll<SVGElement>('g[data-series-id]'));
}

function key(target: Element, keyValue: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyValue, bubbles: true, cancelable: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  // jsdom lacks focus() on SVG elements; route it through the shared focus bookkeeping
  const svgProto = SVGElement.prototype as unknown as { focus?: () => void };
  if (typeof svgProto.focus !== 'function') {
    svgProto.focus = HTMLElement.prototype.focus;
  }
});

describe('legend keyboard semantics', () => {
  it('exposes items as toggle buttons with one roving tab stop', () => {
    const container = mountChart(makeConfig());
    const items = legendItems(container);
    expect(items.length).toBe(3);

    for (const item of items) {
      expect(item.getAttribute('role')).toBe('button');
      expect(item.getAttribute('aria-pressed')).toBe('true'); // pressed = shown
    }
    expect(items[0].getAttribute('aria-label')).toBe('Series S0'); // the series title, untruncated
    expect(items.map(item => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    const legend = items[0].parentElement!.closest('[role="group"]');
    expect(legend).not.toBeNull();
    expect(legend!.getAttribute('aria-label')).toBe('Legend');
  });

  it('has no keyboard semantics when clicking does nothing', () => {
    const container = mountChart(makeConfig({ filterOnClick: false, focusOnClick: false }));
    expect(legendItems(container).length).toBe(0);
    expect(container.querySelectorAll('g[tabindex]').length).toBe(0);
  });

  it('has no keyboard semantics when chart accessibility is disabled, but mouse filtering still works', () => {
    const container = mountChart({ ...makeConfig(), accessibility: { enabled: false } });
    expect(legendItems(container).length).toBe(0);
    expect(container.querySelectorAll('g[tabindex], [role], [aria-pressed]').length).toBe(0);

    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(3);
    container.querySelector(getIdCssSelector('legendItem', 'S0'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
  });

  it('toggles filtering with Enter and Space and updates aria-pressed', () => {
    const container = mountChart(makeConfig());
    const first = legendItems(container)[0];

    key(first, 'Enter');
    expect(legendItems(container)[0].getAttribute('aria-pressed')).toBe('false');

    key(legendItems(container)[0], ' ');
    expect(legendItems(container)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('moves focus to a neighbour when the focused legend item disappears', () => {
    // the focused item's node is unmounted when its series leaves; the browser would drop keyboard focus to the body
    const container = mountChart(makeConfig());
    const handle = lastHandle();
    legendItems(container)[1].focus();

    const withoutS1 = makeConfig();
    (withoutS1 as unknown as { series: Record<string, unknown>[] }).series[1].showInLegend = false;
    handle.update({ config: withoutS1, data: rows, width: 800, height: 600 } as DefaultChartProps);

    const remaining = legendItems(container);
    expect(remaining.map(item => item.getAttribute('data-series-id'))).toEqual(['S0', 'S2']);
    // the next item in config order inherits focus and the tab stop
    expect(document.activeElement).toBe(remaining[1]);
    expect(remaining[1].getAttribute('tabindex')).toBe('0');
  });

  it('moves focus and the roving tab stop with arrow keys', () => {
    const container = mountChart(makeConfig());
    const items = legendItems(container);
    items[0].focus();

    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(legendItems(container).map(item => item.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    key(items[1], 'End');
    expect(document.activeElement).toBe(items[2]);

    // clamped at the last item
    key(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);

    key(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
    expect(legendItems(container).map(item => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
});
