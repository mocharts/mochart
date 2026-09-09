/**
 * Keyboard accessibility of the tooltip: per-series and category rows are
 * buttons with a roving tab stop whenever clicking them does something —
 * arrows move between rows, Enter/Space acts like a click, aria-pressed
 * tracks filtering (pressed = series shown) — and Escape anywhere inside
 * the tooltip closes it and hands focus back to the plot tab stop.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartFocus, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getIdCssClass, getCssSelector, getDescendantCssSelector, getCssClassMatchSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';
import { focusRestoredAttribute } from '../../src/utils/utils';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

function makeConfig(tooltip: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    tooltip,
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 'sales' },
      { id: 'S1', property: 'costs' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, callbacks: Partial<DefaultChartProps> = {}): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return container;
}

function chartRoot(container: Element): Element {
  return container.querySelector(getChartRootCssSelector())!;
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

function openTooltip(container: Element): void {
  const root = chartRoot(container);
  mouse(root, 'mouseenter', 100, 100);
  mouse(root, 'click', 100, 100);
  expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
}

/** interactive rows of the visible tooltip copy, in DOM order */
function liveText(container: Element): string {
  return container.querySelector('[role="status"]')?.textContent ?? '';
}

function tooltipRows(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' [data-row-key]'));
}

function key(target: Element, keyValue: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyValue, bubbles: true, cancelable: true }));
}

function modeButton(container: Element): HTMLElement {
  return Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' button'))
    .find(button => button.textContent === 'Filter' || button.textContent === 'Focus')!;
}

beforeAll(() => {
  installSvgMeasurementShims();
  // jsdom lacks focus() on SVG elements; route it through the shared focus bookkeeping
  const svgProto = SVGElement.prototype as unknown as { focus?: () => void };
  if (typeof svgProto.focus !== 'function') {
    svgProto.focus = HTMLElement.prototype.focus;
  }
  // jsdom reports zero-size rects; report the mounted chart size instead so
  // the chart's pointer hit-testing (clientX/Y relative to the plot rect) works
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('tooltip row keyboard semantics', () => {
  it('exposes series rows as toggle buttons with one roving tab stop in filter mode', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const seriesRows = tooltipRows(container);
    // filter mode: the two series rows act, the category row does not
    expect(seriesRows.map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0', 'series-S1']);
    for (const row of seriesRows) {
      expect(row.getAttribute('role')).toBe('button');
      expect(row.getAttribute('aria-pressed')).toBe('true'); // pressed = shown
    }
    expect(seriesRows.map(row => row.getAttribute('tabindex'))).toEqual(['0', '-1']);

    // the hidden sizer copy must not carry tab stops
    expect(container.querySelectorAll(getCssSelector('tooltipSizer') + ' [tabindex], ' + getCssSelector('tooltipSizer') + ' [data-row-key]').length).toBe(0);
  });

  it('has no row semantics when clicking does nothing, or with accessibility disabled', () => {
    const plain = mountChart(makeConfig());
    openTooltip(plain);
    expect(tooltipRows(plain).length).toBe(0);

    const disabled = mountChart(makeConfig({ showControls: true }, { accessibility: { enabled: false } }));
    openTooltip(disabled);
    expect(tooltipRows(disabled).length).toBe(0);
    expect(disabled.querySelectorAll(getCssSelector('tooltip') + ' [tabindex], ' + getCssSelector('tooltip') + ' [role="button"]').length).toBe(0);
  });

  it('takes the control buttons out of the tab order on a decorative-hidden chart', () => {
    const container = mountChart(makeConfig({ showControls: true }, { accessibility: { hidden: true } }));
    openTooltip(container);
    const buttons = Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('makes series rows interactive through filterSeriesOnClick without the controls', () => {
    const container = mountChart(makeConfig({ filterSeriesOnClick: true }));
    openTooltip(container);
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0', 'series-S1']);
  });

  it('toggles filtering with Enter and Space and updates aria-pressed', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
    key(tooltipRows(container)[0], 'Enter');
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(1);
    expect(tooltipRows(container)[0].getAttribute('aria-pressed')).toBe('false');

    key(tooltipRows(container)[0], ' ');
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
    expect(tooltipRows(container)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps keyboard focus inside the tooltip when showFiltered: false unmounts the acted-on row', () => {
    const container = mountChart(makeConfig({ showControls: true, showFiltered: false }));
    openTooltip(container);

    const first = tooltipRows(container)[0];
    first.focus();
    key(first, 'Enter');
    expect(document.activeElement).not.toBe(document.body);
    expect((document.activeElement as HTMLElement).getAttribute('data-row-key')).toBe('series-S1');
    // the same restore is reachable by clicking the row, where :focus-visible never matches, so the moved focus is marked for the stylesheet to ring
    expect((document.activeElement as HTMLElement).hasAttribute(focusRestoredAttribute)).toBe(true);
  });

  // the legend hands a removed item's tab stop to the next item in config order, not the first;
  // filtering a middle row used to send both the tab stop and the focus back to the top row
  it('hands the tab stop and focus to the next row when a middle row is filtered away', () => {
    const container = mountChart(makeConfig({ showControls: true, showFiltered: false }, {
      series: [{ id: 'S0', property: 'sales' }, { id: 'S1', property: 'costs' }, { id: 'S2', property: 'sales' }]
    }));
    openTooltip(container);
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key')))
      .toEqual(['series-S0', 'series-S1', 'series-S2']);

    const middle = tooltipRows(container)[1];
    middle.focus();
    key(middle, 'Enter');

    const remaining = tooltipRows(container);
    expect(remaining.map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0', 'series-S2']);
    expect((document.activeElement as HTMLElement).getAttribute('data-row-key')).toBe('series-S2');
    expect(remaining.find(row => row.getAttribute('tabindex') === '0')!.getAttribute('data-row-key')).toBe('series-S2');
  });

  it('adds the category row and focuses on Enter in focus mode', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modeButton(container).textContent).toBe('Focus');

    const rowKeys = tooltipRows(container).map(row => row.getAttribute('data-row-key'));
    expect(rowKeys).toEqual(['category', 'series-S0', 'series-S1']);
    // focus mode does not filter, so rows lose the toggle-button pressed state
    expect(tooltipRows(container)[1].getAttribute('aria-pressed')).toBeNull();

    key(tooltipRows(container)[1], 'Enter');
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');

    key(tooltipRows(container)[0], 'Enter');
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1); // toggled off (was focused category 0)
  });

  it('focuses the series from hover and keyboard focus in filter mode', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    const rowS0 = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))!;
    rowS0.dispatchEvent(new MouseEvent('pointerenter'));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    rowS0.dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe(null);

    // keyboard focus mirrors hover
    tooltipRows(container)[0].focus();
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    tooltipRows(container)[1].focus(); // focusout clears, focusin refocuses
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');
    (document.activeElement as HTMLElement).blur();
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe(null);
  });

  it('respects series filterable like the legend', () => {
    const container = mountChart(makeConfig({ showControls: true }, {
      series: [
        { id: 'S0', property: 'sales' },
        { id: 'S1', property: 'costs', filterable: false }
      ]
    }));
    openTooltip(container);

    // filter mode: the non-filterable series' row is not interactive
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0']);

    // and clicking it does not filter the series out of the chart
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
    container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);

    // focus mode does not filter, so both rows act again
    openTooltip(container); // the no-op click above bubbled to closeOnClick
    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key')))
      .toEqual(['category', 'series-S0', 'series-S1']);
  });

  it('moves focus and the roving tab stop with arrow keys', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const rows = tooltipRows(container);
    rows[0].focus();

    key(rows[0], 'ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['-1', '0']);

    // clamped at the last row
    key(rows[1], 'ArrowRight');
    expect(document.activeElement).toBe(rows[1]);

    key(rows[1], 'Home');
    expect(document.activeElement).toBe(rows[0]);
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });

  it('moves back with ArrowUp and ArrowLeft, and to the last row with End', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const rows = tooltipRows(container);
    rows[0].focus();

    key(rows[0], 'End');
    expect(document.activeElement).toBe(rows[1]);

    key(rows[1], 'ArrowUp');
    expect(document.activeElement).toBe(rows[0]);

    // clamped at the first row
    key(rows[0], 'ArrowLeft');
    expect(document.activeElement).toBe(rows[0]);
  });

  it('ignores keys that do not move, and keydowns from outside a row', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const rows = tooltipRows(container);
    rows[1].focus();

    key(rows[1], 'a');
    expect(document.activeElement).toBe(rows[1]);

    // the handler sits on the row container, so it also sees keys from the gaps between rows
    key(rows[1].parentElement!, 'Home');
    expect(document.activeElement).toBe(rows[1]);
  });

  it('keeps the roving tab stop when the same row takes focus again', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const rows = tooltipRows(container);
    rows[1].focus();
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['-1', '0']);

    // focus landing anywhere but a row leaves the stop where it is
    rows[1].parentElement!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['-1', '0']);
  });

  it('falls back to a control button when filtering unmounts the last row', () => {
    const container = mountChart(makeConfig({ showControls: true, showFiltered: false }, {
      series: [{ id: 'S0', property: 'sales' }]
    }));
    openTooltip(container);

    const only = tooltipRows(container)[0];
    only.focus();
    key(only, 'Enter');

    expect(tooltipRows(container).length).toBe(0);
    expect((document.activeElement as HTMLElement).tagName).toBe('BUTTON');
  });

  it('gives the category row the tab stop and Space when it holds focus', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);
    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    tooltipRows(container)[1].focus();
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    tooltipRows(container)[0].focus();
    expect(tooltipRows(container).map(row => row.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    key(tooltipRows(container)[0], ' ');
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1);

    const before = focuses.length;
    key(tooltipRows(container)[0], 'a');
    expect(focuses.length).toBe(before);
  });

  it('switches the mode back to filter on a second click', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modeButton(container).textContent).toBe('Focus');

    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modeButton(container).textContent).toBe('Filter');
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0', 'series-S1']);
  });

  // the roving rows used to announce as bare buttons, where the legend's identical container announces "Legend, group"
  it('groups the roving rows like the legend, named from the accessibility config', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const group = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLines'))!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Tooltip values');
    expect(tooltipRows(container)[0].closest('[role="group"]')).toBe(group);

    // the hidden sizer copy has no interactive rows, so it must not announce a second group
    expect(container.querySelector(getDescendantCssSelector('tooltipSizer', 'tooltipLines'))!
      .getAttribute('role')).toBeNull();

    const named = mountChart(makeConfig({ showControls: true }, { accessibility: { tooltipLabel: 'Werte' } }));
    openTooltip(named);
    expect(named.querySelector(getDescendantCssSelector('tooltip', 'tooltipLines'))!
      .getAttribute('aria-label')).toBe('Werte');
  });

  it('leaves the tooltip rows ungrouped when they are not tab stops', () => {
    for (const container of [mountChart(makeConfig()),
      mountChart(makeConfig({ showControls: true }, { accessibility: { enabled: false } }))]) {
      openTooltip(container);
      const lines = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLines'))!;
      expect(lines.getAttribute('role')).toBeNull();
      expect(lines.getAttribute('aria-label')).toBeNull();
    }
  });
});

describe('tooltip row pointer focus', () => {
  const categoryLine = (container: Element) => container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!;
  const seriesLine = (container: Element, seriesId: string) =>
    container.querySelector(getCssSelector('tooltip') + ' '
      + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', seriesId)))!;

  it('focuses the category from hover when focusCategoryOnHover is set without the controls', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ focusCategoryOnHover: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    categoryLine(container).dispatchEvent(new MouseEvent('pointerenter'));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);
    categoryLine(container).dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1);
  });

  it('focuses the category from hover in filter mode with the controls shown', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true, focusCategoryOnHover: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    categoryLine(container).dispatchEvent(new MouseEvent('pointerenter'));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);
    categoryLine(container).dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1);

    // focus mode hands the category row over to click-to-focus, so hover stops acting
    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const before = focuses.length;
    categoryLine(container).dispatchEvent(new MouseEvent('pointerenter'));
    categoryLine(container).dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses.length).toBe(before);
  });

  it('leaves the category alone on hover when the config is off', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    const before = focuses.length;
    categoryLine(container).dispatchEvent(new MouseEvent('pointerenter'));
    categoryLine(container).dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses.length).toBe(before);
  });

  it('focuses the category on click through focusCategoryOnClick without the controls', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ focusCategoryOnClick: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    // opening the tooltip focused category 0, so the click toggles it back off
    categoryLine(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1);
  });

  it('leaves the category alone on click in filter mode', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    const before = focuses.length;
    categoryLine(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // the row itself does not act; the close it triggers only releases the applied focus, like a plot click
    expect(focuses.slice(before).map(focus => focus.focusedCategoryIndex)).toEqual([-1]);
  });

  it('does not highlight a filtered series on hover', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      filteredSeriesIds: { S0: true }, onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    const before = focuses.length;
    seriesLine(container, 'S0').dispatchEvent(new MouseEvent('pointerenter'));
    expect(focuses.length).toBe(before);
  });

  it('leaves the series alone on hover when no focus config is set', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ filterSeriesOnClick: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);

    const before = focuses.length;
    seriesLine(container, 'S0').dispatchEvent(new MouseEvent('pointerenter'));
    seriesLine(container, 'S0').dispatchEvent(new MouseEvent('pointerleave'));
    expect(focuses.length).toBe(before);
  });

  it('moves the focus to another series while one is already focused', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), {
      onFocus: focus => { focuses.push(focus); }
    });
    openTooltip(container);
    modeButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // the focus-mode click stops propagation, so the tooltip stays open
    seriesLine(container, 'S0').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');

    seriesLine(container, 'S1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');
  });
});

describe('tooltip rows a series can opt out of', () => {
  it('omits a series with showInTooltip off', () => {
    const container = mountChart(makeConfig({ showControls: true }, {
      series: [
        { id: 'S0', property: 'sales' },
        { id: 'S1', property: 'costs', showInTooltip: false }
      ]
    }));
    openTooltip(container);
    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0']);
  });

  // the direction-split idiom (waterfall, candlestick, OHLC): a missing side
  // means "not this series' direction", so the row is left out rather than
  // rendered as "value – N/A"
  it('omits a ranged row whose category is missing one side', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        tooltip: { showControls: true },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [
          { id: 'S0', property: 'sales' },
          { id: 'S1', property: 'open', rangeProperty: 'close', renderer: 'bar',
            missingValueMode: 'connect', partialRangeIsMissing: true }
        ]
      } as unknown as MochartInputConfig,
      data: [
        { month: 'Jan', sales: 10, open: 5 },
        { month: 'Feb', sales: 20, open: 8, close: 12 },
        { month: 'Mar', sales: 30, open: 9, close: 15 }
      ],
      width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    openTooltip(container);

    expect(tooltipRows(container).map(row => row.getAttribute('data-row-key'))).toEqual(['series-S0']);
  });

  it('renders a tooltip with no series rows at all', () => {
    const container = mountChart(makeConfig({ showControls: true }, {
      series: [
        { id: 'S0', property: 'sales', showInTooltip: false },
        { id: 'S1', property: 'costs', showInTooltip: false }
      ]
    }));
    openTooltip(container);
    expect(tooltipRows(container).length).toBe(0);
    expect(container.querySelector(getCssSelector('tooltipCategoryLine'))).not.toBeNull();
  });
});

describe('closing the tooltip returns focus to the plot tab stop', () => {
  it('closes on Escape anywhere inside and returns focus to the plot tab stop', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const first = tooltipRows(container)[0];
    first.focus();
    key(first, 'Escape');

    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    const plotRect = container.querySelector(getCssSelector('seriesBackground') + ' rect[tabindex]');
    expect(plotRect).not.toBeNull();
    expect(document.activeElement).toBe(plotRect);
  });

  // only Escape used to restore focus, so every other close left it on <body>
  it('returns focus to the plot tab stop when a click inside closes the tooltip', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    tooltipRows(container)[0].focus();
    // the category row does not act in filter mode, so the click reaches closeOnClick
    container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    const plotRect = container.querySelector(getCssSelector('seriesBackground') + ' rect[tabindex]')!;
    expect(document.activeElement).toBe(plotRect);
    expect(plotRect.hasAttribute(focusRestoredAttribute)).toBe(true);
  });

  it('returns focus to the plot tab stop when a click on the plot closes the tooltip', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    tooltipRows(container)[0].focus();
    mouse(chartRoot(container), 'click', 100, 100);

    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(document.activeElement).toBe(container.querySelector(getCssSelector('seriesBackground') + ' rect[tabindex]'));
  });
});

// Regression: Escape inside the tooltip and closeOnClick reset only the tooltip state, so with the
// default applyFocus the category stayed pinned and the crosshair stayed drawn after the tooltip went
describe('closing the tooltip from inside releases the applied focus', () => {
  function crosshairLineCount(container: Element): number {
    return container.querySelectorAll(getCssSelector('crosshair') + ' line').length;
  }

  it('reports the focus release and clears the crosshair on Escape inside', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), { onFocus: focus => focuses.push(focus) });
    openTooltip(container);
    expect(focuses[focuses.length - 1]?.focusedCategoryIndex).toBeGreaterThanOrEqual(0);
    expect(crosshairLineCount(container)).toBeGreaterThan(0);

    // keydown on the row without focusing it: a focused series row applies its own series highlight
    key(tooltipRows(container)[0], 'Escape');
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(focuses[focuses.length - 1]?.focusedCategoryIndex).toBe(-1);
    expect(crosshairLineCount(container)).toBe(0);
  });

  it('reports the focus release and clears the crosshair on a closing click inside', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ showControls: true }), { onFocus: focus => focuses.push(focus) });
    openTooltip(container);
    container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(focuses[focuses.length - 1]?.focusedCategoryIndex).toBe(-1);
    expect(crosshairLineCount(container)).toBe(0);
  });
});

describe('tooltip control buttons', () => {
  it('announces the category the step buttons move to', async () => {
    // the buttons went through a path that updated the tooltip but never the live region, so a
    // screen reader kept reading whichever category the tooltip was opened on
    const container = mountChart(makeConfig({ showControls: true }));
    const rect = container.querySelector<SVGElement>(getCssSelector('seriesBackground') + ' rect')!;
    key(rect, 'Enter');
    const opened = liveText(container);
    expect(opened).toContain('Jan');

    const next = Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' button'))
      .find(button => button.textContent === '›')!;
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // the live region coalesces a burst, so this step lands after the settle window
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(liveText(container)).toContain('Feb');
    expect(liveText(container)).not.toBe(opened);
  });

  it('labels the step buttons and disables them at the ends via aria-disabled', () => {
    const container = mountChart(makeConfig({ showControls: true }));
    openTooltip(container);

    const buttons = () => Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' button'));
    const prev = () => buttons().find(button => button.textContent === '‹')!;
    const next = () => buttons().find(button => button.textContent === '›')!;

    expect(prev().getAttribute('aria-label')).toBe('Previous category');
    expect(next().getAttribute('aria-label')).toBe('Next category');

    // opened at the first category: prev is inert but still focusable
    expect(prev().getAttribute('aria-disabled')).toBe('true');
    expect(next().getAttribute('aria-disabled')).toBeNull();
    expect(prev().hasAttribute('disabled')).toBe(false);

    next().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(prev().getAttribute('aria-disabled')).toBeNull();

    next().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(next().getAttribute('aria-disabled')).toBe('true');
  });

  it('localizes the labels and mode words through the config', () => {
    const container = mountChart(makeConfig(
      { showControls: true, filterModeText: 'Filtern', focusModeText: 'Fokus' },
      { accessibility: { tooltipPreviousLabel: 'Vorherige Kategorie', tooltipNextLabel: 'Nächste Kategorie' } }
    ));
    openTooltip(container);

    const buttons = Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' button'));
    expect(buttons.some(button => button.getAttribute('aria-label') === 'Vorherige Kategorie')).toBe(true);
    expect(buttons.some(button => button.getAttribute('aria-label') === 'Nächste Kategorie')).toBe(true);
    const mode = buttons.find(button => button.textContent === 'Filtern')!;
    expect(mode).toBeDefined();
    mode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(buttons.some(button => button.textContent === 'Fokus')).toBe(true);
  });
});
