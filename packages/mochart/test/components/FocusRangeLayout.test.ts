// Axis title / tick label / focus range box placement for start- and end-side value axes and the category axis.
// The boxes are offset only across the axis (a vertical axis' boxes start at y=0 and span its full height),
// so a titled axis on either side must place its focus range where an untitled one would.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssClass, getIdCssClass, getCssSelector, getCssClassMatchSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

// two mirrored axes carrying the same series values: a titled "start" axis and
// a titled "after" axis. Their focus ranges must land at the same y.
function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Month' }, focusRange: { visible: true } },
    tooltip: { focusSeriesOnHover: true },
    valueAxes: [
      { id: 'VA0', side: 'start', title: { text: 'Left Titled' } },
      { id: 'VA1', side: 'end', title: { text: 'Right Titled' } }
    ],
    series: [
      { id: 'S0', property: 'sales', axis: 'VA0' },
      { id: 'S1', property: 'sales', axis: 'VA1' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

interface Rect { x: number; y: number; width: number; height: number }

function mountChart(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

function chartRoot(container: Element): Element {
  const root = container.querySelector(getChartRootCssSelector());
  expect(root).not.toBeNull();
  return root!;
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

function axisGroup(container: Element, axisClass: string): Element {
  const group = container.querySelector('.' + axisClass);
  expect(group).not.toBeNull();
  return group!;
}

function rect(group: Element, selector: string): Rect {
  const el = group.querySelector(selector);
  expect(el, selector).not.toBeNull();
  return {
    x: Number(el!.getAttribute('x')),
    y: Number(el!.getAttribute('y')),
    width: Number(el!.getAttribute('width')),
    height: Number(el!.getAttribute('height'))
  };
}

// hovering a tooltip series line focuses that series, which is what draws the
// focus range on its axis
function focusSeries(container: Element, seriesId: string): void {
  const root = chartRoot(container);
  mouse(root, 'mouseenter', 100, 100);
  mouse(root, 'click', 100, 100);
  const line = container.querySelector(getCssSelector('tooltip') + ' '
    + getCssClassMatchSelector(getIdCssClass('tooltipSeriesLine', seriesId)));
  expect(line).not.toBeNull();
  line!.dispatchEvent(new MouseEvent('pointerenter', {}));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('axis box placement along the axis', () => {
  it('starts the title and tick label boxes at the top of a vertical axis', () => {
    const container = mountChart(makeConfig());
    for (const axisId of ['VA0', 'VA1']) {
      const group = axisGroup(container, getIdCssClass('valueAxis', axisId));
      expect({ axisId, y: rect(group, getCssSelector('axisTitle') + ' rect').y }).toEqual({ axisId, y: 0 });
      expect({ axisId, y: rect(group, getCssSelector('axisTickLabels') + ' rect').y }).toEqual({ axisId, y: 0 });
    }
  });

  it('starts the title and tick label boxes at the left of the category axis', () => {
    const container = mountChart(makeConfig());
    const group = axisGroup(container, getCssClass('categoryAxis'));
    expect(rect(group, getCssSelector('axisTitle') + ' rect').x).toBe(0);
    expect(rect(group, getCssSelector('axisTickLabels') + ' rect').x).toBe(0);
  });
});

describe('value axis focus range placement', () => {
  it('places the focus range identically on titled before and after axes', () => {
    const before = mountChart(makeConfig());
    focusSeries(before, 'S0');
    const beforeRange = rect(axisGroup(before, getIdCssClass('valueAxis', 'VA0')), getCssSelector('axisFocusRange') + ' rect');

    const after = mountChart(makeConfig());
    focusSeries(after, 'S1');
    const afterRange = rect(axisGroup(after, getIdCssClass('valueAxis', 'VA1')), getCssSelector('axisFocusRange') + ' rect');

    expect(afterRange.y).toBe(beforeRange.y);
    expect(afterRange.height).toBe(beforeRange.height);
  });

  it('keeps the focus range within the axis bounds', () => {
    const container = mountChart(makeConfig());
    focusSeries(container, 'S1');
    const group = axisGroup(container, getIdCssClass('valueAxis', 'VA1'));
    const range = rect(group, getCssSelector('axisFocusRange') + ' rect');
    // the tick label box spans the axis' full length, so it gives the bounds
    const axisHeight = rect(group, getCssSelector('axisTickLabels') + ' rect').height;

    expect(range.y).toBeGreaterThan(0);
    // the focused category's value runs down to the axis base — the smallest value on the axis,
    // which the bottom margin leaves just short of the axis end
    expect(range.y + range.height).toBeLessThan(axisHeight);
    expect(range.y + range.height).toBeCloseTo(472.55, 1);
  });

  // The golden snapshots never activate an axis focus, so its style is pinned here.
  it('styles the focus range with the host page color', () => {
    const container = mountChart(makeConfig());
    focusSeries(container, 'S1');
    const el = axisGroup(container, getIdCssClass('valueAxis', 'VA1'))
      .querySelector(getCssSelector('axisFocusRange') + ' rect')!;
    expect(el.getAttribute('stroke')).toBe('currentColor');
    expect(el.getAttribute('fill')).toBe('currentColor');
    // subtle under the plot on a light page, still readable on a dark one
    expect(el.getAttribute('stroke-opacity')).toBe('0.2');
    expect(el.getAttribute('fill-opacity')).toBe('0.12');
  });

  it('styles the focus tick marks with the host page color', () => {
    const container = mountChart(makeConfig({
      valueAxisDefaults: { focusTickMark: { visible: true } }
    }));
    focusSeries(container, 'S1');
    const el = axisGroup(container, getIdCssClass('valueAxis', 'VA1'))
      .querySelector(getCssSelector('axisFocusTickMarks') + ' line')!;
    expect(el.getAttribute('stroke')).toBe('currentColor');
    expect(el.getAttribute('stroke-opacity')).toBe('1');
  });
});
