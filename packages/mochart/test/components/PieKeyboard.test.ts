/**
 * Keyboard accessibility of pie slices: interactive slices (focusOnClick or an
 * onSliceClick handler) are buttons with a roving tab stop — arrows move
 * between slices in config order (the DOM is focus-ordered, so it cannot drive
 * navigation), Enter/Space clicks, and the slice keeps DOM focus even when
 * focusing reorders the slice nodes. Non-interactive slices stay aria-hidden.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartSliceClickPayload } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const rows = [{ category: 'total', s0: 30, s1: 50, s2: 20 }];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    chart: { type: 'pie' },
    categoryAxis: { property: 'category', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 's0', title: 'Subscriptions' },
      { id: 'S1', property: 's1', title: 'Services' },
      { id: 'S2', property: 's2', title: 'Hardware' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, onSliceClick?: (payload: ChartSliceClickPayload) => void): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: 800, height: 600, onSliceClick }));
  return container;
}

function slices(container: Element): SVGElement[] {
  // config order: the legend also carries data-series-id, so scope to the slice groups
  return ['S0', 'S1', 'S2']
    .map(id => container.querySelector<SVGElement>(getCssSelector('seriesContainer') + ' g[data-series-id="' + id + '"]'))
    .filter((node): node is SVGElement => node !== null);
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

describe('pie slice keyboard semantics', () => {
  it('exposes interactive slices as buttons with one roving tab stop', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = slices(container);
    expect(items.length).toBe(3);
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('button');
      expect(item.getAttribute('aria-hidden')).toBeNull();
    }
    expect(items.map(item => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    const label = items[0].getAttribute('aria-label')!;
    expect(label).toContain('Subscriptions');
    expect(label).toContain('%');
  });

  // Regression: untitled slices were announced by raw id ("S0, 25%") while the
  // legend says "Series S0" — two names for the same series on one chart.
  it('announces untitled slices with the same name the legend uses', () => {
    const container = mountChart(makeConfig({
      series: [{ id: 'S0', property: 's0' }, { id: 'S1', property: 's1' }, { id: 'S2', property: 's2' }]
    }), () => {});
    const label = slices(container)[0].getAttribute('aria-label')!;
    expect(label.startsWith('Series S0, ')).toBe(true);
  });

  it('keeps non-interactive slices hidden and unfocusable', () => {
    const container = mountChart(makeConfig());
    expect(slices(container).length).toBe(0);
    const sliceGroups = container.querySelectorAll(getDescendantCssSelector('seriesContainer', 'series'));
    expect(sliceGroups.length).toBe(3);
    for (const group of sliceGroups) {
      expect(group.getAttribute('aria-hidden')).toBe('true');
      expect(group.getAttribute('tabindex')).toBeNull();
    }
  });

  it('keeps follower slices pointer-only', () => {
    const container = mountChart(makeConfig({
      series: [
        { id: 'S0', property: 's0', title: 'Subscriptions' },
        { id: 'S1', property: 's1', followSeries: 'S0' },
        { id: 'S2', property: 's2', title: 'Hardware' }
      ]
    }), () => {});
    // the follower activates its leader, so a tab stop of its own would put the leader in the order twice
    expect(slices(container).map(item => item.getAttribute('data-series-id'))).toEqual(['S0', 'S2']);
    const follower = container.querySelector(getCssSelector('seriesContainer') + ' ' + getIdCssSelector('series', 'S1'))!;
    expect(follower.getAttribute('aria-hidden')).toBe('true');
    expect(follower.getAttribute('tabindex')).toBeNull();
    expect(follower.getAttribute('role')).toBeNull();
    expect(follower.getAttribute('aria-label')).toBeNull();
  });

  it('has no keyboard semantics when chart accessibility is disabled', () => {
    const container = mountChart(makeConfig({ chart: { type: 'pie' }, accessibility: { enabled: false } }), () => {});
    expect(slices(container).length).toBe(0);
    const sliceGroups = container.querySelectorAll(getDescendantCssSelector('seriesContainer', 'series'));
    expect(sliceGroups.length).toBe(3);
    for (const group of sliceGroups) {
      expect(group.getAttribute('aria-hidden')).toBeNull();
      expect(group.getAttribute('tabindex')).toBeNull();
      expect(group.getAttribute('role')).toBeNull();
    }
  });

  it('clicks with Enter and Space', () => {
    const clicks: string[] = [];
    const container = mountChart(makeConfig(), (payload) => clicks.push(payload.seriesId));
    const items = slices(container);

    key(items[0], 'Enter');
    key(items[1], ' ');
    expect(clicks).toEqual(['S0', 'S1']);
  });

  it('moves focus and the roving tab stop with arrows in config order', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = slices(container);
    items[0].focus();

    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(slices(container).map(item => item.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    key(items[1], 'End');
    expect(document.activeElement).toBe(items[2]);

    // clamped at the last slice
    key(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);

    key(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
  });

  // Regression: Enter synthesized a click at the slice's bbox center, and the
  // chart-level bounds gate swallowed it whenever the center fell outside the
  // series rect (exploded edge slices; jsdom's zero-size bboxes reproduce it) —
  // toggling the focus but leaving the tooltip out of sync.
  // pie deliberately keeps this while cartesian series dropped it: the tooltip Enter opens is the slice's own category
  it('toggles the tooltip with Enter and Space regardless of slice geometry', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = slices(container);
    const rect = container.querySelector<SVGElement>(getCssSelector('seriesBackground') + ' rect')!;

    key(items[0], 'Enter');
    expect(rect.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
    // keyboard activation announces like the plot rect does
    expect(container.querySelector('[role="status"]')?.textContent ?? '').not.toBe('');

    key(items[0], ' ');
    expect(rect.getAttribute('aria-expanded')).toBe('false');
  });

  // Regression: Escape lived only on the plot rect, so a keyboard user whose
  // focus was on a slice could only toggle the tooltip closed with Enter again.
  it('closes the tooltip with Escape from a slice', () => {
    const container = mountChart(makeConfig(), () => {});
    const items = slices(container);
    const rect = container.querySelector<SVGElement>(getCssSelector('seriesBackground') + ' rect')!;

    key(items[0], 'Enter');
    expect(rect.getAttribute('aria-expanded')).toBe('true');

    key(items[0], 'Escape');
    expect(rect.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector(getCssSelector('tooltip'))?.textContent ?? '').toBe('');
  });

  // Regression: filtering out the focused slice detached its node, and the
  // focus-restore skipped disconnected nodes — keyboard focus fell to <body>.
  it('moves focus to a neighbor slice when the focused slice is filtered out', () => {
    const container = mountChart(makeConfig(), () => {});
    const handle = lastHandle();
    const items = slices(container);
    items[1].focus();

    handle.update({ filteredSeriesIds: { S1: true } });
    const remaining = slices(container);
    expect(remaining.map(item => item.getAttribute('data-series-id'))).toEqual(['S0', 'S2']);
    // the next slice in config order inherits focus and the tab stop
    expect(document.activeElement).toBe(remaining[1]);
    expect(remaining[1].getAttribute('tabindex')).toBe('0');

    // filtering the last remaining follower falls back to the preceding slice
    handle.update({ filteredSeriesIds: { S1: true, S2: true } });
    expect((document.activeElement as Element | null)?.getAttribute('data-series-id')).toBe('S0');
  });

  it('keeps DOM focus on the slice when focusing reorders the slice nodes', () => {
    const container = mountChart(makeConfig({ seriesDefaults: { focusOnClick: true } }));
    const items = slices(container);
    items[0].focus();

    // Enter focuses the series; the focused slice redraws last, moving its node
    key(items[0], 'Enter');
    expect(document.activeElement).toBe(items[0]);

    // navigation still works from the moved node, in config order
    key(items[0], 'ArrowRight');
    expect(document.activeElement).toBe(items[1]);
  });

  // Regression: slices announced bare ("Subscriptions, 30%, button") while the legend announced as a named group
  it('groups the roving slices like the legend, named from the accessibility config', () => {
    const container = mountChart(makeConfig(), () => {});
    const group = container.querySelector(getCssSelector('seriesContainer'))!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Chart series'); // slices are series
    expect(slices(container)[0].closest('[role="group"]')).toBe(group);

    const named = mountChart(makeConfig({ accessibility: { seriesLabel: 'Anteile' } }), () => {});
    expect(named.querySelector(getCssSelector('seriesContainer'))!.getAttribute('aria-label')).toBe('Anteile');
  });

  it('leaves the slice container unroled when the slices are not tab stops', () => {
    for (const container of [mountChart(makeConfig()),
      mountChart(makeConfig({ accessibility: { enabled: false } }), () => {})]) {
      const group = container.querySelector(getCssSelector('seriesContainer'))!;
      expect(group.getAttribute('role')).toBeNull();
      expect(group.getAttribute('aria-label')).toBeNull();
    }
  });
});
