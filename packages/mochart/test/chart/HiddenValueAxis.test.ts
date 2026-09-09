/**
 * Regression: series on a hidden (visible: false) axis must still get a usable value scale — the
 * axis used to map to zero bounds without a seriesExtent, so every position was NaN (sparklines hit this).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

describe('hidden value axis rendering', () => {
  it('renders finite series positions when every axis is hidden', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'i', type: 'number', scale: 'linear', visible: false },
      valueAxes: [{ id: 'va', visible: false }],
      series: [{ axis: 'va', property: 'value', renderer: 'line' }]
    });
    const data = [
      { i: 0, value: 3 },
      { i: 1, value: 7 },
      { i: 2, value: 5 },
      { i: 3, value: 9 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 150,
      height: 32
    });
    runFrames();

    const html = container.innerHTML;
    expect(html).not.toContain('NaN');
    const seriesPath = container.querySelector('path[d^="M"]');
    expect(seriesPath).not.toBeNull();
    // Hidden axes must not draw any tick labels or axis lines.
    expect(container.querySelectorAll('text').length).toBe(0);

    chart.destroy();
  });
});
