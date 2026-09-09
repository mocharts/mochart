// The nine axis `*Front` switches, each moving one piece of axis chrome from the back plot layer to the front one
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getDescendantCssSelector } from '../../src/utils/ChartDom';
import type { MochartCssClassKey } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

// a negative row puts base 0 inside the domain, which is what makes the base line drawn at all
const rows = [
  { month: 'Jan', sales: -10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

// overrides merge one group deep, so a switch on a group keeps the group's other members
function withOverrides(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    merged[key] = existing !== null && typeof existing === 'object' && value !== null && typeof value === 'object'
      ? { ...existing, ...value } : value;
  }
  return merged;
}

function mountChart(categoryOverrides: Record<string, unknown>, valueOverrides: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    // every optional piece of chrome switched on, so each layer test has something to move
    categoryAxis: withOverrides({ property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Month' },
      focusRange: { visible: true }, gridLine: { visible: true } }, categoryOverrides),
    valueAxes: [withOverrides({ id: 'VA0', title: { text: 'Sales' }, base: 0,
      focusTickMark: { visible: true }, gridLine: { visible: true } }, valueOverrides)],
    series: [{ axis: 'VA0', property: 'sales', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

/** How many of a chrome element sit in the named plot layer. */
function countIn(container: Element, layer: 'plotBack' | 'plotFront', keys: MochartCssClassKey[]): number {
  return container.querySelectorAll(getDescendantCssSelector(layer, ...keys)).length;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

// each front switch (a flat key, or a group whose front member it is), the axis it is set on, and the chrome element it moves
const switches: Array<{ key: string; axis: 'category' | 'value'; path: MochartCssClassKey[] }> = [
  { key: 'backgroundFront', axis: 'category', path: ['categoryAxis', 'axisBackground'] },
  { key: 'backgroundFront', axis: 'value', path: ['valueAxis', 'axisBackground'] },
  { key: 'axisLine', axis: 'category', path: ['categoryAxis', 'axisLine'] },
  { key: 'axisLine', axis: 'value', path: ['valueAxis', 'axisLine'] },
  { key: 'focusRange', axis: 'category', path: ['categoryAxis', 'axisFocusRange'] },
  { key: 'focusRange', axis: 'value', path: ['valueAxis', 'axisFocusRange'] },
  { key: 'tickMark', axis: 'category', path: ['categoryAxis', 'axisTickMarks'] },
  { key: 'tickMark', axis: 'value', path: ['valueAxis', 'axisTickMarks'] },
  { key: 'tickLabel', axis: 'category', path: ['categoryAxis', 'axisTickLabels'] },
  { key: 'tickLabel', axis: 'value', path: ['valueAxis', 'axisTickLabels'] },
  { key: 'title', axis: 'category', path: ['categoryAxis', 'axisTitle'] },
  { key: 'title', axis: 'value', path: ['valueAxis', 'axisTitle'] },
  { key: 'focusTickMark', axis: 'category', path: ['categoryAxis', 'axisFocusTickMarks'] },
  { key: 'focusTickMark', axis: 'value', path: ['valueAxis', 'axisFocusTickMarks'] },
  { key: 'gridLine', axis: 'category', path: ['categoryAxisGrid'] },
  { key: 'gridLine', axis: 'value', path: ['valueAxisGrid'] },
  { key: 'baseLine', axis: 'value', path: ['valueAxisBaseLine'] }
];

describe('axis chrome layer', () => {
  for (const { key, axis, path } of switches) {
    const what = path.join(' > ');
    it(`keeps ${what} behind the series until ${axis} axis ${key === 'backgroundFront' ? key : key + '.front'} moves it in front`, () => {
      const on = key === 'backgroundFront' ? { [key]: true } : { [key]: { front: true } };
      const front = axis === 'category' ? mountChart(on) : mountChart({}, on);
      const back = mountChart({});

      // the default layer holds it and the other is empty, and setting the switch swaps that
      expect(countIn(back, 'plotBack', path)).toBeGreaterThan(0);
      expect(countIn(back, 'plotFront', path)).toBe(0);
      expect(countIn(front, 'plotFront', path)).toBe(countIn(back, 'plotBack', path));
      expect(countIn(front, 'plotBack', path)).toBe(0);
    });
  }

  it('moves only the switched piece, leaving the rest of the axis behind', () => {
    const container = mountChart({ title: { front: true } });

    expect(countIn(container, 'plotFront', ['categoryAxis', 'axisTitle'])).toBe(1);
    expect(countIn(container, 'plotFront', ['categoryAxis', 'axisTickLabels'])).toBe(0);
    expect(countIn(container, 'plotBack', ['categoryAxis', 'axisTickLabels'])).toBe(1);
    expect(countIn(container, 'plotBack', ['categoryAxis', 'axisLine'])).toBe(1);
  });
});

