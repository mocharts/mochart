/**
 * Pointer-driven chart pipeline: mouse events drive the tooltip, tooltip controls, crosshair, and
 * focus/event callbacks. Mounted via the public createDefaultChart() API, animation off, synchronous in jsdom.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartEventPayload, ChartFocus, ChartSeriesClickPayload, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssClass, getIdCssClass, getCssSelector, getIdCssSelector, getDescendantCssSelector, getCssClassMatchSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const crosshairLine = getCssSelector('crosshairLine');
const crosshairCategoryLines = getCssSelector('crosshairCategoryLines');
const crosshairSeriesLines = getCssSelector('crosshairSeriesLines');
const crosshair = getCssSelector('crosshair');
const titleGroup = getCssSelector('title');
const titleText = getCssSelector('titleText');
const titlePrefix = getCssSelector('titlePrefix');
const titleSuffix = getCssSelector('titleSuffix');
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, callbacks: Partial<DefaultChartProps> = {}, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return container;
}

function chartRoot(container: Element): Element {
  const root = container.querySelector(getChartRootCssSelector());
  expect(root).not.toBeNull();
  return root!;
}

/** The plot's own bounds, which sit inside the chart by the axis gutters. */
function plotBounds(container: Element): { x: number; y: number; width: number; height: number } {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;
  return {
    x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height'))
  };
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  // jsdom reports zero-size rects; report the mounted chart size instead so
  // the chart's pointer hit-testing (clientX/Y relative to the plot rect) works
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // the plot rect keeps its own offset, so container and plot coordinates stay distinguishable
    if (this.tagName === 'rect' && this.parentElement?.getAttribute('class') === getCssClass('seriesBackground')) {
      const x = Number(this.getAttribute('x')), y = Number(this.getAttribute('y'));
      const width = Number(this.getAttribute('width')), height = Number(this.getAttribute('height'));
      return {
        x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({})
      } as DOMRect;
    }
    return {
      x: 0, y: 0, left: 0, top: 0, right: WIDTH, bottom: HEIGHT,
      width: WIDTH, height: HEIGHT, toJSON: () => ({})
    } as DOMRect;
  });
});

describe('chart mouse events', () => {
  it('fires enter, move, leave and click callbacks with a category index payload', () => {
    const enters: ChartEventPayload[] = [];
    const moves: ChartEventPayload[] = [];
    const leaves: ChartEventPayload[] = [];
    const clicks: ChartEventPayload[] = [];
    const container = mountChart(makeConfig(), {
      onChartMouseEnter: payload => { enters.push(payload); },
      onChartMouseMove: payload => { moves.push(payload); },
      onChartMouseLeave: payload => { leaves.push(payload); },
      onChartClick: payload => { clicks.push(payload); }
    });
    const root = chartRoot(container);

    // first in-bounds motion event is the enter, later ones are moves
    mouse(root, 'mouseenter', 100, 100);
    expect(enters.length).toBe(1);
    mouse(root, 'mousemove', 400, 100);
    expect(moves.length).toBe(1);

    // an out-of-bounds move while inside is the leave
    mouse(root, 'mousemove', -10, 100);
    expect(leaves.length).toBe(1);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(clicks.length).toBe(1);

    // payloads carry the nearest category: far left resolves to the first category,
    // far right to the last
    expect(enters[0].categoryIndex).toBe(0);
    const rightClicks: ChartEventPayload[] = [];
    mouse(root, 'mousemove', 790, 100);
    expect(moves[moves.length - 1].categoryIndex).toBe(rows.length - 1);
    expect(rightClicks.length).toBe(0);
  });

  // Regression: the message states detached the pointer handlers without clearing isMouseWithinChart,
  // so no enter fired after the chart came back until the pointer left the plot once
  it('treats the first motion after a no-size round trip as an enter again', () => {
    const enters: ChartEventPayload[] = [];
    const container = mountChart(makeConfig(), { onChartMouseEnter: payload => { enters.push(payload); } });
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    expect(enters.length).toBe(1);

    const handle = lastHandle();
    handle.update({ height: 0 });
    expect(container.querySelector('svg')).toBeNull();
    handle.update({ height: HEIGHT });

    mouse(chartRoot(container), 'mousemove', 100, 100);
    expect(enters.length).toBe(2);
  });

  it('reports chartX and chartY relative to the plot, not to the chart container', () => {
    const clicks: ChartEventPayload[] = [];
    const container = mountChart(makeConfig(), { onChartClick: payload => { clicks.push(payload); } });
    const root = chartRoot(container);
    const plot = plotBounds(container);
    // the axis gutter puts the plot origin away from the container origin, so the two frames differ
    expect(plot.x).toBeGreaterThan(0);

    mouse(root, 'mouseenter', plot.x + 30, plot.y + 20);
    mouse(root, 'click', plot.x + 30, plot.y + 20);
    expect(clicks[0].chartX).toBeCloseTo(30);
    expect(clicks[0].chartY).toBeCloseTo(20);
    // the other two position fields share that origin
    expect(clicks[0].categoryPosition).toBeCloseTo(30);
    expect(clicks[0].valuePosition).toBeCloseTo(20);
  });
});

describe('background clicks', () => {
  // every Background is rendered without an onClick prop, so the click reaches the chart root by bubbling
  it('reach the chart click callback by bubbling', () => {
    const clicks: ChartEventPayload[] = [];
    const container = mountChart(makeConfig(), { onChartClick: payload => { clicks.push(payload); } });
    const background = container.querySelector(getCssSelector('plotBackground'))!;
    expect(background).not.toBeNull();

    mouse(container.querySelector(getChartRootCssSelector())!, 'mouseenter', 100, 100);
    mouse(background, 'click', 100, 100);

    expect(clicks.length).toBe(1);
    expect(clicks[0].categoryIndex).toBe(0);
  });
});

describe('value axis hover focus', () => {
  // the handlers sit on the axis's inner transform group, not its root
  function axisInner(container: Element): Element {
    const inner = container.querySelector(getCssSelector('valueAxis') + ' > g');
    expect(inner).not.toBeNull();
    return inner!;
  }

  it('focuses and unfocuses the axis, which focusOnHover enables by default', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig(), { onFocus: focus => { focuses.push(focus); } });

    mouse(axisInner(container), 'pointerenter', 40, 300);
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedValueAxisId: 'VA0' });

    mouse(axisInner(container), 'pointerleave', 40, 300);
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedValueAxisId: null });
  });

  it('reports no axis focus when focusOnHover is turned off', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(
      makeConfig({ valueAxes: [{ focusOnHover: false }] }),
      { onFocus: focus => { focuses.push(focus); } });

    mouse(axisInner(container), 'pointerenter', 40, 300);
    mouse(axisInner(container), 'pointerleave', 40, 300);
    mouse(axisInner(container), 'click', 40, 300);

    // the chart still tracks the pointer for category focus; only the axis id stays null
    expect(focuses.every(focus => focus.focusedValueAxisId === null)).toBe(true);
  });
});

describe('title layout variants', () => {
  it('renders a centered title with prefix and suffix', () => {
    const container = mountChart(makeConfig({
      title: { text: 'Sales Chart', prefix: { text: 'Q1' }, suffix: { text: '(units)' }, verticalExpand: true }
    }));
    const title = container.querySelector(getCssSelector('title'));
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('Sales Chart');
    expect(title!.textContent).toContain('Q1');
    expect(title!.textContent).toContain('(units)');
  });

  it('renders a right-aligned bottom title not aligned to the axes', () => {
    const container = mountChart(makeConfig({
      title: {
        text: 'Bottom Title', position: 'bottom', align: 'right',
        alignedToAxes: false, verticalAlign: 'middle'
      }
    }));
    const title = container.querySelector(getCssSelector('title'));
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('Bottom Title');
  });

  it('renders a left-aligned title', () => {
    const container = mountChart(makeConfig({
      title: { text: 'Left Title', align: 'left', alignedToAxes: false }
    }));
    expect(container.querySelector(getCssSelector('title'))!.textContent).toContain('Left Title');
  });

  it('survives a chart too narrow for the title decorations', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: makeConfig({ title: { text: 'T', prefix: { text: 'P' }, suffix: { text: 'S' } } }),
      data: rows, width: 4, height: 600
    } as DefaultChartProps));
    expect(container.querySelector(getChartRootCssSelector())).not.toBeNull();
  });
});

describe('title link', () => {
  const linkConfig = (overrides: Record<string, unknown> = {}) => makeConfig({
    title: { text: 'Sales Chart', prefix: { text: 'Q1' }, suffix: { text: '(units)' }, link: 'https://example.com/sales', ...overrides }
  });

  function anchor(container: Element): SVGAElement {
    const element = container.querySelector<SVGAElement>(`${titleGroup} a`);
    expect(element).not.toBeNull();
    return element!;
  }

  it('wraps every title section in a real anchor carrying the href', () => {
    const container = mountChart(linkConfig());
    const link = anchor(container);
    expect(link.getAttribute('href')).toBe('https://example.com/sales');
    // the whole title, not just its middle section, is the click target
    for (const selector of [titlePrefix, titleText, titleSuffix]) {
      const section = container.querySelector(selector);
      expect(section, selector).not.toBeNull();
      expect(section!.closest('a'), selector).toBe(link);
    }
    expect(link.textContent).toContain('Sales Chart');
  });

  it('renders an unlinked title with no anchor around its text', () => {
    const container = mountChart(makeConfig({ title: { text: 'Sales Chart' } }));
    expect(container.querySelector(`${titleGroup} a`)).toBeNull();
    expect(container.querySelector(titleText)!.closest('a')).toBeNull();
  });

  it('lets a linked title navigate by default', () => {
    const container = mountChart(linkConfig());
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor(container).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('suppresses navigation but keeps the href when linkDisabled is set', () => {
    const container = mountChart(linkConfig({ linkDisabled: true }));
    const link = anchor(container);
    expect(link.getAttribute('href')).toBe('https://example.com/sales');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still reports the click to onTitleClick from a linkDisabled title', () => {
    const clicks: number[] = [];
    const container = mountChart(linkConfig({ linkDisabled: true }), { onTitleClick: () => { clicks.push(1); } });
    anchor(container).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks.length).toBe(1);
  });
});

describe('onTitleClick', () => {
  it('fires once per pointer click on the title', () => {
    const clicks: number[] = [];
    const container = mountChart(makeConfig({ title: { text: 'Sales Chart' } }),
      { onTitleClick: () => { clicks.push(1); } });
    const title = container.querySelector(titleGroup)!;
    expect(title.getAttribute('cursor')).toBe('pointer');

    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks.length).toBe(1);
    container.querySelector(titleText)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks.length).toBe(2);
  });

  it('shows no pointer affordance on a title without the callback', () => {
    const container = mountChart(makeConfig({ title: { text: 'Sales Chart' } }));
    expect(container.querySelector(titleGroup)!.getAttribute('cursor')).toBeNull();
  });
});

describe('tooltip', () => {
  it('opens on click, closes on the next click, and applies category focus', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig(), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
    // tooltip content shows the category and the formatted series line
    const tooltipText = container.querySelector(getCssSelector('tooltipContent'))!.textContent;
    expect(tooltipText).toContain('Jan');
    expect(tooltipText).toContain('10');
    // applyFocus (default true) focused the clicked category
    expect(focuses.length).toBeGreaterThan(0);
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);

    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1);
  });

  it('shows crosshair lines while the tooltip is open', () => {
    const container = mountChart(makeConfig());
    const root = chartRoot(container);

    // the crosshair root group is always mounted; its lines appear on toggle
    expect(container.querySelectorAll(crosshairLine).length).toBe(0);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelectorAll(crosshairLine).length).toBeGreaterThan(0);

    mouse(root, 'click', 100, 100);
    expect(container.querySelectorAll(crosshairLine).length).toBe(0);
  });

  it('opens on hover and closes on leave when followPointer is enabled', () => {
    const container = mountChart(makeConfig({ tooltip: { followPointer: true } }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    // moving within the chart keeps it open and tracks the category
    mouse(root, 'mousemove', 790, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
    expect(container.querySelector(getCssSelector('tooltip'))!.textContent).toContain('Mar');

    // leaving the chart closes it
    mouse(root, 'mousemove', -10, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
  });

  // Regression: enter and leave called a toggle, so a click in between inverted the pairing for the session
  it('keeps enter opening and leave closing after the tooltip is closed by a click', () => {
    const container = mountChart(makeConfig({ tooltip: { followPointer: true, closeOnClick: true } }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    container.querySelector(getCssSelector('tooltipContent'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();

    // the leave that follows must stay a close, not re-open a pinned tooltip
    mouse(root, 'mousemove', -10, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();

    // and the next enter must still open
    mouse(root, 'mouseenter', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
  });

  it('keeps enter opening after the tooltip is opened from the keyboard', () => {
    const container = mountChart(makeConfig({ tooltip: { followPointer: true } }));
    const root = chartRoot(container);
    const plot = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;

    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    // mouseenter must not close the tooltip the keyboard just opened
    mouse(root, 'mouseenter', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    mouse(root, 'mousemove', -10, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
  });

  it('steps between categories with the tooltip controls', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ tooltip: { showControls: true } }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    // the content is rendered twice (hidden sizer + visible tooltip); drive
    // the visible copy.
    const visibleButtons = () => Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' button'));
    const prev = visibleButtons().find(button => button.textContent === '‹')!;
    const next = visibleButtons().find(button => button.textContent === '›')!;
    expect(prev).toBeDefined();
    expect(next).toBeDefined();
    const visibleText = () => container.querySelector(getDescendantCssSelector('tooltip', 'tooltipContent'))!.textContent;
    expect(visibleText()).toContain('Jan');

    next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(visibleText()).toContain('Feb');
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(1);

    prev.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(visibleText()).toContain('Jan');
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);

    // prev at the first category is a no-op
    prev.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(visibleText()).toContain('Jan');
  });

  it('formats range series values with the range separator', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales', rangeProperty: 'costs' }]
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const text = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLines'))!.textContent;
    expect(text).toContain(' - ');
    expect(text).toContain('10');
    expect(text).toContain('5');
  });

  it('shows the missing value text for undefined series values', () => {
    const data = [
      { month: 'Jan', costs: 5 },
      { month: 'Feb', sales: 20, costs: 8 },
      { month: 'Mar', sales: 30, costs: 13 }
    ];
    const container = mountChart(makeConfig(), {}, data);
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const text = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLines'))!.textContent;
    expect(text).toContain('N/A');
  });

  it('moves the tooltip content with the pointer when followPointer is on', () => {
    const container = mountChart(makeConfig({
      tooltip: { followPointer: true },
      series: [{ property: 'sales' }]
    }));
    const root = chartRoot(container);

    // followPointer opens the tooltip on enter, no click needed
    mouse(root, 'mouseenter', 100, 100);
    const tooltip = container.querySelector(getCssSelector('tooltip'))!;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('Jan');
    expect(tooltip.textContent).toContain('10.00');

    // crossing to the last category must update the tooltip content
    mouse(root, 'mousemove', 790, 100);
    const moved = container.querySelector(getCssSelector('tooltip'))!;
    expect(moved.textContent).toContain('Mar');
    expect(moved.textContent).toContain('30.00');
    expect(moved.textContent).not.toContain('Jan');

    // leaving the plot closes a followPointer tooltip
    mouse(root, 'mousemove', -10, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
  });

  it('tracks the focused category on move for a crosshair-only followPointer chart', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      tooltip: { visible: false, followPointer: true },
      crosshair: { visible: true }
    }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);
    mouse(root, 'mousemove', 790, 100);
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(rows.length - 1);
  });

  it('never drives focus from a followPointer tooltip with applyFocus off', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      tooltip: { followPointer: true, applyFocus: false },
      crosshair: { visible: false }
    }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'mousemove', 790, 100);
    expect(focuses.length).toBe(0);
    // the tooltip itself still follows the pointer
    expect(container.querySelector(getCssSelector('tooltip'))!.textContent).toContain('Mar');
  });

  it('leaves showInTooltip: false series out of the tooltip', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs', showInTooltip: false }]
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))).not.toBeNull();
    expect(container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))).toBeNull();
  });

  it('marks filtered series values and can hide the line entirely', () => {
    const twoSeries = {
      legend: { visible: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    };
    const container = mountChart(makeConfig(twoSeries));
    const root = chartRoot(container);

    // filter the costs series, then open the tooltip
    container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const filteredLine = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')));
    expect(filteredLine).not.toBeNull();
    expect(filteredLine!.textContent).not.toContain('5.00');

    // showFiltered: false drops the line completely
    const hiding = mountChart(makeConfig({ ...twoSeries, tooltip: { showFiltered: false } }));
    const hidingRoot = chartRoot(hiding);
    hiding.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mouse(hidingRoot, 'mouseenter', 100, 100);
    mouse(hidingRoot, 'click', 100, 100);
    expect(hiding.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))).toBeNull();
    expect(hiding.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))).not.toBeNull();
  });

  it('renders plain series lines when valueAlign is left and prefixes the category label', () => {
    const container = mountChart(makeConfig({
      tooltip: { valueAlign: 'left' },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', valueLabel: 'Month' }
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLineText'))).not.toBeNull();
    expect(container.querySelector(getDescendantCssSelector('tooltip', 'tooltipLineValue'))).toBeNull();
    expect(container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!.textContent)
      .toBe('Month: Jan');
  });

  it('sizes tooltip icons from the font by default and preserves numeric sizes', () => {
    const automatic = mountChart(makeConfig());
    const automaticRoot = chartRoot(automatic);
    mouse(automaticRoot, 'mouseenter', 100, 100);
    mouse(automaticRoot, 'click', 100, 100);

    const automaticIcon = automatic.querySelector<SVGElement>(getDescendantCssSelector('tooltip', 'tooltipLineIcon') + ' svg')!;
    expect(automaticIcon.getAttribute('width')).toBe('1em');
    expect(automaticIcon.getAttribute('height')).toBe('1em');
    expect(automaticIcon.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(automaticIcon.parentElement!.style.width).toBe('calc(1em + 4px)');

    const fixed = mountChart(makeConfig({ tooltip: { icon: { size: 20 } } }));
    const fixedRoot = chartRoot(fixed);
    mouse(fixedRoot, 'mouseenter', 100, 100);
    mouse(fixedRoot, 'click', 100, 100);

    const fixedIcon = fixed.querySelector<SVGElement>(getDescendantCssSelector('tooltip', 'tooltipLineIcon') + ' svg')!;
    expect(fixedIcon.getAttribute('width')).toBe('20');
    expect(fixedIcon.getAttribute('height')).toBe('20');
    expect(fixedIcon.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(fixedIcon.parentElement!.style.width).toBe('24px');
  });

  it('focuses and filters series from tooltip line clicks', () => {
    const focuses: ChartFocus[] = [];
    const filters: Array<{ filteredSeriesIds: Record<string, boolean> }> = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs' }],
      tooltip: { focusSeriesOnClick: true, filterSeriesOnClick: true }
    }), {
      onFocus: focus => { focuses.push(focus); },
      onSeriesFilter: filter => { filters.push(filter); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const line = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))!;
    line.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    expect(filters[filters.length - 1].filteredSeriesIds).toEqual({ S0: true });
    // stopPropagation keeps the tooltip open despite closeOnClick
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    // clicking the focused series again clears the focus
    const lineAgain = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))!;
    lineAgain.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });

  it('focuses series on tooltip line hover when configured', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs' }],
      tooltip: { focusSeriesOnHover: true }
    }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const line = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))!;
    line.dispatchEvent(new MouseEvent('pointerenter', {}));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');
    line.dispatchEvent(new MouseEvent('pointerleave', {}));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });

  it('does not touch focus when the pointer crosses a switched-off tooltip row', () => {
    // entering a filtered row correctly applies no focus, but leaving it used to clear focus
    // anyway, wiping a selection made elsewhere and sending the host a needless callback
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs' }],
      tooltip: { focusSeriesOnHover: true }
    }), {
      onFocus: focus => { focuses.push(focus); },
      filteredSeriesIds: { S1: true }
    });
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const filteredRow = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))!;
    const before = focuses.length;
    filteredRow.dispatchEvent(new MouseEvent('pointerenter', {}));
    filteredRow.dispatchEvent(new MouseEvent('pointerleave', {}));
    expect(focuses.length).toBe(before);
  });

  it('closes when the tooltip content is clicked unless closeOnClick is off', () => {
    const container = mountChart(makeConfig());
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    // Regression: the click bubbled to the chart root, which toggled the tooltip straight back
    // open at the category under the pointer, so click over the plot rather than at 0,0.
    container.querySelector(getDescendantCssSelector('tooltip', 'tooltipContent'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 250, clientY: 100 }));
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();

    const sticky = mountChart(makeConfig({ tooltip: { closeOnClick: false } }));
    const stickyRoot = chartRoot(sticky);
    mouse(stickyRoot, 'mouseenter', 100, 100);
    mouse(stickyRoot, 'click', 100, 100);
    sticky.querySelector(getDescendantCssSelector('tooltip', 'tooltipContent'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sticky.querySelector(getCssSelector('tooltip'))).not.toBeNull();
  });

  it('switches between filter and focus modes with the controls mode button', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ tooltip: { showControls: true } }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const modeButton = () => Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' button'))
      .find(button => button.textContent === 'Filter' || button.textContent === 'Focus')!;
    expect(modeButton().textContent).toBe('Filter');

    modeButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modeButton().textContent).toBe('Focus');

    // in focus mode a category line click toggles category focus
    const categoryLine = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!;
    categoryLine.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(-1); // toggled off (was focused category 0)
    categoryLine.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(0);
  });

  it('toggles series filtering from a legend item click', () => {
    const filters: Array<{ filteredSeriesIds: Record<string, boolean> }> = [];
    const container = mountChart(makeConfig({
      legend: { visible: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    }), {
      onSeriesFilter: filter => { filters.push(filter); }
    });

    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')));
    expect(item).not.toBeNull();

    item!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(filters.length).toBe(1);
    expect(filters[0].filteredSeriesIds).toEqual({ S1: true });

    item!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(filters.length).toBe(2);
    expect(filters[1].filteredSeriesIds).toEqual({});
  });

  it('clears series focus when a legend click filters the hovered series', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      legend: { visible: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    }), {
      onFocus: focus => { focuses.push(focus); }
    });

    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')))!;
    item.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');

    // filtering the hovered series must not strand focus on it
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe(null);

    item.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe(null);
  });

  it('clears series focus on leave when the hovered series was filtered externally', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      legend: { visible: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    }), {
      onFocus: focus => { focuses.push(focus); }
    });

    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')))!;
    item.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');

    // the host filters the hovered series through the controlled prop; the
    // leave must still fire even though the series is filtered by then
    lastHandle().update({ filteredSeriesIds: { S1: true } } as Partial<DefaultChartProps>);
    item.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe(null);
  });

  it('sizes legend icons from measured text by default and preserves numeric sizes', () => {
    const seriesConfigs = [{ property: 'sales' }, { property: 'costs' }];
    const automatic = mountChart(makeConfig({
      legend: { visible: true },
      series: seriesConfigs
    }));
    const automaticIcon = automatic.querySelector<SVGPathElement>(getCssSelector('legendItemIcon') + ' path')!;
    // Placeholder text bounds retain the previous 14px icon until a real
    // browser measurement is available.
    expect(automaticIcon.getAttribute('transform')).toBe('translate(7,7)');

    const fixed = mountChart(makeConfig({
      legend: { visible: true, icon: { size: 12 } },
      series: seriesConfigs
    }));
    const fixedIcon = fixed.querySelector<SVGPathElement>(getCssSelector('legendItemIcon') + ' path')!;
    expect(fixedIcon.getAttribute('transform')).toBe('translate(6,6)');
  });

  it('maps pointer position along the y axis and draws horizontal crosshair lines when inverted', () => {
    const moves: ChartEventPayload[] = [];
    const container = mountChart(makeConfig({ plot: { inverted: true } }), {
      onChartMouseMove: payload => { moves.push(payload); }
    });
    const root = chartRoot(container);

    // in an inverted plot the category position follows chartY
    const plot = plotBounds(container);
    const midX = plot.x + plot.width / 2;
    mouse(root, 'mouseenter', midX, plot.y + 1);
    mouse(root, 'mousemove', midX, plot.y + plot.height - 1);
    expect(moves[moves.length - 1].categoryIndex).toBe(rows.length - 1);

    mouse(root, 'click', midX, plot.y + 1);
    const line = container.querySelector(crosshairLine);
    expect(line).not.toBeNull();
    // horizontal category line: spans x, constant y
    expect(line!.getAttribute('y1')).toBe(line!.getAttribute('y2'));
    expect(line!.getAttribute('x1')).not.toBe(line!.getAttribute('x2'));
  });

  it('draws a series crosshair line when a series is focused', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs' }],
      tooltip: { focusSeriesOnHover: true },
      crosshair: { seriesLine: { visible: true } }
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const seriesLines = () => container.querySelectorAll(`${crosshairSeriesLines} ${crosshairLine}`);
    expect(seriesLines().length).toBe(0);

    const line = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')))!;
    line.dispatchEvent(new MouseEvent('pointerenter', {}));
    expect(seriesLines().length).toBeGreaterThan(0);
  });

  it('hides category crosshair lines when categoryLine.visible is off', () => {
    const container = mountChart(makeConfig({
      crosshair: { categoryLine: { visible: false } }
    }));
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
    expect(container.querySelectorAll(`${crosshairCategoryLines} ${crosshairLine}`).length).toBe(0);
  });

  it('renders an axis focus range for the focused category', () => {
    const container = mountChart(makeConfig({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', focusRange: { visible: true } }
    }));
    const root = chartRoot(container);

    expect(container.querySelector('[class*="focus-range"] rect')).toBeNull();
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector('[class*="focus-range"] rect')).not.toBeNull();
  });

  it('renders a vertical axis focus range when the plot is inverted', () => {
    const container = mountChart(makeConfig({
      plot: { inverted: true },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', focusRange: { visible: true } }
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 400, 100);
    mouse(root, 'click', 400, 100);
    expect(container.querySelector('[class*="focus-range"] rect')).not.toBeNull();
  });

  it('does not open when tooltip and crosshair are both hidden', () => {
    const container = mountChart(makeConfig({
      tooltip: { visible: false },
      crosshair: { visible: false }
    }));
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    expect(container.querySelector(crosshair)).toBeNull();
  });
});

describe('strikeThroughFiltered', () => {
  const twoSeries = {
    legend: { visible: true },
    series: [{ property: 'sales' }, { property: 'costs' }]
  };

  function filter(container: Element, seriesId: string): void {
    container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', seriesId)))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function openTooltip(container: Element): void {
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
  }

  // Two texts per item: the visible one and the hidden sizer, which must match.
  function legendTextDecorations(container: Element, seriesId: string): (string | null)[] {
    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', seriesId)))!;
    return Array.from(item.querySelectorAll('text')).map(text => text.getAttribute('text-decoration'));
  }

  it('strikes through the legend text of a filtered series when enabled', () => {
    const container = mountChart(makeConfig({
      ...twoSeries,
      legend: { visible: true, strikeThroughFiltered: true }
    }));
    expect(legendTextDecorations(container, 'S1')).toEqual([null, null]);

    filter(container, 'S1');
    expect(legendTextDecorations(container, 'S1')).toEqual(['line-through', 'line-through']);
    expect(legendTextDecorations(container, 'S0')).toEqual([null, null]);
  });

  it('leaves the legend text undecorated when disabled (the default)', () => {
    const container = mountChart(makeConfig(twoSeries));
    filter(container, 'S1');
    expect(legendTextDecorations(container, 'S1')).toEqual([null, null]);
  });

  it('strikes through the tooltip label of a filtered series when enabled', () => {
    const container = mountChart(makeConfig({
      ...twoSeries,
      tooltip: { strikeThroughFiltered: true }
    }));
    filter(container, 'S1');
    openTooltip(container);

    const filteredLabel = container.querySelector<HTMLElement>(
      getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')) + ' ' + getCssSelector('tooltipLineLabel'))!;
    const shownLabel = container.querySelector<HTMLElement>(
      getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S0')) + ' ' + getCssSelector('tooltipLineLabel'))!;
    expect(filteredLabel.style.textDecoration).toBe('line-through');
    expect(shownLabel.style.textDecoration).toBe('');
    const filteredValue = container.querySelector<HTMLElement>(
      getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')) + ' ' + getCssSelector('tooltipLineValue'))!;
    expect(filteredValue.style.textDecoration).toBe('');
  });

  it('leaves the tooltip label undecorated when disabled (the default)', () => {
    const container = mountChart(makeConfig(twoSeries));
    filter(container, 'S1');
    openTooltip(container);

    const filteredLabel = container.querySelector<HTMLElement>(
      getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')) + ' ' + getCssSelector('tooltipLineLabel'))!;
    expect(filteredLabel.style.textDecoration).toBe('');
  });

  it('strikes the whole line when valueAlign left puts the label and value together', () => {
    const container = mountChart(makeConfig({
      ...twoSeries,
      tooltip: { valueAlign: 'left', strikeThroughFiltered: true }
    }));
    filter(container, 'S1');
    openTooltip(container);

    const filteredText = container.querySelector<HTMLElement>(
      getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')) + ' ' + getCssSelector('tooltipLineText'))!;
    expect(filteredText.style.textDecoration).toBe('line-through');
  });

  it('styles a filtered legend icon with icon.filteredColor', () => {
    function filteredIconFill(legend: Record<string, unknown>): string | null {
      const container = mountChart(makeConfig({ ...twoSeries, legend: { visible: true, ...legend } }));
      filter(container, 'S1');
      const iconGroup = container.querySelector(
        getCssClassMatchSelector(getIdCssClass('legendItem', 'S1')) + ' ' + getCssSelector('legendItemIcon'))!;
      return iconGroup.firstElementChild!.getAttribute('fill');
    }

    // the default is fully transparent, so a filtered icon reads as its border alone
    expect(filteredIconFill({})).toBe('rgba(255,255,255,0)');
    expect(filteredIconFill({ icon: { filteredColor: '#cccccc' } })).toBe('#cccccc');
  });

  it('decorates the hidden sizer copy of the tooltip the same way', () => {
    const container = mountChart(makeConfig({
      ...twoSeries,
      tooltip: { strikeThroughFiltered: true }
    }));
    filter(container, 'S1');
    openTooltip(container);

    const labels = container.querySelectorAll<HTMLElement>(
      getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')) + ' ' + getCssSelector('tooltipLineLabel'));
    expect(labels.length).toBe(2);
    for (const label of labels) {
      expect(label.style.textDecoration).toBe('line-through');
    }
  });
});

describe('followSeries follower focus', () => {
  // A candlestick-style pair: a hidden thin wick series that follows the body
  // series via followSeries, plus an unrelated series to show the defocused
  // state.
  const candleRows = [
    { month: 'Jan', high: 30, low: 5, open: 10, close: 20, x: 50 },
    { month: 'Feb', high: 40, low: 12, open: 22, close: 25, x: 60 }
  ];

  function candleConfig(): MochartInputConfig {
    return makeConfig({
      series: [
        { id: 'wick', property: 'high', rangeProperty: 'low', renderer: 'bar', bar: { widthFraction: 0.2 },
          showInLegend: false, followSeries: 'body', focusOnClick: true },
        { id: 'body', property: 'close', rangeProperty: 'open', renderer: 'bar', focusOnClick: true },
        { id: 'other', property: 'x', renderer: 'bar' }
      ]
    });
  }

  function barOpacity(container: Element, seriesId: string): string | null {
    const bar = container.querySelector(getIdCssSelector('series', seriesId) + ' path')!;
    return bar.getAttribute('fill-opacity');
  }

  it('highlights the follower along with its focused leader', () => {
    const container = mountChart(candleConfig(), {}, candleRows);
    const unfocusedOtherOpacity = Number(barOpacity(container, 'other'));

    lastHandle().update({ focusedSeriesId: 'body' } as Partial<DefaultChartProps>);

    // the wick takes its body's focused opacity while the unrelated series dims
    expect(barOpacity(container, 'wick')).toBe(barOpacity(container, 'body'));
    expect(Number(barOpacity(container, 'other'))).toBeLessThan(unfocusedOtherOpacity);
    expect(Number(barOpacity(container, 'wick'))).toBeGreaterThan(Number(barOpacity(container, 'other')));
  });

  it('focuses and toggles the leader when the follower is clicked', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(candleConfig(), {
      onFocus: focus => { focuses.push(focus); }
    }, candleRows);

    const wickBar = () => container.querySelector(getIdCssSelector('series', 'wick') + ' path')!;
    wickBar().dispatchEvent(new MouseEvent('click', {}));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('body');

    wickBar().dispatchEvent(new MouseEvent('click', {}));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });
});

describe('followSeries legend filtering', () => {
  // A body with two legend-less followers (wick + volume) and an unrelated
  // series: a legend click on the body must take both followers with it.
  const candleRows = [
    { month: 'Jan', high: 30, low: 5, open: 10, close: 20, volume: 3, x: 50 },
    { month: 'Feb', high: 40, low: 12, open: 22, close: 25, volume: 4, x: 60 }
  ];

  function candleConfig(): MochartInputConfig {
    return makeConfig({
      legend: { visible: true },
      series: [
        { id: 'wick', property: 'high', rangeProperty: 'low', renderer: 'bar', bar: { widthFraction: 0.2 },
          showInLegend: false, followSeries: 'body' },
        { id: 'body', property: 'close', rangeProperty: 'open', renderer: 'bar' },
        { id: 'volume', property: 'volume', renderer: 'bar', showInLegend: false, followSeries: 'body' },
        { id: 'other', property: 'x', renderer: 'bar' }
      ]
    });
  }

  function clickLegendItem(container: Element, seriesId: string): void {
    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', seriesId)));
    expect(item).not.toBeNull();
    item!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function renderedSeriesIds(container: Element): string[] {
    return ['wick', 'body', 'volume', 'other'].filter(id => container.querySelector(getIdCssSelector('series', id)) !== null);
  }

  it('filters the followers together with their leader and restores them together', () => {
    const filters: Array<{ filteredSeriesIds: Record<string, boolean> }> = [];
    const container = mountChart(candleConfig(), {
      onSeriesFilter: filter => { filters.push(filter); }
    }, candleRows);
    // followers stay out of the legend, so only the body can be clicked
    expect(container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'wick')))).toBeNull();
    expect(renderedSeriesIds(container)).toEqual(['wick', 'body', 'volume', 'other']);

    clickLegendItem(container, 'body');
    expect(filters).toHaveLength(1);
    // the following series derive their state rather than being listed alongside it
    expect(filters[0].filteredSeriesIds).toEqual({ body: true });
    expect(renderedSeriesIds(container)).toEqual(['other']);

    clickLegendItem(container, 'body');
    expect(filters).toHaveLength(2);
    expect(filters[1].filteredSeriesIds).toEqual({});
    expect(renderedSeriesIds(container)).toEqual(['wick', 'body', 'volume', 'other']);
  });

  it('ignores a follower id in the host filter map, and keeps the key inert', () => {
    const filters: Array<{ filteredSeriesIds: Record<string, boolean> }> = [];
    const container = mountChart(candleConfig(), {
      onSeriesFilter: filter => { filters.push(filter); },
      filteredSeriesIds: { volume: true }
    }, candleRows);
    // a following series has no filter state of its own, so the host's key filters nothing
    expect(renderedSeriesIds(container)).toEqual(['wick', 'body', 'volume', 'other']);

    clickLegendItem(container, 'body');
    expect(filters[0].filteredSeriesIds).toEqual({ volume: true, body: true });
    expect(renderedSeriesIds(container)).toEqual(['other']);

    clickLegendItem(container, 'body');
    expect(filters[1].filteredSeriesIds).toEqual({ volume: true });
    expect(renderedSeriesIds(container)).toEqual(['wick', 'body', 'volume', 'other']);
  });

  it('ignores a follower id in the host focusedSeriesId', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(candleConfig(), {
      onFocus: focus => { focuses.push(focus); },
      focusedSeriesId: 'wick'
    }, candleRows);
    expect(focuses).toHaveLength(0);

    // nothing was focused, so filtering the followed series has no focus to clear
    clickLegendItem(container, 'body');
    expect(focuses).toHaveLength(0);
    expect(renderedSeriesIds(container)).toEqual(['other']);
  });

  it('reports no focus change when the leader click leaves the focused series alone', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(candleConfig(), {
      onFocus: focus => { focuses.push(focus); },
      focusedSeriesId: 'other'
    }, candleRows);
    const otherOpacity = () => container.querySelector(getIdCssSelector('series', 'other') + ' path')!.getAttribute('fill-opacity');
    const focusedOpacity = otherOpacity();

    clickLegendItem(container, 'body');
    expect(focuses).toHaveLength(0);
    // the unrelated series keeps its focused look through the filter change
    expect(otherOpacity()).toBe(focusedOpacity);
  });
});

describe('showPointer', () => {
  it('sets the pointer cursor on the series root only when configured', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales', renderer: 'bar', showPointer: true }, { property: 'costs', renderer: 'bar' }]
    }));
    expect(container.querySelector(getIdCssSelector('series', 'S0'))!.getAttribute('cursor')).toBe('pointer');
    expect(container.querySelector(getIdCssSelector('series', 'S1'))!.getAttribute('cursor')).toBeNull();
  });
});

describe('onSeriesClick', () => {
  const barSeries = {
    series: [{ property: 'sales', renderer: 'bar' }, { property: 'costs', renderer: 'bar' }]
  };

  it('reports a bar click with series id, category index and nearest category, without focusOnClick', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig(barSeries), {
      onSeriesClick: payload => { clicks.push(payload); },
      onFocus: focus => { focuses.push(focus); }
    });

    const bar = container.querySelector(getIdCssSelector('series', 'S0') + ' ' + getCssClassMatchSelector(getIdCssClass('seriesBar', '1')))!;
    bar.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 100 }));
    expect(clicks).toEqual([{ seriesId: 'S0', categoryIndex: 1, nearestCategoryIndex: 1 }]);
    // the callback alone enabled the click handler; no focusOnClick means no focus change
    expect(focuses.length).toBe(0);
  });

  it('reports categoryIndex -1 and the nearest category for a line path click', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const container = mountChart(makeConfig(), {
      onSeriesClick: payload => { clicks.push(payload); }
    });

    const line = container.querySelector(getIdCssSelector('series', 'S0') + ' path' + getCssSelector('seriesLine'))!;
    line.dispatchEvent(new MouseEvent('click', { clientX: 790, clientY: 100 }));
    expect(clicks).toEqual([{ seriesId: 'S0', categoryIndex: -1, nearestCategoryIndex: rows.length - 1 }]);
  });

  it('maps bars of a series with missing values back to raw category indices', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const data = [{ month: 'Jan', sales: 10 }, { month: 'Feb' }, { month: 'Mar', sales: 30 }];
    const container = mountChart(makeConfig({ series: [{ property: 'sales', renderer: 'bar' }] }), {
      onSeriesClick: payload => { clicks.push(payload); }
    }, data);

    const bars = container.querySelectorAll(getIdCssSelector('series', 'S0') + ' ' + getCssClassMatchSelector(getIdCssClass('seriesBar', '')));
    expect(bars.length).toBe(2);
    bars[bars.length - 1].dispatchEvent(new MouseEvent('click', { clientX: 700, clientY: 100 }));
    expect(clicks.length).toBe(1);
    expect(clicks[0].seriesId).toBe('S0');
    expect(clicks[0].categoryIndex).toBe(2);
  });

  it('reports the leader series for a follower shape click, alongside focusOnClick', () => {
    const clicks: ChartSeriesClickPayload[] = [];
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [
        { id: 'wick', property: 'high', rangeProperty: 'low', renderer: 'bar', bar: { widthFraction: 0.2 },
          showInLegend: false, followSeries: 'body', focusOnClick: true },
        { id: 'body', property: 'close', rangeProperty: 'open', renderer: 'bar', focusOnClick: true }
      ]
    }), {
      onSeriesClick: payload => { clicks.push(payload); },
      onFocus: focus => { focuses.push(focus); }
    }, [
      { month: 'Jan', high: 30, low: 5, open: 10, close: 20 },
      { month: 'Feb', high: 40, low: 12, open: 22, close: 25 }
    ]);

    const wickBar = container.querySelector(getIdCssSelector('series', 'wick') + ' path')!;
    wickBar.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
    expect(clicks.length).toBe(1);
    expect(clicks[0].seriesId).toBe('body');
    // the configured focus toggle still fires alongside the report
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('body');
  });
});

// Regression: legend focus-on-click cleared the focus whenever anything was
// focused instead of toggling per series like every other click-to-focus site.
describe('legend focus on click', () => {
  it('moves the focus to the clicked item and toggles the focused one', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      legend: { focusOnClick: true },
      series: [{ property: 'sales' }, { property: 'costs' }]
    }), { onFocus: focus => { focuses.push(focus); } });

    const itemFor = (id: string) => container.querySelector(getIdCssSelector('legendItem', id))!;
    itemFor('S0').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');

    itemFor('S1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');

    itemFor('S1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });
});

// Regression: a value-axis click always emitted its own id, so the focus set
// by a click could never be cleared by repeating it like every other
// click-to-focus site.
describe('value axis focus on click', () => {
  it('moves the focus to the clicked axis and toggles the focused one', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales', axis: 'left' }, { property: 'costs', axis: 'right' }],
      valueAxes: [{ id: 'left', focusOnClick: true }, { id: 'right', focusOnClick: true }]
    }), { onFocus: focus => { focuses.push(focus); } });

    // the axis class is on the outer group; the event listeners live on its inner group
    const axisFor = (id: string) => container.querySelector(getIdCssSelector('valueAxis', id) + ' > g')!;
    axisFor('left').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBe('left');

    axisFor('right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBe('right');

    axisFor('right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBeNull();
  });
});

// Regression: removing the tooltip's category left tooltipVisible true at index
// -1, so the next plot click toggled an invisible tooltip and was swallowed.
describe('tooltip on a removed category', () => {
  it('closes fully so the next click opens a tooltip again', () => {
    const container = mountChart(makeConfig());
    const handle = lastHandle();
    const root = chartRoot(container);

    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();

    handle.update({ data: [{ month: 'Feb', sales: 20, costs: 8 }, { month: 'Mar', sales: 30, costs: 13 }] } as Partial<DefaultChartProps>);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();

    mouse(root, 'click', 100, 100);
    expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
  });
});

// Regression: the tooltip's last-line style was keyed to the raw config index,
// so a filtered tail left every rendered row with bottom padding.
describe('tooltip last-line style', () => {
  it('drops the bottom padding on the last rendered row', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs', showInTooltip: false }]
    }));
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const rows = container.querySelectorAll(getDescendantCssSelector('tooltip', 'tooltipSeriesLine')) as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(1);
    // the last rendered row keeps only the uniform item padding (2px), not
    // the 3px lineSpacing that separates non-final rows
    expect(rows[0].style.paddingBottom).toBe('2px');
  });

  it('keeps the padding on non-final rows', () => {
    const container = mountChart(makeConfig({
      series: [{ property: 'sales' }, { property: 'costs' }]
    }));
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);

    const rows = container.querySelectorAll(getDescendantCssSelector('tooltip', 'tooltipSeriesLine')) as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].style.paddingBottom).toBe('3px');
    expect(rows[1].style.paddingBottom).toBe('2px');
  });
});

// A tap emulates hover before its click (pointerenter, then the mouse burst that also DOM-focuses
// the target), which used to focus the series for a frame before the click's filter cleared it.
describe('touch and pointer focus never count as hover', () => {
  function touch(target: Element, type: string): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch' }));
  }

  function withFocusVisible(matches: boolean, run: () => void): void {
    vi.stubGlobal('CSS', { supports: (query: string) => query === 'selector(:focus-visible)' });
    const spy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' ? matches : false;
    });
    try {
      run();
    }
    finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  }

  const twoSeries = { series: [{ property: 'sales' }, { property: 'costs' }] };

  it('filters on a legend tap without focusing the series first', () => {
    const focuses: ChartFocus[] = [];
    const filters: unknown[] = [];
    const container = mountChart(makeConfig({ legend: { visible: true }, ...twoSeries }), {
      onFocus: focus => { focuses.push(focus); },
      onSeriesFilter: filter => { filters.push(filter); }
    });
    const item = container.querySelector(getIdCssSelector('legendItem', 'S1'))!;

    touch(item, 'pointerenter');
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    touch(item, 'pointerleave');

    expect(filters.length).toBe(1);
    expect(focuses).toEqual([]);
  });

  it('mirrors keyboard focus on a legend item into series focus, but not pointer focus', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ legend: { visible: true }, ...twoSeries }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const item = container.querySelector(getIdCssSelector('legendItem', 'S1'))!;

    withFocusVisible(false, () => {
      item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focuses).toEqual([]);

    withFocusVisible(true, () => {
      item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');
  });

  it('ignores touch on series shapes and the value axis', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales', renderer: 'bar', focusOnHover: true, focusCategoryOnHover: true }]
    }), { onFocus: focus => { focuses.push(focus); } });

    touch(container.querySelector(getIdCssSelector('seriesBar', 1))!, 'pointerenter');
    touch(container.querySelector(getCssSelector('valueAxis') + ' > g')!, 'pointerenter');
    expect(focuses).toEqual([]);

    mouse(container.querySelector(getIdCssSelector('seriesBar', 1))!, 'pointerenter', 100, 100);
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: 'S0', focusedCategoryIndex: 1 });
  });

  it('ignores touch and pointer focus on tooltip rows', () => {
    const focuses: ChartFocus[] = [];
    // the controls' filter mode makes the rows interactive (focusable) and hover-focusing
    const container = mountChart(makeConfig({ ...twoSeries, tooltip: { showControls: true } }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const before = focuses.length;

    const row = container.querySelector(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', 'S1')))!;
    touch(row, 'pointerenter');
    withFocusVisible(false, () => {
      row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focuses.length).toBe(before);

    withFocusVisible(true, () => {
      row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S1');
  });

  // a tap's ignored enter is followed by a leave (before the click) that used to clear focus unconditionally
  it('keeps a pinned series focus across a tap on bars, the series group and the value axis', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      series: [{ property: 'sales', renderer: 'bar', focusOnHover: true, focusCategoryOnHover: true, focusOnClick: true }],
      valueAxes: [{ focusOnClick: true }]
    }), { onFocus: focus => { focuses.push(focus); } });
    const bar = container.querySelector(getIdCssSelector('seriesBar', 1))!;
    const series = container.querySelector(getIdCssSelector('series', 'S0'))!;
    const axis = container.querySelector(getCssSelector('valueAxis') + ' > g')!;

    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    const pinned = focuses.length;

    for (const target of [bar, series, axis]) {
      touch(target, 'pointerenter');
      touch(target, 'pointerleave');
    }
    expect(focuses.length).toBe(pinned);

    // the tap's click then toggles the focus off, instead of re-focusing what its leave cleared
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();

    // a hover leave still clears
    mouse(bar, 'pointerenter', 100, 100);
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    bar.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerType: 'mouse' }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });

  it('keeps a pinned value axis focus across a tap on the axis', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ valueAxes: [{ focusOnClick: true }] }), { onFocus: focus => { focuses.push(focus); } });
    const axis = container.querySelector(getCssSelector('valueAxis') + ' > g')!;

    axis.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBe('VA0');
    touch(axis, 'pointerenter');
    touch(axis, 'pointerleave');
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBe('VA0');
    axis.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedValueAxisId).toBeNull();
  });

  it('keeps a pinned slice focus across a tap on a pie slice', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({
      chart: { type: 'pie' },
      series: [{ property: 'sales', focusOnHover: true, focusOnClick: true }, { property: 'costs' }]
    }), { onFocus: focus => { focuses.push(focus); } });
    const slice = container.querySelector(getIdCssSelector('series', 'S0') + ' ' + getCssSelector('seriesSlice'))!;

    slice.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    touch(slice, 'pointerenter');
    touch(slice, 'pointerleave');
    expect(focuses[focuses.length - 1].focusedSeriesId).toBe('S0');
    slice.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(focuses[focuses.length - 1].focusedSeriesId).toBeNull();
  });

  it('keeps the pinned category focus across a tap on the tooltip category row', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(makeConfig({ ...twoSeries, tooltip: { focusCategoryOnHover: true } }), {
      onFocus: focus => { focuses.push(focus); }
    });
    const root = chartRoot(container);
    mouse(root, 'mouseenter', 100, 100);
    mouse(root, 'click', 100, 100);
    const pinnedIndex = focuses[focuses.length - 1].focusedCategoryIndex;
    expect(pinnedIndex).toBeGreaterThanOrEqual(0);
    const before = focuses.length;

    const row = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!;
    touch(row, 'pointerenter');
    touch(row, 'pointerleave');
    expect(focuses.length).toBe(before);
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(pinnedIndex);
  });
});
