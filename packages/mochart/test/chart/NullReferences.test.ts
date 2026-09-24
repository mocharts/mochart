/**
 * Regression: a null stack, group, gradient or pattern reference (the documented opt-out) was looked up
 * as the id "null", so an entry with that id was linked to the opted-out series, and an opted-out bar
 * series next to a capped stack threw from the bar renderer on mount.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import type { EnhancedSeriesConfig } from '../../src/types/enhanced';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

describe('null config references', () => {
  it('link a null stack, group, gradient or pattern to nothing, even when an entry has the id "null"', () => {
    const mochartConfig = mochart.enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'x' },
      seriesStacks: [{ id: 'null' }],
      seriesGroups: [{ id: 'null' }],
      linearGradients: [{ id: 'null', stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue', opacity: 1 }] }],
      patterns: [{ id: 'null', type: 'dots' }],
      series: [{ property: 'a', renderer: 'bar', stack: null, group: null, gradient: null, pattern: null }]
    });
    expect(mochartConfig.validation.errors).toEqual([]);
    const series = mochartConfig.series[0] as EnhancedSeriesConfig;
    expect(series.seriesStackConfig).toBeUndefined();
    expect(series.seriesGroupConfig).toBeUndefined();
    expect(series.linearGradientConfig).toBeUndefined();
    expect(series.patternConfig).toBeUndefined();
  });

  it('render an opted-out bar series beside a capped stack whose id is "null"', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'x' },
      seriesStacks: [{ id: 'null', outerCap: { type: 'round' } }],
      series: [{ property: 'a', renderer: 'bar', stack: null }, { property: 'b', renderer: 'bar' }]
    });
    expect(mochartConfig.validation.errors).toEqual([]);
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider([{ x: 'p', a: 1, b: 2 }, { x: 'q', a: 3, b: 4 }]),
      width: 300, height: 200
    });
    runFrames();
    expect(container.querySelectorAll('path[d^="M"]').length).toBeGreaterThan(0);
    chart.destroy();
  });
});
