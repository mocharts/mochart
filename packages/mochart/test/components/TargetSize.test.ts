// accessibility.minTargetSize: the floor for the chart's own click targets (legend items, tooltip control buttons, interactive tooltip rows) while series shapes keep their data geometry.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 'sales' },
      { id: 'S1', property: 'costs' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT }));
  return container;
}

/** the rect that takes the pointer for a legend item: the item box inside its margin */
function legendItemBoxes(container: Element): SVGRectElement[] {
  return Array.from(container.querySelectorAll<SVGRectElement>(getCssSelector('legendItemBackground') + ' rect'));
}

function boxSize(rect: SVGRectElement): { width: number; height: number } {
  return { width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height')) };
}

function openTooltip(container: Element): void {
  const root = container.querySelector(getChartRootCssSelector())!;
  root.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
  root.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
  expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
}

function controlButtons(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(getCssSelector('tooltip') + ' ' + getCssSelector('tooltipControls') + ' button'));
}

/** one series row of a tooltip copy: the shown one, or the hidden sizer that measures it */
function seriesRow(container: Element, copyKey: 'tooltip' | 'tooltipSizer', seriesId: string): HTMLElement {
  return container.querySelector<HTMLElement>(getCssSelector(copyKey) + ' ' + getIdCssSelector('tooltipSeriesLine', seriesId))!;
}

function categoryRow(container: Element): HTMLElement {
  return container.querySelector<HTMLElement>(getCssSelector('tooltip') + ' ' + getCssSelector('tooltipCategoryLine'))!;
}

beforeAll(() => {
  installSvgMeasurementShims();
  // jsdom reports zero-size rects; report the mounted chart size instead so the
  // chart's pointer hit-testing (clientX/Y against the plot rect) works
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('legend item click targets', () => {
  it('lays the item boxes out to the 24px default, which their content misses', () => {
    const floored = mountChart(makeConfig({ legend: { visible: true } }));
    const unfloored = mountChart(makeConfig({ legend: { visible: true }, accessibility: { minTargetSize: 0 } }));

    // the measured content box is 22px tall here, so the default floor is doing the work
    expect(legendItemBoxes(unfloored).map(rect => boxSize(rect).height)).toEqual([22, 22]);
    expect(legendItemBoxes(floored).map(rect => boxSize(rect).height)).toEqual([24, 24]);
  });

  it('applies the floor in both directions', () => {
    const container = mountChart(makeConfig({ legend: { visible: true }, accessibility: { minTargetSize: 60 } }));

    for (const rect of legendItemBoxes(container)) {
      expect(boxSize(rect)).toEqual({ width: 60, height: 60 });
    }
  });

  it('leaves items nothing responds to at their content size', () => {
    const inert = mountChart(makeConfig({ legend: { visible: true, filterOnClick: false, focusOnClick: false } }));
    const focusing = mountChart(makeConfig({ legend: { visible: true, filterOnClick: false, focusOnClick: true } }));

    expect(legendItemBoxes(inert).map(rect => boxSize(rect).height)).toEqual([22, 22]);
    expect(legendItemBoxes(focusing).map(rect => boxSize(rect).height)).toEqual([24, 24]);
  });

  it('applies the floor with accessibility disabled or hidden, neither of which stops pointer clicks', () => {
    const disabled = mountChart(makeConfig({ legend: { visible: true }, accessibility: { enabled: false } }));
    const hidden = mountChart(makeConfig({ legend: { visible: true }, accessibility: { hidden: true } }));

    expect(legendItemBoxes(disabled).map(rect => boxSize(rect).height)).toEqual([24, 24]);
    expect(legendItemBoxes(hidden).map(rect => boxSize(rect).height)).toEqual([24, 24]);
  });
});

describe('tooltip click targets', () => {
  it('floors the controls buttons and the ends they sit in', () => {
    const container = mountChart(makeConfig({ legend: { visible: false }, tooltip: { showControls: true }, accessibility: { minTargetSize: 44 } }));
    openTooltip(container);

    const buttons = controlButtons(container);
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button.style.minHeight).toBe('44px');
    }
    // the ‹ / › buttons fill a fixed-width container, so the floor has to reach that too
    expect((buttons[0].parentElement as HTMLElement).style.width).toBe('44px');
  });

  it('leaves the controls unstyled at the default width and no floor', () => {
    const container = mountChart(makeConfig({ legend: { visible: false }, tooltip: { showControls: true }, accessibility: { minTargetSize: 0 } }));
    openTooltip(container);

    const buttons = controlButtons(container);
    for (const button of buttons) {
      expect(button.style.minHeight).toBe('');
    }
    expect((buttons[0].parentElement as HTMLElement).style.width).toBe('35px');
  });

  it('floors the rows a click acts on and only those', () => {
    const filtering = mountChart(makeConfig({ legend: { visible: false }, tooltip: { filterSeriesOnClick: true } }));
    openTooltip(filtering);

    expect(seriesRow(filtering, 'tooltip', 'S0').style.minHeight).toBe('24px');
    expect(seriesRow(filtering, 'tooltip', 'S1').style.minHeight).toBe('24px'); // the last row too, which drops its bottom padding
    expect(categoryRow(filtering).style.minHeight).toBe(''); // clicking it does nothing here

    const inert = mountChart(makeConfig({ legend: { visible: false } }));
    openTooltip(inert);

    expect(seriesRow(inert, 'tooltip', 'S0').style.minHeight).toBe('');
    expect(categoryRow(inert).style.minHeight).toBe('');
  });

  it('floors the same rows in the hidden sizer copy, and does not resize on a mode toggle', () => {
    const container = mountChart(makeConfig({ legend: { visible: false }, tooltip: { showControls: true } }));
    openTooltip(container);

    // the sizer measures what the shown copy renders, so its rows carry the same floor
    expect(seriesRow(container, 'tooltipSizer', 'S0').style.minHeight).toBe('24px');
    expect(seriesRow(container, 'tooltip', 'S0').style.minHeight).toBe('24px');
    expect(categoryRow(container).style.minHeight).toBe('24px');

    // filter mode acts on the series rows, focus mode on the category row: both are
    // targets under the controls, so toggling must not change any row's height
    const modeButton = controlButtons(container).find(button => button.textContent === 'Filter')!;
    modeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(controlButtons(container).some(button => button.textContent === 'Focus')).toBe(true);
    expect(seriesRow(container, 'tooltip', 'S0').style.minHeight).toBe('24px');
    expect(categoryRow(container).style.minHeight).toBe('24px');
  });
});

describe('series shapes', () => {
  it('keeps its data geometry: the floor never pads a shape', () => {
    const floored = mountChart(makeConfig({ legend: { visible: false }, accessibility: { minTargetSize: 60 } }));
    const unfloored = mountChart(makeConfig({ legend: { visible: false }, accessibility: { minTargetSize: 0 } }));

    const shapes = (container: Element): string =>
      container.querySelector(getCssSelector('seriesContainer'))!.innerHTML;
    expect(shapes(floored)).toBe(shapes(unfloored));
  });
});
