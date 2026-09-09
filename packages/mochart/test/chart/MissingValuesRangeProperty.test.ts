/**
 * partialRangeIsMissing: a ranged bar series treats a category missing either of
 * property/rangeProperty as missing, so 'connect' drops it instead of collapsing to a zero-extent
 * bar. The waterfall helper relies on this: off-direction series kept invisible bars at `start`,
 * visible as stray lines mid-filtering. The default (false) keeps the collapse so ranged shapes
 * stay connected through half-defined categories.
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

function renderWaterfall(partialRangeIsMissing: boolean | undefined) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider, createWaterfall } = mochart;
  const waterfall = createWaterfall([
    { label: 'Opening', value: 100, total: true },
    { label: 'Up', value: 30 },
    { label: 'Down', value: -20 },
    { label: 'Closing', total: true }
  ]);
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: waterfall.categoryAxis,
    valueAxes: [{ id: 'va' }],
    series: waterfall.series.map((seriesConfig) => ({
      ...seriesConfig,
      axis: 'va',
      ...(partialRangeIsMissing === undefined ? {} : { partialRangeIsMissing })
    }))
  });
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    // The direction properties are undefined off their own rows, so the row
    // type needs narrowing to satisfy the provider's category-value constraint.
    dataProvider: new ArrayOfObjectsDataProvider(waterfall.data as Record<string, string | number>[]),
    width: 400,
    height: 200
  });
  runFrames();
  return { chart, container };
}

describe('partialRangeIsMissing on a connect bar series with a rangeProperty', () => {
  it('renders one bar per step across the waterfall direction series (helper default)', () => {
    const { chart, container } = renderWaterfall(undefined);

    // Each step belongs to exactly one direction series; the other two series
    // must skip the category rather than draw a zero-extent bar at `start`.
    const bars = container.querySelectorAll('path' + getCssSelector('seriesBar'));
    expect(bars.length).toBe(4);

    chart.destroy();
  });

  it('collapses half-defined categories to zero-extent bars when disabled', () => {
    const { chart, container } = renderWaterfall(false);

    // Every series keeps every category: the missing direction value is
    // back-filled from the shared `start` range value.
    const bars = container.querySelectorAll('path' + getCssSelector('seriesBar'));
    expect(bars.length).toBe(12);

    chart.destroy();
  });
});
