// Cartesian series keyboard a11y: interactive series (focusOnClick or onSeriesClick) are buttons with a roving tab stop —
// arrows move in config order, Enter/Space clicks the whole series (categoryIndex -1), followers stay pointer-only, others aria-hidden; the plot rect owns the tooltip, only Escape crosses over.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartSeriesClickPayload } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const rows = [
  { month: 'Jan', s0: 10, s1: 4, s2: 6 },
  { month: 'Feb', s0: 20, s1: 8, s2: 12 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 's0', renderer: 'bar', title: 'Sales' },
      { id: 'S1', property: 's1', renderer: 'bar', title: 'Costs' },
      { id: 'S2', property: 's2', renderer: 'bar', title: 'Profit' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, onSeriesClick?: (payload: ChartSeriesClickPayload) => void): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: 800, height: 600, onSeriesClick }));
  return container;
}

function seriesNodes(container: Element): SVGElement[] {
  // config order: the legend also carries data-series-id, so scope to the series groups
  return ['S0', 'S1', 'S2']
    .map(id => container.querySelector<SVGElement>(getCssSelector('seriesContainer') + ' g[data-series-id="' + id + '"]'))
    .filter((node): node is SVGElement => node !== null);
}

function plotRect(container: Element): SVGElement {
  return container.querySelector<SVGElement>(getCssSelector('seriesBackground') + ' rect')!;
}

function announcement(container: Element): string {
  return container.querySelector('[role="status"]')?.textContent ?? '';
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

describe('cartesian series keyboard semantics', () => {
  it('exposes clickable series as buttons with one roving tab stop', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = seriesNodes(container);
    expect(items.length).toBe(3);
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('button');
      expect(item.getAttribute('aria-hidden')).toBeNull();
    }
    expect(items.map(item => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(items[0].getAttribute('aria-label')).toBe('Sales');
  });

  it('keeps non-clickable series hidden and unfocusable', () => {
    const container = mountChart(makeConfig());
    expect(seriesNodes(container).length).toBe(0);
    const groups = container.querySelectorAll(getDescendantCssSelector('seriesContainer', 'series'));
    expect(groups.length).toBe(3);
    for (const group of groups) {
      expect(group.getAttribute('aria-hidden')).toBe('true');
      expect(group.getAttribute('tabindex')).toBeNull();
    }
  });

  it('has no keyboard semantics when chart accessibility is disabled', () => {
    const container = mountChart(makeConfig({ accessibility: { enabled: false } }), () => {});
    expect(seriesNodes(container).length).toBe(0);
    const groups = container.querySelectorAll(getDescendantCssSelector('seriesContainer', 'series'));
    expect(groups.length).toBe(3);
    for (const group of groups) {
      expect(group.getAttribute('aria-hidden')).toBeNull();
      expect(group.getAttribute('tabindex')).toBeNull();
      expect(group.getAttribute('role')).toBeNull();
    }
  });

  it('makes focusOnClick series keyboard-reachable without an onSeriesClick handler', () => {
    const container = mountChart(makeConfig({ seriesDefaults: { focusOnClick: true } }));
    expect(seriesNodes(container).length).toBe(3);
  });

  it('clicks with Enter and Space, reporting the whole-series payload', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const container = mountChart(makeConfig(), payload => clicks.push(payload));
    const items = seriesNodes(container);

    key(items[0], 'Enter');
    key(items[1], ' ');
    expect(clicks).toEqual([
      { seriesId: 'S0', categoryIndex: -1, nearestCategoryIndex: -1 },
      { seriesId: 'S1', categoryIndex: -1, nearestCategoryIndex: -1 }
    ]);
  });

  it('moves focus and the roving tab stop with arrows in config order', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = seriesNodes(container);
    items[0].focus();

    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(seriesNodes(container).map(item => item.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    key(items[1], 'End');
    expect(document.activeElement).toBe(items[2]);

    // clamped at the last series
    key(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);

    key(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
  });

  // Enter on a series used to also open the tooltip at the remembered category; a cartesian series spans every category, so there is none to open at
  it('activates the series only, without opening the tooltip', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const container = mountChart(makeConfig(), payload => clicks.push(payload));
    const items = seriesNodes(container);
    const rect = plotRect(container);

    key(items[0], 'Enter');
    expect(clicks).toEqual([{ seriesId: 'S0', categoryIndex: -1, nearestCategoryIndex: -1 }]);
    expect(rect.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector(getCssSelector('tooltip'))?.textContent ?? '').toBe('');
    // activating a series is not a value readout, so nothing is announced
    expect(announcement(container)).toBe('');

    key(items[1], ' ');
    expect(clicks.length).toBe(2);
    expect(rect.getAttribute('aria-expanded')).toBe('false');

    // and still not once the plot rect has left a remembered category behind
    key(rect, 'Enter');
    key(rect, 'ArrowRight');
    key(rect, 'Escape');
    key(items[0], 'Enter');
    expect(rect.getAttribute('aria-expanded')).toBe('false');
  });

  // the category cursor lives on the plot rect alone — arrows inside the series group are sibling navigation, not a second cursor
  it('steps between series with arrows without moving the open tooltip', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = seriesNodes(container);
    const rect = plotRect(container);

    key(rect, 'Enter');
    const opened = announcement(container);
    expect(rect.getAttribute('aria-expanded')).toBe('true');
    expect(opened).not.toBe('');

    items[0].focus();
    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(announcement(container)).toBe(opened);
  });

  // Escape is not a roving-group key, so it stays forwarded: a keyboard user who opened
  // the tooltip on the plot rect and tabbed on to a series can still dismiss it
  it('closes the tooltip with Escape from a series without taking focus back', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = seriesNodes(container);
    const rect = plotRect(container);

    key(rect, 'Enter');
    expect(rect.getAttribute('aria-expanded')).toBe('true');

    items[0].focus();
    key(items[0], 'Escape');
    expect(rect.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector(getCssSelector('tooltip'))?.textContent ?? '').toBe('');
    expect(document.activeElement).toBe(items[0]);
  });

  it('keeps follower series pointer-only', () => {
    const container = mountChart(makeConfig({
      series: [
        { id: 'S0', property: 's0', renderer: 'bar', title: 'Sales' },
        { id: 'S1', property: 's1', renderer: 'bar', followSeries: 'S0' },
        { id: 'S2', property: 's2', renderer: 'bar', title: 'Profit' }
      ]
    }), () => {});
    const items = seriesNodes(container);
    expect(items.map(item => item.getAttribute('data-series-id'))).toEqual(['S0', 'S2']);
    const follower = container.querySelector(getCssSelector('seriesContainer') + ' ' + getIdCssSelector('series', 'S1'))!;
    expect(follower.getAttribute('aria-hidden')).toBe('true');
    expect(follower.getAttribute('tabindex')).toBeNull();
  });

  it('moves focus to a neighbor series when the focused series is filtered out', () => {
    const container = mountChart(makeConfig(), () => {});
    const handle = lastHandle();
    const items = seriesNodes(container);
    items[1].focus();

    handle.update({ filteredSeriesIds: { S1: true } });
    const remaining = seriesNodes(container);
    expect(remaining.map(item => item.getAttribute('data-series-id'))).toEqual(['S0', 'S2']);
    // the next series in config order inherits focus and the tab stop
    expect(document.activeElement).toBe(remaining[1]);
    expect(remaining[1].getAttribute('tabindex')).toBe('0');
  });

  it('keeps DOM focus on the series when focusing reorders the series nodes', () => {
    const container = mountChart(makeConfig({ seriesDefaults: { focusOnClick: true } }));
    const items = seriesNodes(container);
    items[0].focus();

    // Enter focuses the series; the focused series redraws last, moving its node
    key(items[0], 'Enter');
    expect(document.activeElement).toBe(items[0]);

    // navigation still works from the moved node, in config order
    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
  });

  // the roving series used to announce as bare buttons with no enclosing group, unlike the legend one Tab later
  it('groups the roving series like the legend, named from the accessibility config', () => {
    const container = mountChart(makeConfig(), () => {});
    const group = container.querySelector(getCssSelector('seriesContainer'))!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Chart series');
    // the group is the one the roving items sit in, as in the legend
    expect(seriesNodes(container)[0].closest('[role="group"]')).toBe(group);

    const named = mountChart(makeConfig({ accessibility: { seriesLabel: 'Umsätze' } }), () => {});
    expect(named.querySelector(getCssSelector('seriesContainer'))!.getAttribute('aria-label')).toBe('Umsätze');
  });

  it('leaves the series container unroled when the series are not tab stops', () => {
    for (const container of [mountChart(makeConfig()),
      mountChart(makeConfig({ accessibility: { enabled: false } }), () => {})]) {
      const group = container.querySelector(getCssSelector('seriesContainer'))!;
      expect(group.getAttribute('role')).toBeNull();
      expect(group.getAttribute('aria-label')).toBeNull();
    }
  });
});
