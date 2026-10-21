/**
 * A single-category linear category axis draws its one tick at the category value: the domain
 * collapses to that value and the render domain is widened only so the point sits off the midline.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function renderChart(categoryAxis: Record<string, unknown>, data: Record<string, unknown>[]) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'x', scale: 'linear', ...categoryAxis },
    valueAxes: [{ visible: false }],
    series: [{ property: 'value', renderer: 'line' }]
  });
  expect(mochartConfig.validation.valid).toBe(true);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(data), width: 300, height: 200
  });
  runFrames();
  return { container, chart };
}

function categoryTickLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(getCssSelector('categoryAxis') + ' ' + getCssSelector('axisTickLabels') + ' text'))
    .filter(text => text.getAttribute('aria-hidden') !== 'true') // skips the hidden size-measurement label
    .map(text => text.textContent ?? '');
}

// Regression: with auto bounds the one-category branch treated the widened render bounds as the
// ticks, so the labels named two values that exist nowhere in the data and none at the category
describe('single-category linear axis ticks', () => {
  it('draws one number tick at the category value', () => {
    const { container, chart } = renderChart({ type: 'number' }, [{ x: 5, value: 1 }]);
    expect(categoryTickLabels(container)).toEqual(['5.0']);
    chart.destroy();
  });

  it('draws one date tick at the category date', () => {
    const { container, chart } = renderChart({ type: 'date', tickLabel: { format: '%Y-%m-%d' }, dateUTC: true }, [{ x: '2026-01-01T00:00:00Z', value: 1 }]);
    expect(categoryTickLabels(container)).toEqual(['2026-01-01']);
    chart.destroy();
  });

  it('still draws the explicit bounds as ticks when they differ', () => {
    const { container, chart } = renderChart({ type: 'number', min: 0, max: 10 }, [{ x: 5, value: 1 }]);
    expect(categoryTickLabels(container)).toEqual(['0', '10']);
    chart.destroy();
  });
});

// Regression: the lone tick took the first category value even when the bounds left it out, so it was
// drawn off the chart (with parallel labels the edge rule hid it) beside the tick at the bounds' value
describe('lone category tick outside the bounds', () => {
  it('draws the collapsed bounds value when the one category lies outside them', () => {
    const { container, chart } = renderChart({ type: 'number', min: 0, max: 0, tickLabel: { rotation: 45 } }, [{ x: 5, value: 1 }]);
    expect(categoryTickLabels(container)).toEqual(['0']);
    chart.destroy();
  });

  it('draws the collapsed bounds value when every category lies outside them', () => {
    const data = Array.from({ length: 26 }, (_, i) => ({ x: i + 1, value: (i * 7) % 11 }));
    const { container, chart } = renderChart({ type: 'number', min: -2, max: -2, tickLabel: { rotation: 45 } }, data);
    expect(categoryTickLabels(container)).toEqual(['\u22122.0']);
    chart.destroy();
  });
});
