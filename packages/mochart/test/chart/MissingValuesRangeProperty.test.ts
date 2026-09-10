/**
 * partialRangeIsMissing: a ranged bar series treats a category missing either of
 * property/rangeProperty as missing, so 'connect' drops it instead of collapsing to a zero-extent
 * bar. The waterfall helper relies on this: off-direction series kept invisible bars at `start`,
 * visible as stray lines mid-filtering. The default (false) keeps the collapse so ranged shapes
 * stay connected through half-defined categories.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, barRects } from '../components/helpers';
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

describe('a ranged bar whose value goes missing', () => {
  it('collapses onto its range value instead of sweeping to the axis base', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        id: 'body', property: 'close', rangeProperty: 'open', axis: 'va', renderer: 'bar',
        missingValueMode: 'connect', partialRangeIsMissing: true
      }]
    });
    const container = mountContainer();
    const props = { mochartConfig, width: 400, height: 200 };
    const chart = createChart(container, {
      ...props,
      dataProvider: new ArrayOfObjectsDataProvider([{ label: 'A', open: 5, close: 10 }, { label: 'B', open: 20, close: 30 }])
    });
    runFrames();
    const top = (rect: { y: number; height: number }) => Math.min(rect.y, rect.y + rect.height);
    const bottom = (rect: { y: number; height: number }) => Math.max(rect.y, rect.y + rect.height);
    // A spans exactly 5 to 10, which gives the pixel scale for B's 20 to 30 span.
    const [a] = barRects(container, 'body').sort((first, second) => first.x - second.x);
    const pixelsPerUnit = (bottom(a) - top(a)) / 5;
    const yOf = (value: number) => top(a) - (value - 10) * pixelsPerUnit;

    // B flips direction: its close goes missing while its open stays. The old
    // behaviour animated the close to the axis base (5), so the bar swept
    // below its own open and past A before it left.
    chart.update({
      ...props,
      dataProvider: new ArrayOfObjectsDataProvider([{ label: 'A', open: 5, close: 10 }, { label: 'B', open: 25 }])
    });
    let tweenFrames = 0;
    let lowest = -Infinity;
    let highest = Infinity;
    for (let frame = 0; frame < 80; frame++) {
      const rects = barRects(container, 'body').sort((first, second) => first.x - second.x);
      if (rects.length === 2) {
        tweenFrames++;
        lowest = Math.max(lowest, bottom(rects[1]!));
        highest = Math.min(highest, top(rects[1]!));
      }
      advanceFrames(1);
    }
    expect(tweenFrames).toBeGreaterThan(0);
    expect(lowest).toBeLessThanOrEqual(yOf(20) + 1);
    expect(highest).toBeGreaterThanOrEqual(yOf(30) - 1);

    runFrames();
    expect(barRects(container, 'body').length).toBe(1);
    chart.destroy();
  });
});
