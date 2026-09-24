/**
 * Regression: while a category add or remove animates, the pointer callbacks reported the index of the
 * category drawn, in the old or merged category list, while onFocus reported the index in the host's new
 * data. Every payload index is now in the new data's index space, -1 for a category only the old data had.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, advanceFrames, mountContainer, mockBoundingClientRect } from '../components/helpers';
import { getIdCssSelector, getDescendantCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';
import type { ChartEventPayload, ChartFocus, ChartSeriesClickPayload } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');
const WIDTH = 300;
const HEIGHT = 200;

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
});

const data = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function tickLabels(container: Element): string[] {
  return Array.from(container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel') + ' text'))
    .map(text => text.textContent ?? '');
}

describe('pointer payload category indices during a category change', () => {
  it('report the index in the new data, and -1 for a departing category, like onFocus does', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      // a long expansion phase draws the old categories for many frames
      animation: { expansionDuration: 3200, valueChangeDuration: 3200, contractionDuration: 1600 },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'sales', property: 'sales', renderer: 'bar', focusCategoryOnHover: true }]
    } as MochartInputConfig);
    const clicks: ChartEventPayload[] = [];
    const moves: ChartEventPayload[] = [];
    const seriesClicks: ChartSeriesClickPayload[] = [];
    const focuses: ChartFocus[] = [];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(data), width: WIDTH, height: HEIGHT,
      onChartClick: payload => clicks.push(payload),
      onChartMouseMove: payload => moves.push(payload),
      onSeriesClick: payload => seriesClicks.push(payload),
      onFocus: focus => focuses.push(focus)
    });
    runFrames();

    // Jan leaves: the host's data is now Feb, Mar
    chart.update({ dataProvider: new ArrayOfObjectsDataProvider(data.slice(1)) });
    advanceFrames(1);
    expect(tickLabels(container)).toEqual(['Jan', 'Feb', 'Mar']);

    const root = container.querySelector(getChartRootCssSelector())!;
    const bar = (index: number) => container.querySelector(getIdCssSelector('series', 'sales') + ' ' + getIdCssSelector('seriesBar', index))!;
    // the drawn Mar bar is the old index 2; the pointer over its slot (the right third) names Mar too
    root.dispatchEvent(new MouseEvent('mouseenter', { clientX: WIDTH * 5 / 6, clientY: HEIGHT / 2, bubbles: true }));
    root.dispatchEvent(new MouseEvent('mousemove', { clientX: WIDTH * 5 / 6, clientY: HEIGHT / 2, bubbles: true }));
    bar(2).dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
    bar(2).dispatchEvent(new MouseEvent('click', { clientX: WIDTH * 5 / 6, clientY: HEIGHT / 2, bubbles: true }));
    expect(focuses[focuses.length - 1].focusedCategoryIndex).toBe(1);
    expect(moves[moves.length - 1].categoryIndex).toBe(1);
    expect(clicks[clicks.length - 1].categoryIndex).toBe(1);
    expect(seriesClicks[seriesClicks.length - 1]).toMatchObject({ seriesId: 'sales', categoryIndex: 1, nearestCategoryIndex: 1 });

    // the departing Jan bar has no index in the new data
    root.dispatchEvent(new MouseEvent('mousemove', { clientX: WIDTH / 6, clientY: HEIGHT / 2, bubbles: true }));
    bar(0).dispatchEvent(new MouseEvent('click', { clientX: WIDTH / 6, clientY: HEIGHT / 2, bubbles: true }));
    expect(moves[moves.length - 1].categoryIndex).toBe(-1);
    expect(clicks[clicks.length - 1].categoryIndex).toBe(-1);
    expect(seriesClicks[seriesClicks.length - 1]).toMatchObject({ categoryIndex: -1, nearestCategoryIndex: -1 });

    chart.destroy();
  });
});
