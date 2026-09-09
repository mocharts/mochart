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
