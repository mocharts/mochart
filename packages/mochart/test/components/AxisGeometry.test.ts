// Regression tests for inverted-chart geometry: category-axis threshold position and per-side series label positions
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';
import { getRotatedBounds } from '../../src/layout/RotatedLayoutInfo';

const VERSION = '1.0.0';

function mountChart(config: Record<string, unknown>, data: readonly unknown[]): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: { version: VERSION, animation: { enabled: false }, ...config } as unknown as MochartInputConfig,
    data, width: 800, height: 600
  } as DefaultChartProps));
  return container;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

function thresholdTranslateY(container: Element): number {
  const lineGroup = container.querySelector(getDescendantCssSelector('categoryAxisThreshold', 'axisThreshold') + ' > g');
  expect(lineGroup).not.toBeNull();
  const transform = lineGroup!.getAttribute('transform')!;
  return Number(transform.match(/translate\([^,]+,\s*([^)]+)\)/)![1]);
}

// Regression: the vertical branch assumed the bottom-up value-axis pixel convention,
// but a vertical category axis ascends top-down, so category thresholds rendered mirrored
describe('category-axis threshold on an inverted chart', () => {
  it('places a low threshold nearer the top than a high one', () => {
    const rows = Array.from({ length: 11 }, (_, g) => ({ g, value: g * 2 }));
    const configFor = (threshold: number) => ({
      plot: { inverted: true },
      categoryAxis: { property: 'g', type: 'number', scale: 'linear', thresholds: [{ value: threshold }] },
      series: [{ property: 'value', renderer: 'bar' }]
    });
    const lowY = thresholdTranslateY(mountChart(configFor(2), rows));
    const highY = thresholdTranslateY(mountChart(configFor(8), rows));
    expect(lowY).toBeLessThan(highY);
  });
});

// Regression: getLabelPosition got the chart orientation as isAboveBase and dy came
// from the raw labelPosition, so labelAboveBasePosition/labelBelowBasePosition never applied
describe('per-side series label positions', () => {
  const rows = [
    { g: 'A', value: 5 },
    { g: 'B', value: -3 }
  ];

  function labelAttrs(container: Element, index: number): { dy: string | null; anchor: string | null } {
    const label = container.querySelector(getIdCssSelector('seriesLabel', index));
    expect(label).not.toBeNull();
    return { dy: label!.getAttribute('dy'), anchor: label!.getAttribute('text-anchor') };
  }

  it('applies labelAboveBasePosition to the above-base dy', () => {
    const container = mountChart({
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal' },
      valueAxes: [{ base: 0 }],
      series: [{ property: 'value', renderer: 'bar', labelProperty: 'value', label: { position: 'outside', aboveBase: { position: 'inside' } } }]
    }, rows);
    expect(labelAttrs(container, 0).dy).toBe('1.35em');   // above base, inside
    expect(labelAttrs(container, 1).dy).toBe('1.35em');   // below base, outside
  });

  it('applies labelBelowBasePosition to the below-base anchor on inverted charts', () => {
    const container = mountChart({
      plot: { inverted: true },
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal' },
      valueAxes: [{ base: 0 }],
      series: [{ property: 'value', renderer: 'bar', labelProperty: 'value', label: { position: 'outside', belowBase: { position: 'inside' } } }]
    }, rows);
    expect(labelAttrs(container, 0).anchor).toBe('start'); // above base, outside
    expect(labelAttrs(container, 1).anchor).toBe('start'); // below base, inside
  });
});

describe('multiple thresholds on one axis', () => {
  it('renders one line per entry, layered by front', () => {
    const rows = Array.from({ length: 5 }, (_, g) => ({ g: String(g), value: g * 10 }));
    const container = mountChart({
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal' },
      valueAxes: [{
        thresholds: [
          { value: 10, title: { text: 'Warning' } },
          { value: 30, title: { text: 'Critical' }, front: false },
          { value: 35 }
        ]
      }],
      series: [{ property: 'value', renderer: 'bar' }]
    }, rows);
    const lines = container.querySelectorAll(getDescendantCssSelector('axisThresholdContainer', 'axisThreshold') + ' line');
    expect(lines.length).toBe(3);
    const titles = container.querySelectorAll(getCssSelector('axisThresholdTitle'));
    expect(titles.length).toBe(2);
    expect(container.textContent).toContain('Warning');
    expect(container.textContent).toContain('Critical');
  });
});

// Regression: the tick text anchor was offset by half the unrotated label height, so a rotated label
// (whose box is anchor-relative and asymmetric) hung out of its band, past the axis title's edge
describe('rotated tick label placement', () => {
  const rows = [{ g: 'A', value: 5 }, { g: 'B', value: 3 }];
  // shims measure nothing, so every label takes the 20x20 default bounds
  const LABEL = 20;

  function tickLabelTranslate(container: Element, axis: 'categoryAxis' | 'valueAxis'): { x: number; y: number } {
    const label = container.querySelector(getDescendantCssSelector(axis, 'axisTickLabel'));
    expect(label).not.toBeNull();
    const match = /translate\(([^,]+),([^)]+)\)/.exec(label!.getAttribute('transform') ?? '')!;
    return { x: Number(match[1]), y: Number(match[2]) };
  }

  function categoryAnchor(axis: Record<string, unknown>): { x: number; y: number } {
    return tickLabelTranslate(mountChart({
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal', title: { text: 'Cat' }, ...axis },
      series: [{ property: 'value', renderer: 'bar' }]
    }, rows), 'categoryAxis');
  }

  it('starts a 90° label at the inner edge of a bottom axis band, where an unrotated label is centered', () => {
    expect(categoryAnchor({ tickLabel: { rotation: 90 } }).y).toBe(categoryAnchor({}).y - LABEL / 2);
  });

  it('ends a 90° label at the inner edge of a top axis band', () => {
    expect(categoryAnchor({ side: 'start', tickLabel: { rotation: 90 } }).y).toBe(categoryAnchor({ side: 'start' }).y + LABEL / 2);
  });

  it('keeps a 45° label inside a left axis band', () => {
    const rotated = getRotatedBounds({ width: LABEL, height: LABEL }, 45, 'end');
    const unrotatedX = tickLabelTranslate(mountChart({
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal' },
      valueAxes: [{ title: { text: 'Val' } }],
      series: [{ property: 'value', renderer: 'bar' }]
    }, rows), 'valueAxis').x;
    const rotatedX = tickLabelTranslate(mountChart({
      categoryAxis: { property: 'g', type: 'string', scale: 'ordinal' },
      valueAxes: [{ title: { text: 'Val' }, tickLabel: { rotation: 45 } }],
      series: [{ property: 'value', renderer: 'bar' }]
    }, rows), 'valueAxis').x;
    // an unrotated end-anchored label sits at the band's inner edge; the rotated band is wider by the rotated width difference
    const innerEdge = unrotatedX - LABEL + Math.ceil(rotated.width);
    expect(rotatedX + Math.floor(rotated.x) + Math.ceil(rotated.width)).toBe(innerEdge);
  });
});
