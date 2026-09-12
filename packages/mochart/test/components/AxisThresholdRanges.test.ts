// Threshold ranges: a rangeValue fills the band between two axis values, with edge lines, fills by style,
// pattern or gradient, ordinal placement by category slot, domain clipping, and the inside/align title placements
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 50 },
  { month: 'Mar', sales: 100 }
];
const linearRows = [
  { x: 0, sales: 10 },
  { x: 50, sales: 50 },
  { x: 100, sales: 100 }
];

function mount(overrides: Record<string, unknown>, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  const config = {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

function valueThresholds(thresholds: Record<string, unknown>[], extra: Record<string, unknown> = {}): Element {
  return mount({ valueAxes: [{ min: 0, max: 100, thresholds }], ...extra });
}

function linearCategoryThresholds(thresholds: Record<string, unknown>[]): Element {
  return mount({
    categoryAxis: { property: 'x', type: 'number', scale: 'linear', min: 0, max: 100, thresholds },
    series: [{ property: 'sales', renderer: 'line' }]
  }, linearRows);
}

function translation(element: Element | null): { x: number; y: number } {
  expect(element).not.toBeNull();
  const match = /translate\(([^,]+),([^)]+)\)/.exec(element!.getAttribute('transform') ?? '');
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

function rect(container: Element): { x: number; y: number; width: number; height: number; fill: string | null; fillOpacity: string | null } | null {
  const element = container.querySelector(getCssSelector('axisThresholdRange'));
  if (element === null) {
    return null;
  }
  const number = (name: string) => Number(element.getAttribute(name));
  return { x: number('x'), y: number('y'), width: number('width'), height: number('height'), fill: element.getAttribute('fill'), fillOpacity: element.getAttribute('fill-opacity') };
}

/** The translate of every threshold line group (a line entry, or a range's min and max edges). */
function lineTranslations(container: Element): { x: number; y: number }[] {
  return [...container.querySelectorAll(getCssSelector('axisThreshold') + ' line')].map((line) => translation(line.parentElement));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('threshold ranges on a value axis', () => {
  it('fills the band between the two values, in either order, with an edge line at each', () => {
    const lines = lineTranslations(valueThresholds([{ value: 20 }, { value: 60 }]));
    const band = rect(valueThresholds([{ value: 60, rangeValue: 20 }]));
    expect(band).not.toBeNull();
    const top = Math.min(lines[0]!.y, lines[1]!.y);
    const bottom = Math.max(lines[0]!.y, lines[1]!.y);
    expect(band!.y).toBeCloseTo(top, 5);
    expect(band!.height).toBeCloseTo(bottom - top, 5);
    const edges = lineTranslations(valueThresholds([{ value: 60, rangeValue: 20 }])).map((edge) => edge.y).sort((a, b) => a - b);
    expect(edges).toEqual([top, bottom]);
  });

  it('fills with the style fill members and strokes the edges with the stroke members', () => {
    const container = valueThresholds([{ value: 20, rangeValue: 60, style: { normal: { fillColor: 'red', fillOpacity: 0.3, strokeColor: 'blue', strokeWidth: 2 } } }]);
    const band = rect(container)!;
    expect(band.fill).toBe('red');
    expect(band.fillOpacity).toBe('0.3');
    const edge = container.querySelector(getCssSelector('axisThresholdMax') + ' line')!;
    expect(edge.getAttribute('stroke')).toBe('blue');
    expect(edge.getAttribute('stroke-width')).toBe('2');
  });

  it('clips a range to the axis domain, dropping the edge line outside it, and skips one wholly outside', () => {
    const lines = lineTranslations(valueThresholds([{ value: 50 }]));
    const clipped = valueThresholds([{ value: 50, rangeValue: 150 }]);
    const band = rect(clipped)!;
    expect(band.height).toBeGreaterThan(0);
    expect(band.y + band.height).toBeCloseTo(lines[0]!.y, 5);
    expect(lineTranslations(clipped)).toHaveLength(1);
    const outside = valueThresholds([{ value: 150, rangeValue: 250 }]);
    expect(rect(outside)).toBeNull();
    expect(lineTranslations(outside)).toHaveLength(0);
  });

  it('fills with a pattern or gradient definition by id', () => {
    const patterned = valueThresholds([{ value: 20, rangeValue: 60, pattern: 'hatch', style: { normal: { fillColor: 'purple' } } }],
      { patterns: [{ id: 'hatch', type: 'lines' }] });
    const patternFill = rect(patterned)!.fill!;
    expect(patternFill).toMatch(/^url\(#/);
    const patternId = patternFill.slice(5, -1);
    expect(patterned.querySelector('pattern[id="' + patternId + '"]')).not.toBeNull();
    const gradiented = valueThresholds([{ value: 20, rangeValue: 60, gradient: 'fade' }],
      { linearGradients: [{ id: 'fade', stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue', opacity: 1 }] }] });
    const gradientFill = rect(gradiented)!.fill!;
    expect(gradientFill).toMatch(/^url\(#/);
    expect(gradiented.querySelector('linearGradient[id="' + gradientFill.slice(5, -1) + '"]')).not.toBeNull();
  });

  it('centres an inside title within the band and a middle-aligned one along it', () => {
    const container = valueThresholds([{ value: 20, rangeValue: 60, title: { text: 'Band', side: 'inside', align: 'middle' } }]);
    const band = rect(container)!;
    const title = translation(container.querySelector(getCssSelector('axisThresholdTitle')));
    expect(title.y).toBeGreaterThan(band.y);
    expect(title.y).toBeLessThan(band.y + band.height);
    expect(title.x).toBeGreaterThan(band.x);
    expect(title.x).toBeLessThan(band.x + band.width);
  });
});

describe('threshold ranges on a category axis', () => {
  it('fills the band across a linear category axis', () => {
    const lines = lineTranslations(linearCategoryThresholds([{ value: 25 }, { value: 75 }]));
    const band = rect(linearCategoryThresholds([{ value: 25, rangeValue: 75 }]))!;
    const left = Math.min(lines[0]!.x, lines[1]!.x);
    expect(band.x).toBeCloseTo(left, 5);
    expect(band.width).toBeCloseTo(Math.abs(lines[1]!.x - lines[0]!.x), 5);
  });

  it('places an ordinal line at the category centre and a range over whole slots', () => {
    const jan = lineTranslations(mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', thresholds: [{ value: 'Jan' }] } }))[0]!.x;
    const feb = lineTranslations(mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', thresholds: [{ value: 'Feb' }] } }))[0]!.x;
    const slot = feb - jan;
    expect(slot).toBeGreaterThan(0);
    const band = rect(mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', thresholds: [{ value: 'Jan', rangeValue: 'Feb' }] } }))!;
    expect(band.x).toBeCloseTo(jan - slot / 2, 5);
    expect(band.x + band.width).toBeCloseTo(feb + slot / 2, 5);
  });

  it('names a category by its key on an axis with a keyProperty', () => {
    const keyedRows = [{ month: 'Jan', id: 'a', sales: 1 }, { month: 'Jan', id: 'b', sales: 2 }, { month: 'Feb', id: 'c', sales: 3 }];
    const byKey = mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', keyProperty: 'id', thresholds: [{ value: 'b' }] } }, keyedRows);
    expect(lineTranslations(byKey)).toHaveLength(1);
    const byValue = mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', keyProperty: 'id', thresholds: [{ value: 'Jan' }] } }, keyedRows);
    expect(lineTranslations(byValue)).toHaveLength(0);
  });

  it('matches ordinal date categories by instant, and draws nothing for an unmatched category', () => {
    const dateRows = [{ day: '2026-06-01', sales: 1 }, { day: '2026-06-02', sales: 2 }, { day: '2026-06-03', sales: 3 }];
    const matched = mount({ categoryAxis: { property: 'day', type: 'date', scale: 'ordinal', thresholds: [{ value: '2026-06-01', rangeValue: Date.UTC(2026, 5, 2) }] } }, dateRows);
    expect(rect(matched)).not.toBeNull();
    const unmatched = mount({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', thresholds: [{ value: 'Zed', rangeValue: 'Feb' }, { value: 'Zed' }] } });
    expect(rect(unmatched)).toBeNull();
    expect(lineTranslations(unmatched)).toHaveLength(0);
  });
});
