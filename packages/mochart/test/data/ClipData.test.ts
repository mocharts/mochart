// getClippedEdges reports which *screen* edges have data hidden behind them (not axis ends), so two axes clipping the same end collapse to one flag; `reversed` and `plot.inverted` each move which edge an exceeded end lands on, and they compose
import { describe, it, expect } from 'vitest';
import { getClippedEdges, hasClippedEdge, noClippedEdges } from '../../src/data/ClipData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from './fixtures';

type Row = Record<string, string | number>;

const overflowing = [{ c: 0, v: 5 }, { c: 1, v: 50 }];
const contained = [{ c: 0, v: 5 }, { c: 1, v: 8 }];

function edges(configInput: Record<string, unknown>, rows: Row[] = overflowing, filteredSeriesIds: Record<string, boolean> = {}) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    series: [{ property: 'v', renderer: 'bar' }],
    ...configInput
  });
  const chartData = getChartData(config, new ArrayOfObjectsDataProvider(rows), filteredSeriesIds);
  return getClippedEdges(config, chartData);
}

/** The edges reported as clipped, as a sorted list — easier to read than four booleans. */
function clipped(configInput: Record<string, unknown>, rows: Row[] = overflowing, filteredSeriesIds: Record<string, boolean> = {}) {
  const result = edges(configInput, rows, filteredSeriesIds);
  return (Object.keys(result) as (keyof typeof result)[]).filter((edge) => result[edge]).sort();
}

describe('value axis bounds', () => {
  it('reports the top edge when data exceeds an explicit max', () => {
    expect(clipped({ valueAxes: [{ min: 0, max: 10 }] })).toEqual(['top']);
  });

  it('reports the bottom edge when data falls below an explicit min', () => {
    expect(clipped({ valueAxes: [{ min: 0, max: 100 }] }, [{ c: 0, v: -5 }, { c: 1, v: 8 }])).toEqual(['bottom']);
  });

  it('reports both edges when data escapes at both ends', () => {
    expect(clipped({ valueAxes: [{ min: 0, max: 10 }] }, [{ c: 0, v: -5 }, { c: 1, v: 50 }])).toEqual(['bottom', 'top']);
  });

  it('reports nothing when the data fits', () => {
    expect(edges({ valueAxes: [{ min: 0, max: 10 }] }, contained)).toEqual(noClippedEdges);
    expect(hasClippedEdge(edges({ valueAxes: [{ min: 0, max: 10 }] }, contained))).toBe(false);
  });

  it('reports nothing for an auto bound, which is computed from the data it would hide', () => {
    expect(edges({})).toEqual(noClippedEdges);
    expect(edges({ valueAxes: [{ min: 0 }] })).toEqual(noClippedEdges);
  });

  it('reports an auto bound narrowed inside the data by an offset, like the explicit bound it equals', () => {
    expect(clipped({ valueAxes: [{ min: 'auto', minOffset: 20 }] })).toEqual(['bottom']);
    expect(clipped({ valueAxes: [{ min: 20 }] })).toEqual(['bottom']);
    expect(clipped({ valueAxes: [{ max: 'auto', maxOffset: -20 }] })).toEqual(['top']);
  });

  it('reports nothing for an offset that widens the auto bound', () => {
    expect(edges({ valueAxes: [{ minOffset: -20, maxOffset: 20 }] })).toEqual(noClippedEdges);
  });
});

describe('edge mapping', () => {
  it('puts an exceeded max at the bottom when the axis is reversed', () => {
    expect(clipped({ valueAxes: [{ min: 0, max: 10, reversed: true }] })).toEqual(['bottom']);
  });

  it('puts an exceeded max at the right when the plot is inverted', () => {
    expect(clipped({ plot: { inverted: true }, valueAxes: [{ min: 0, max: 10 }] })).toEqual(['right']);
  });

  it('composes reversed and inverted to the left edge', () => {
    expect(clipped({ plot: { inverted: true }, valueAxes: [{ min: 0, max: 10, reversed: true }] })).toEqual(['left']);
  });
});

describe('multiple value axes', () => {
  const twoAxes = (secondMax: number) => ({
    valueAxes: [{ id: 'a', min: 0, max: 10 }, { id: 'b', min: 0, max: secondMax }],
    series: [{ id: 'S0', property: 'v', axis: 'a' }, { id: 'S1', property: 'w', axis: 'b' }]
  });
  const rows = [{ c: 0, v: 5, w: 5 }, { c: 1, v: 50, w: 50 }];

  it('collapses two axes clipping the same end into one edge', () => {
    expect(clipped(twoAxes(10), rows)).toEqual(['top']);
  });

  it('reports the edge when only one of the two axes clips', () => {
    expect(clipped(twoAxes(100), rows)).toEqual(['top']);
  });

  it('reports nothing when neither clips', () => {
    expect(edges(twoAxes(100), [{ c: 0, v: 5, w: 5 }, { c: 1, v: 8, w: 8 }])).toEqual(noClippedEdges);
  });
});

describe('filtered series', () => {
  const config = {
    valueAxes: [{ min: 0, max: 10 }],
    series: [{ id: 'S0', property: 'v' }, { id: 'S1', property: 'w' }]
  };
  const rows = [{ c: 0, v: 5, w: 5 }, { c: 1, v: 8, w: 50 }];

  it('reports the edge while the out-of-range series is shown', () => {
    expect(clipped(config, rows)).toEqual(['top']);
  });

  it('reports nothing once that series is filtered out — the filter hides it, not the clip', () => {
    expect(edges(config, rows, { S1: true })).toEqual(noClippedEdges);
  });

  it('still reports when a *different* series is filtered out', () => {
    expect(clipped(config, rows, { S0: true })).toEqual(['top']);
  });
});

describe('category axis bounds', () => {
  const dateRows = [{ c: '2020-01-01', v: 5 }, { c: '2020-06-01', v: 8 }];
  const dateAxis = (extra: Record<string, unknown>) => ({
    categoryAxis: { property: 'c', type: 'date', scale: 'linear', ...extra },
    series: [{ property: 'v', renderer: 'line' }]
  });

  it('reports the right edge for a date past an explicit max', () => {
    expect(clipped(dateAxis({ min: '2020-01-01', max: '2020-03-01' }), dateRows)).toEqual(['right']);
  });

  it('reports the left edge for a date before an explicit min', () => {
    expect(clipped(dateAxis({ min: '2020-03-01', max: '2020-12-01' }), dateRows)).toEqual(['left']);
  });

  // a vertical category axis runs top-to-bottom, so its max is at the bottom — the opposite of a
  // vertical value axis. Measured: with plot.inverted the first date renders at y=0, the last at y=255.
  it('maps an exceeded max to the bottom edge when the plot is inverted', () => {
    expect(clipped({ plot: { inverted: true }, ...dateAxis({ min: '2020-01-01', max: '2020-03-01' }) }, dateRows)).toEqual(['bottom']);
  });

  it('maps a date before an explicit min to the top edge when the plot is inverted', () => {
    expect(clipped({ plot: { inverted: true }, ...dateAxis({ min: '2020-03-01', max: '2020-12-01' }) }, dateRows)).toEqual(['top']);
  });

  it('never reports for an ordinal category axis, whose bounds are validated to auto', () => {
    expect(edges({}, overflowing)).toEqual(noClippedEdges);
  });
});

describe('both axes at once', () => {
  it('reports one edge per axis', () => {
    const result = clipped({
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', min: 0, max: 0 },
      valueAxes: [{ min: 0, max: 10 }],
      series: [{ property: 'v', renderer: 'line' }]
    });
    expect(result).toEqual(['right', 'top']);
  });

  // clip detection reads the semantic domain: only the scale's render domain widens, so a value
  // past a collapsed explicit bound is flagged even though the widened scale can still place it
  it('flags a value outside a collapsed explicit value bound as clipped', () => {
    expect(clipped({ valueAxes: [{ min: 5, max: 5 }] }, [{ c: 0, v: 5 }, { c: 1, v: 5.4 }])).toEqual(['top']);
  });
});
