/**
 * End-to-end render of the createHeatmap helper output: a grid with a missing cell must draw one
 * colored bar per cell on the hidden pinned value axis.
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

describe('heatmap helper rendering', () => {
  it('renders one colored cell per grid value', () => {
    const { createChart, createHeatmap, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const heatmap = createHeatmap([
      { label: 'A', values: [1, 2, 3] },
      { label: 'B', values: [4, undefined, 6] }
    ]);
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      tooltip: { visible: false },
      categoryAxis: heatmap.categoryAxis,
      valueAxes: [{ ...heatmap.valueAxes[0], id: 'va' }],
      series: heatmap.series.map((seriesConfig) => ({ ...seriesConfig, axis: 'va' }))
    });
    expect(mochartConfig.validation.valid).toBe(true);

    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(heatmap.data as Record<string, string | number>[]),
      width: 300,
      height: 200
    });
    runFrames();

    expect(container.innerHTML).not.toContain('NaN');
    const fills = Array.from(container.querySelectorAll('path[fill^="rgb"]')).map((path) => path.getAttribute('fill'));
    expect(fills).toHaveLength(5);
    expect(new Set(fills).size).toBe(5);
    // The value axis names the rows via explicit ticks.
    const labels = Array.from(container.querySelectorAll('text')).map((text) => text.textContent);
    expect(labels).toContain('A');
    expect(labels).toContain('B');

    chart.destroy();
  });
});
