import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getIdCssSelector } from '../../src/utils/ChartDom';
import type { MochartInputConfig } from '../../src/types/config';
import type { ChartHandle } from '../../src/createChart';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const DATA = [{ i: 0, body: 3, wick: 5 }, { i: 1, body: 7, wick: 9 }];

function baseConfig(seriesOverrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    categoryAxis: { property: 'i', type: 'number', scale: 'linear' },
    valueAxes: [{ id: 'va' }],
    legend: { filterOnClick: true, focusOnClick: true },
    series: [
      { id: 'body', axis: 'va', property: 'body', renderer: 'bar' },
      { id: 'wick', axis: 'va', property: 'wick', renderer: 'bar', followSeries: 'body', ...seriesOverrides }
    ]
  } as MochartInputConfig;
}

function mount(config: MochartInputConfig, props: Record<string, unknown> = {}) {
  const container = mountContainer();
  const chart = mochart.createChart(container, {
    mochartConfig: mochart.enhanceConfig(config),
    dataProvider: new mochart.ArrayOfObjectsDataProvider(DATA),
    width: 400, height: 200,
    ...props
  } as never) as ChartHandle;
  runFrames();
  return { container, chart };
}

const seriesDrawn = (container: HTMLElement, id: string) => container.querySelector(getIdCssSelector('series', id)) !== null;

describe('followSeries identity', () => {
  it('filters a following series with the one it follows, without its own key in the map', () => {
    const { container } = mount(baseConfig(), { filteredSeriesIds: { body: true } });
    expect(seriesDrawn(container, 'body')).toBe(false);
    expect(seriesDrawn(container, 'wick')).toBe(false);
  });

  it('ignores a follower id in a host-supplied filter map', () => {
    const { container } = mount(baseConfig(), { filteredSeriesIds: { wick: true } });
    expect(seriesDrawn(container, 'body')).toBe(true);
    expect(seriesDrawn(container, 'wick')).toBe(true);
  });

  it('ignores a follower id in a host-supplied focusedSeriesId, focusing nothing', () => {
    const { container } = mount(baseConfig(), { focusedSeriesId: 'wick' });
    const focused = mount(baseConfig(), { focusedSeriesId: null });
    // nothing focused means the two renders agree
    expect(container.innerHTML.replace(/__\d+/g, '__N')).toBe(focused.container.innerHTML.replace(/__\d+/g, '__N'));
  });

  it('unfilters a follower as soon as its followSeries link is removed', () => {
    const { container, chart } = mount(baseConfig(), { filteredSeriesIds: { body: true } });
    expect(seriesDrawn(container, 'wick')).toBe(false);

    const unlinked = baseConfig();
    (unlinked.series as Record<string, unknown>[])[1].followSeries = null;
    chart.update({ mochartConfig: mochart.enhanceConfig(unlinked) } as never);
    runFrames();
    expect(seriesDrawn(container, 'wick')).toBe(true);
    expect(seriesDrawn(container, 'body')).toBe(false);
  });

  it('keeps a following series out of the legend by default and includes the followed one', () => {
    const { container } = mount(baseConfig());
    expect(container.querySelector(getIdCssSelector('legendItem', 'body'))).not.toBeNull();
    expect(container.querySelector(getIdCssSelector('legendItem', 'wick'))).toBeNull();
  });

  it('ignores its own filterable, deferring to the followed series', () => {
    const filters: unknown[] = [];
    const { container } = mount(baseConfig({ showInLegend: true, filterable: false }),
      { onSeriesFilter: (filter: unknown) => filters.push(filter) });
    const item = container.querySelector(getIdCssSelector('legendItem', 'wick'));

    item!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(filters[filters.length - 1]).toEqual({ filteredSeriesIds: { body: true } });
    expect(seriesDrawn(container, 'wick')).toBe(false);
  });

  it('filters the whole mark when a follower legend item is clicked', () => {
    const filters: unknown[] = [];
    const { container } = mount(baseConfig({ showInLegend: true }),
      { onSeriesFilter: (filter: unknown) => filters.push(filter) });
    const item = container.querySelector(getIdCssSelector('legendItem', 'wick'));
    expect(item).not.toBeNull();

    item!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(filters[filters.length - 1]).toEqual({ filteredSeriesIds: { body: true } });
    expect(seriesDrawn(container, 'body')).toBe(false);
    expect(seriesDrawn(container, 'wick')).toBe(false);
  });
});
