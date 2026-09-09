// Pointer handlers on cartesian series shapes: focusOnHover and focusCategoryOnHover decide whether
// hovering focuses the series, the category, both or neither, and the shapes carry the resulting handlers.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartFocus, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function mountChart(seriesOverrides: Record<string, unknown>, callbacks: Partial<DefaultChartProps> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', renderer: 'bar', ...seriesOverrides }]
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return container;
}

function bar(container: Element, index: number): Element {
  const shape = container.querySelector(getIdCssSelector('seriesBar', index));
  expect(shape, 'bar ' + index).not.toBeNull();
  return shape!;
}

function mouse(target: Element, type: string): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

// Regression: with one colour member on categoryIndex, the other member kept the series-level
// colour, so a category focus never reached its focused/defocused colour.
describe('category focus colours with a categoryIndex member', () => {
  it('applies the focused and defocused fill when the stroke is categoryIndex', () => {
    const container = mountChart({
      shapeStyle: {
        normal: { strokeColor: 'categoryIndex', fillColor: '#111111' },
        focused: { fillColor: '#ff0000' },
        defocused: { fillColor: '#00ff00' }
      }
    }, { focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    expect(bar(container, 1).getAttribute('fill')).toBe('#ff0000');
    expect(bar(container, 0).getAttribute('fill')).toBe('#00ff00');
    expect(bar(container, 2).getAttribute('fill')).toBe('#00ff00');
  });

  it('applies the focused and defocused stroke when the fill is categoryIndex', () => {
    const container = mountChart({
      shapeStyle: {
        normal: { fillColor: 'categoryIndex', strokeColor: '#111111', strokeWidth: 1 },
        focused: { strokeColor: '#ff0000' },
        defocused: { strokeColor: '#00ff00' }
      }
    }, { focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    expect(bar(container, 1).getAttribute('stroke')).toBe('#ff0000');
    expect(bar(container, 0).getAttribute('stroke')).toBe('#00ff00');
  });
});

// Regression: only shapeStyle.normal decided whether a shape colored per category, so a categoryIndex
// named in the focused or defocused state alone resolved to an empty color attribute
describe('categoryIndex named only in a focus state', () => {
  it('colors the focused bar from the palette rather than emptying its fill', () => {
    const container = mountChart({
      shapeStyle: {
        normal: { fillColor: '#4477aa' },
        focused: { fillColor: 'categoryIndex' }
      }
    }, { focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    const focusedFill = bar(container, 1).getAttribute('fill');
    expect(focusedFill).not.toBe('');
    expect(focusedFill).toMatch(/^#|^rgb/);
    expect(bar(container, 0).getAttribute('fill')).toBe('#4477aa');
  });

  it('colors the defocused bars from the palette rather than emptying their stroke', () => {
    const container = mountChart({
      shapeStyle: {
        normal: { strokeColor: '#4477aa', strokeWidth: 1 },
        defocused: { strokeColor: 'categoryIndex' }
      }
    }, { focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    const defocusedStroke = bar(container, 0).getAttribute('stroke');
    expect(defocusedStroke).not.toBe('');
    expect(defocusedStroke).toMatch(/^#|^rgb/);
    expect(bar(container, 1).getAttribute('stroke')).toBe('#4477aa');
  });

  it('gives two categories different colors when the focused state names categoryIndex', () => {
    const container = mountChart({
      shapeStyle: {
        normal: { fillColor: '#4477aa' },
        focused: { fillColor: 'categoryIndex' },
        defocused: { fillColor: 'categoryIndex' }
      }
    }, { focusedCategoryIndex: 1 } as Partial<DefaultChartProps>);
    expect(bar(container, 0).getAttribute('fill')).not.toBe(bar(container, 2).getAttribute('fill'));
  });
});

describe('series shape hover focus', () => {
  it('reports no focus when neither focus-on-hover config is set', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart({}, { onFocus: focus => focuses.push(focus) });

    mouse(bar(container, 1), 'pointerenter');
    mouse(bar(container, 1), 'pointerleave');

    expect(focuses).toEqual([]);
  });

  it('reports no focus from a line series path either', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart({ renderer: 'line' }, { onFocus: focus => focuses.push(focus) });
    const line = container.querySelector(getCssSelector('seriesLine'))!;

    mouse(line, 'pointerenter');
    mouse(line, 'pointerleave');
    mouse(line, 'click');

    expect(focuses).toEqual([]);
  });

  it('focuses the series and the category when both configs are set', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(
      { id: 'sales', focusOnHover: true, focusCategoryOnHover: true },
      { onFocus: focus => focuses.push(focus) });

    mouse(bar(container, 1), 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: 'sales', focusedCategoryIndex: 1 });

    mouse(bar(container, 1), 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: null, focusedCategoryIndex: -1 });
  });

  it('focuses only the series when the category config is off', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(
      { id: 'sales', focusOnHover: true, focusCategoryOnHover: false },
      { onFocus: focus => focuses.push(focus) });

    mouse(bar(container, 2), 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: 'sales', focusedCategoryIndex: -1 });

    mouse(bar(container, 2), 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: null });
  });

  it('focuses only the category when the series config is off', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(
      { id: 'sales', focusOnHover: false, focusCategoryOnHover: true },
      { onFocus: focus => focuses.push(focus) });

    mouse(bar(container, 0), 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: null, focusedCategoryIndex: 0 });

    mouse(bar(container, 0), 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: -1 });
  });

  // markers carry the same per-category handlers as bars
  it('focuses a category from a marker, and clicks it', () => {
    const focuses: ChartFocus[] = [];
    const clicks: string[] = [];
    const container = mountChart(
      { id: 'sales', renderer: 'line', marker: { shape: 'circle' }, focusCategoryOnHover: true, focusCategoryOnClick: true },
      { onFocus: focus => focuses.push(focus), onSeriesClick: payload => clicks.push(payload.seriesId) });
    const marker = container.querySelector(getIdCssSelector('seriesMarker', '1'))!;
    expect(marker).not.toBeNull();

    mouse(marker, 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: 1 });

    mouse(marker, 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: -1 });

    mouse(marker, 'click');
    expect(clicks).toEqual(['sales']);
  });

  // labels carry the same per-category handlers as bars and markers
  it('focuses a category from a label, and clicks it', () => {
    const focuses: ChartFocus[] = [];
    const clicks: string[] = [];
    const container = mountChart(
      { id: 'sales', labelProperty: 'sales', focusCategoryOnHover: true, focusCategoryOnClick: true },
      { onFocus: focus => focuses.push(focus), onSeriesClick: payload => clicks.push(payload.seriesId) });
    const label = container.querySelector(getIdCssSelector('seriesLabel', '2'))!;
    expect(label).not.toBeNull();

    mouse(label, 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: 2 });

    mouse(label, 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedCategoryIndex: -1 });

    mouse(label, 'click');
    expect(clicks).toEqual(['sales']);
  });

  // only line/area series have a whole-series shape; bars carry per-category handlers
  it('focuses the series from a line series path', () => {
    const focuses: ChartFocus[] = [];
    const container = mountChart(
      { id: 'sales', renderer: 'line', focusOnHover: true },
      { onFocus: focus => focuses.push(focus) });
    const line = container.querySelector(getCssSelector('seriesLine'))!;
    expect(line).not.toBeNull();

    mouse(line, 'pointerenter');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: 'sales' });

    mouse(line, 'pointerleave');
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: null });
  });
});
