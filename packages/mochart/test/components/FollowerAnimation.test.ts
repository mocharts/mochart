// followSeries animation sync: a leader and its followers (hollow candle body + wick segments) share durations so the
// segments stay glued to the body every frame, for both filtering and data-update deltas; fake-clock harness, manual frames.
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, barRects } from './helpers';
import { getIdCssClass, getIdCssSelector, getCssClassMatchSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

// Mon is an up candle (body open 1 → close 2), Tue a down candle.
const ITEMS = [
  { label: 'Mon', open: 1, high: 3, low: 0, close: 2 },
  { label: 'Tue', open: 2, high: 4, low: 1, close: 1.5 }
];

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function mountHollowCandlestick(items: typeof ITEMS) {
  const { data, categoryAxis: categoryAxisConfig, series: seriesConfigs } = mochart.createCandlestick(items, { hollow: true });
  const mochartConfig = mochart.enhanceConfig({
    version: '1.0.0',
    animation: { enabled: true },
    legend: { visible: true },
    categoryAxis: categoryAxisConfig,
    series: seriesConfigs
  } as never);
  const container = mountContainer();
  const chart = mochart.createChart(container, {
    mochartConfig,
    dataProvider: new mochart.ArrayOfObjectsDataProvider(data) as never,
    width: WIDTH,
    height: HEIGHT
  });
  return { container, chart, mochartConfig };
}

function barOpacity(container: Element, seriesId: string): string {
  const opacity = container.querySelector(getIdCssSelector('series', seriesId) + ' path')!.getAttribute('fill-opacity');
  expect(opacity, `no fill-opacity on ${seriesId}`).not.toBeNull();
  return opacity!;
}

/** The wick segments' inner edges must sit exactly on the body's edges. */
function expectSegmentsGluedToBody(container: Element, frameLabel: string) {
  const [body] = barRects(container, 'up');
  const [upper] = barRects(container, 'upWickUpper');
  const [lower] = barRects(container, 'upWickLower');
  expect(upper.y + upper.height, `upper segment bottom vs body top (${frameLabel})`).toBeCloseTo(body.y, 6);
  expect(lower.y, `lower segment top vs body bottom (${frameLabel})`).toBeCloseTo(body.y + body.height, 6);
}

describe('followSeries animation sync (hollow candlestick)', () => {
  it('recomputes follower focus when followSeries changes in place', () => {
    const makeConfig = (followLeader: boolean) => mochart.enhanceConfig({
      version: '1.0.0',
      animation: { enabled: true, focusDuration: 64 },
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      series: [
        { id: 'companion', property: 'high', renderer: 'bar', showInLegend: false,
          ...(followLeader ? { followSeries: 'leader' } : {}) },
        { id: 'leader', property: 'close', renderer: 'bar' },
        { id: 'other', property: 'open', renderer: 'bar' }
      ]
    } as never);
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig: makeConfig(false),
      dataProvider: new mochart.ArrayOfObjectsDataProvider(ITEMS) as never,
      focusedSeriesId: 'leader',
      width: WIDTH,
      height: HEIGHT
    });
    runFrames();

    expect(barOpacity(container, 'companion')).toBe(barOpacity(container, 'other'));
    expect(Number(barOpacity(container, 'companion'))).toBeLessThan(Number(barOpacity(container, 'leader')));

    chart.update({ mochartConfig: makeConfig(true) });
    runFrames();
    expect(barOpacity(container, 'companion')).toBe(barOpacity(container, 'leader'));

    chart.update({ mochartConfig: makeConfig(false) });
    runFrames();
    expect(barOpacity(container, 'companion')).toBe(barOpacity(container, 'other'));
    expect(Number(barOpacity(container, 'companion'))).toBeLessThan(Number(barOpacity(container, 'leader')));

    chart.destroy();
  });

  it('keeps the wick segments glued to the body through a filtering animation', () => {
    const { container, chart } = mountHollowCandlestick(ITEMS);
    runFrames();
    expectSegmentsGluedToBody(container, 'settled');

    container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'up')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // sample several mid-animation frames — before the fix the segments'
    // synced-to-high edges lagged the body's and overlapped it here
    let filteringFrames = 0;
    for (const step of [2, 3, 3, 3]) {
      advanceFrames(step);
      if (barRects(container, 'up').length === 0) {
        break; // the filtered candle has finished animating out
      }
      expectSegmentsGluedToBody(container, 'mid-filtering');
      filteringFrames++;
    }
    // the guarded assertion above is the point of this test, so a timing change must not silently skip it
    expect(filteringFrames, 'mid-filtering frames checked').toBeGreaterThanOrEqual(2);
    runFrames();

    // restoring the series animates back in, glued throughout
    container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'up')))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let restoreFrames = 0;
    for (const step of [2, 3, 3, 3]) {
      advanceFrames(step);
      if (barRects(container, 'up').length > 0) {
        expectSegmentsGluedToBody(container, 'mid-restore');
        restoreFrames++;
      }
    }
    expect(restoreFrames, 'mid-restore frames checked').toBeGreaterThanOrEqual(2);
    runFrames();
    expectSegmentsGluedToBody(container, 'restored');

    chart.destroy();
  });

  it('keeps the wick segments glued to the body through a data-update animation', () => {
    const { container, chart } = mountHollowCandlestick(ITEMS);
    runFrames();

    // move every candle value by a different amount so body and segment edges travel
    // different distances — the case that desynchronizes unsynced constant-speed animations
    const changed = mochart.createCandlestick([
      { label: 'Mon', open: 1.5, high: 6, low: 1, close: 4 },
      { label: 'Tue', open: 3, high: 5, low: 0.5, close: 2 }
    ], { hollow: true });
    chart.update({ dataProvider: new mochart.ArrayOfObjectsDataProvider(changed.data) as never });

    for (const step of [2, 3, 3, 3]) {
      advanceFrames(step);
      expectSegmentsGluedToBody(container, 'mid-update');
    }
    runFrames();
    expectSegmentsGluedToBody(container, 'updated');

    chart.destroy();
  });
});
