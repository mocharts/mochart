import { describe, it, expect } from 'vitest';

import { enhanceConfig, getDataErrors } from '@mochart/core';
import type { DataProvider } from '@mochart/core';

import demoData from '@mochart/demo-data';

import { buildChartTypeDemoSnapshots, chartTypeGenerators, generateChartTypeDataProvider, generateDemoDataProvider, getRandomDataObjects } from '../src/chartTypeGenerators';

import type { DemoDataProvider, DemoRandomConfig } from '../src/types';

// Each generator runs against the random config its demo actually ships.
function demoRandom(id: string): DemoRandomConfig {
  return demoData.demoObjectMap[id].random;
}

const snapshots = buildChartTypeDemoSnapshots();

function toDataProvider(provider: DemoDataProvider): DataProvider {
  return provider as unknown as DataProvider;
}

describe('chart-type demo snapshots', () => {
  for (const snapshot of snapshots) {
    it(`${snapshot.id}: config is valid and the baked data has no errors`, () => {
      const mochartConfig = enhanceConfig(snapshot.config);
      expect(mochartConfig.validation.valid).toBe(true);
      expect(mochartConfig.validation.warnings).toEqual([]);
      const provider = {
        getPropertyValues: (property: string) => snapshot.data.map(row => row[property])
      } as unknown as DemoDataProvider;
      expect(getDataErrors(mochartConfig, toDataProvider(provider))).toEqual([]);
    });
  }
});

describe('generateChartTypeDataProvider', () => {
  for (const snapshot of snapshots) {
    const mochartConfig = enhanceConfig(snapshot.config);

    it(`${snapshot.id}: generated data satisfies the demo config across steps`, () => {
      for (const randomId of [0, 1, 2, 7, 23]) {
        const provider = generateChartTypeDataProvider(snapshot.id, mochartConfig, demoRandom(snapshot.id), randomId);
        expect(provider.categoryValues!.length).toBeGreaterThan(0);
        expect(getDataErrors(mochartConfig, toDataProvider(provider))).toEqual([]);
      }
    });

    it(`${snapshot.id}: the same randomId reproduces the same data`, () => {
      const first = generateChartTypeDataProvider(snapshot.id, mochartConfig, demoRandom(snapshot.id), 5);
      const second = generateChartTypeDataProvider(snapshot.id, mochartConfig, demoRandom(snapshot.id), 5);
      expect(second.categoryValues).toEqual(first.categoryValues);
      expect(second.seriesValues).toEqual(first.seriesValues);
    });

    it(`${snapshot.id}: consecutive steps share most category values`, () => {
      const a = generateChartTypeDataProvider(snapshot.id, mochartConfig, demoRandom(snapshot.id), 3).categoryValues!;
      const b = new Set(generateChartTypeDataProvider(snapshot.id, mochartConfig, demoRandom(snapshot.id), 4).categoryValues!);
      const shared = a.filter(value => b.has(value)).length;
      expect(shared / a.length).toBeGreaterThan(0.5);
    });
  }

  it('heatmap keeps every row on the color extents baked into the config', () => {
    const heatmap = snapshots.find(snapshot => snapshot.id === 'heatmap')!;
    const mochartConfig = enhanceConfig(heatmap.config);
    const provider = generateChartTypeDataProvider('heatmap', mochartConfig, demoRandom('heatmap'), 11);
    const baseline = generateChartTypeDataProvider('heatmap', mochartConfig, demoRandom('heatmap'), 12);
    for (const rowIndex of [0, 1, 2, 3, 4, 5, 6]) {
      const property = 'row' + rowIndex + 'Value';
      const extent = (values: (number | undefined)[]) => {
        const present = values.filter((value): value is number => value !== undefined && value !== null);
        return [Math.min(...present), Math.max(...present)];
      };
      expect(extent(provider.seriesValues![property])).toEqual(extent(baseline.seriesValues![property]));
    }
  });

  it('candlestick candles stay coherent: low ≤ open/close ≤ high, one direction per day', () => {
    const candlestick = snapshots.find(snapshot => snapshot.id === 'candlestick')!;
    const mochartConfig = enhanceConfig(candlestick.config);
    const provider = generateChartTypeDataProvider('candlestick', mochartConfig, demoRandom('candlestick'), 6);
    const { seriesValues, categoryValues } = provider;
    categoryValues!.forEach((_label, index) => {
      const open = seriesValues!['open'][index]!;
      const close = seriesValues!['close'][index]!;
      const high = seriesValues!['high'][index]!;
      const low = seriesValues!['low'][index]!;
      expect(low).toBeLessThanOrEqual(Math.min(open, close));
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      const up = seriesValues!['up'][index];
      const down = seriesValues!['down'][index];
      // the close lands under exactly one direction, with the high mirrored
      expect(up !== undefined && down !== undefined).toBe(false);
      expect(up ?? down).toBe(close);
      expect(up !== undefined ? seriesValues!['upHigh'][index] : seriesValues!['downHigh'][index]).toBe(high);
    });
  });

  it('ohlc bars stay coherent: low ≤ open/close ≤ high, one direction per day with open/high mirrored', () => {
    const ohlc = snapshots.find(snapshot => snapshot.id === 'ohlc')!;
    const mochartConfig = enhanceConfig(ohlc.config);
    const provider = generateChartTypeDataProvider('ohlc', mochartConfig, demoRandom('ohlc'), 6);
    const { seriesValues, categoryValues } = provider;
    categoryValues!.forEach((_label, index) => {
      const open = seriesValues!['open'][index]!;
      const close = seriesValues!['close'][index]!;
      const high = seriesValues!['high'][index]!;
      const low = seriesValues!['low'][index]!;
      expect(low).toBeLessThanOrEqual(Math.min(open, close));
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      const up = seriesValues!['up'][index];
      const down = seriesValues!['down'][index];
      // the close lands under exactly one direction, with the high and open mirrored
      expect(up !== undefined && down !== undefined).toBe(false);
      expect(up ?? down).toBe(close);
      expect(up !== undefined ? seriesValues!['upHigh'][index] : seriesValues!['downHigh'][index]).toBe(high);
      expect(up !== undefined ? seriesValues!['upOpen'][index] : seriesValues!['downOpen'][index]).toBe(open);
    });
  });

  it('error bars stay coherent: low ≤ value ≤ high for every series and step', () => {
    const errorBars = snapshots.find(snapshot => snapshot.id === 'error-bars')!;
    const mochartConfig = enhanceConfig(errorBars.config);
    for (const randomId of [0, 6, 13]) {
      const provider = generateChartTypeDataProvider('error-bars', mochartConfig, demoRandom('error-bars'), randomId);
      const { seriesValues, categoryValues } = provider;
      categoryValues!.forEach((_label, index) => {
        for (const property of ['a', 'b', 'target']) {
          const value = seriesValues![property][index]!;
          expect(seriesValues![property + 'Low'][index]!).toBeLessThanOrEqual(value);
          expect(seriesValues![property + 'High'][index]!).toBeGreaterThanOrEqual(value);
        }
      });
    }
  });

  it('waterfall bars always connect: each delta starts at the running total', () => {
    const waterfall = snapshots.find(snapshot => snapshot.id === 'waterfall')!;
    const mochartConfig = enhanceConfig(waterfall.config);
    const provider = generateChartTypeDataProvider('waterfall', mochartConfig, demoRandom('waterfall'), 9);
    const { seriesValues, categoryValues } = provider;
    let running = 0;
    categoryValues!.forEach((_label, index) => {
      const start = seriesValues!['start'][index]!;
      const direction = (seriesValues!['direction'] as unknown as string[])[index];
      if (direction === 'total') {
        expect(start).toBe(0);
      }
      else {
        expect(start).toBe(running);
      }
      running = seriesValues!['cumulative'][index]!;
    });
  });

  it('pie rows keep every slice property from the baked config, absent slices as 0', () => {
    const pie = snapshots.find(snapshot => snapshot.id === 'pie')!;
    const mochartConfig = enhanceConfig(pie.config);
    const bakedProperties = (pie.config.series as { property: string }[]).map(seriesConfig => seriesConfig.property);
    for (const randomId of [0, 1, 5, 11]) {
      const provider = generateChartTypeDataProvider('pie', mochartConfig, demoRandom('pie'), randomId);
      expect(provider.categoryValues!).toHaveLength(1);
      for (const property of bakedProperties) {
        const value = provider.seriesValues![property][0];
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('donut rows carry slice values only — its percent labels and tooltip shares are derived', () => {
    const donut = snapshots.find(snapshot => snapshot.id === 'donut')!;
    const mochartConfig = enhanceConfig(donut.config);
    expect(mochartConfig.pie.tooltip.valueType).toBe('percent');
    const provider = generateChartTypeDataProvider('donut', mochartConfig, demoRandom('donut'), 6);
    const sliceProperties = (donut.config.series as { property: string }[]).map(seriesConfig => seriesConfig.property);
    const total = sliceProperties.reduce((sum: number, property) => sum + provider.seriesValues![property][0]!, 0);
    expect(total).toBeGreaterThan(0);
    expect(Object.keys(provider.seriesValues!).sort()).toEqual([...sliceProperties].sort());
  });
});

describe('random config wiring', () => {
  const configFor = (id: string) => enhanceConfig(snapshots.find(snapshot => snapshot.id === id)!.config);

  it('pie: value.min/max scale the curated pool and missing.probability 1 zeroes the droppable slices', () => {
    const mochartConfig = configFor('pie');
    const scaled = generateChartTypeDataProvider('pie', mochartConfig, {
      value: { min: 0, max: 4200 }, missing: { probability: 0 }, reuse: { globalFraction: 0, stepFraction: 0 }
    }, 3);
    const values = Object.keys(scaled.seriesValues!).filter(key => /^slice\d+$/.test(key)).map(key => scaled.seriesValues![key][0]!);
    expect(Math.max(...values)).toBeGreaterThan(2000);
    expect(values.every(value => value > 0)).toBe(true);

    const dropped = generateChartTypeDataProvider('pie', mochartConfig, {
      value: { min: 0, max: 420 }, missing: { probability: 1 }, reuse: { globalFraction: 0, stepFraction: 0 }
    }, 3);
    // Licensing (slice3) and Other (slice5) are the droppable pool entries
    expect(dropped.seriesValues!['slice3'][0]).toBe(0);
    expect(dropped.seriesValues!['slice5'][0]).toBe(0);
    expect(dropped.seriesValues!['slice0'][0]).toBeGreaterThan(0);
  });

  it('pie: reuse.globalFraction 1 pins every slice across arbitrary steps', () => {
    const mochartConfig = configFor('pie');
    const random = { value: { min: 0, max: 420 }, missing: { probability: 0.25 }, reuse: { globalFraction: 1, stepFraction: 0 } };
    const a = generateChartTypeDataProvider('pie', mochartConfig, random, 3);
    const b = generateChartTypeDataProvider('pie', mochartConfig, random, 9);
    expect(b.seriesValues).toEqual(a.seriesValues);
  });

  it('pie: reuse.stepFraction 1 persists half the slices across each step boundary', () => {
    const mochartConfig = configFor('pie');
    const random = { value: { min: 0, max: 420 }, missing: { probability: 0 }, reuse: { globalFraction: 0, stepFraction: 1 } };
    const sliceProperties = ['slice0', 'slice1', 'slice2', 'slice3', 'slice4', 'slice5'];
    for (const randomId of [2, 3]) {
      const a = generateChartTypeDataProvider('pie', mochartConfig, random, randomId);
      const b = generateChartTypeDataProvider('pie', mochartConfig, random, randomId + 1);
      const persisted = sliceProperties.filter(property => a.seriesValues![property][0] === b.seriesValues![property][0]);
      expect(persisted.length).toBe(3);
    }
  });

  it('gauge: raising missing.probability drops segments that never drop by default', () => {
    const mochartConfig = configFor('gauge');
    const provider = generateChartTypeDataProvider('gauge', mochartConfig, {
      value: { min: 0, max: 540 }, missing: { probability: 1 }, reuse: { globalFraction: 0, stepFraction: 0 }
    }, 4);
    const values = ['slice0', 'slice1', 'slice2'].map(property => provider.seriesValues![property][0]);
    expect(values).toEqual([0, 0, 0]);
  });

  it('waterfall: value.min/max remap the pool deltas', () => {
    const mochartConfig = configFor('waterfall');
    const provider = generateChartTypeDataProvider('waterfall', mochartConfig, {
      value: { min: -1800, max: 4200 }, missing: { probability: 0 }, reuse: { globalFraction: 0, stepFraction: 0 }
    }, 5);
    // Product revenue is the pool max, remapped to ~4200 before ±35% jitter
    expect(provider.seriesValues!['cumulative'][0]!).toBeGreaterThan(2000);
  });

  it('walk generators honor candles.min/max and the price band', () => {
    const mochartConfig = configFor('candlestick');
    const random = { candles: { min: 5, max: 5 }, price: { min: 900, max: 1100, volatility: 0.04 }, reuse: { step: true } };
    for (const randomId of [0, 4]) {
      const provider = generateChartTypeDataProvider('candlestick', mochartConfig, random, randomId);
      expect(provider.categoryValues!).toHaveLength(5);
      expect(provider.seriesValues!['open'][0]!).toBeGreaterThan(500);
    }
  });

  it('histogram: samples.min/max control the sampled population size', () => {
    const mochartConfig = configFor('histogram');
    const provider = generateChartTypeDataProvider('histogram', mochartConfig, {
      samples: { min: 10, max: 10 }, value: { min: 100, max: 280 }, reuse: { global: false, step: false }
    }, 2);
    const total = provider.seriesValues!['count'].reduce((sum: number, count) => sum + (count ?? 0), 0);
    expect(total).toBe(10);
  });

  it('heatmap: columns.dropProbability/maxDropped control the column dropouts', () => {
    const mochartConfig = configFor('heatmap');
    const none = generateChartTypeDataProvider('heatmap', mochartConfig, {
      columns: { dropProbability: 1, maxDropped: 0 }, missing: { probability: 0 }, reuse: { global: false, step: false }
    }, 3);
    expect(none.categoryValues!).toHaveLength(12);
    const three = generateChartTypeDataProvider('heatmap', mochartConfig, {
      columns: { dropProbability: 1, maxDropped: 3 }, missing: { probability: 0 }, reuse: { global: false, step: false }
    }, 3);
    expect(three.categoryValues!).toHaveLength(9);
  });

  it('error-bars: months.min/max bound the category count and missing drops points with their bounds', () => {
    const mochartConfig = configFor('error-bars');
    const provider = generateChartTypeDataProvider('error-bars', mochartConfig, {
      months: { min: 3, max: 3 }, margin: { min: 3, max: 7 }, missing: { probability: 1 }, reuse: { global: false, step: false }
    }, 1);
    expect(provider.categoryValues!).toHaveLength(3);
    for (const property of ['a', 'aLow', 'aHigh', 'b', 'bLow', 'bHigh']) {
      // no row carries the property, so its series array is never created
      expect((provider.seriesValues![property] ?? []).every(value => value === undefined)).toBe(true);
    }
    expect(provider.seriesValues!['target'].every(value => typeof value === 'number')).toBe(true);
  });
});

describe('generateDemoDataProvider', () => {
  it('dispatches to the chart-type generator for known generator ids', () => {
    const heatmap = snapshots.find(snapshot => snapshot.id === 'heatmap')!;
    const mochartConfig = enhanceConfig(heatmap.config);
    const direct = generateChartTypeDataProvider('heatmap', mochartConfig, demoRandom('heatmap'), 2);
    const dispatched = generateDemoDataProvider('heatmap', mochartConfig, demoRandom('heatmap'), 2);
    expect(dispatched.categoryValues).toEqual(direct.categoryValues);
  });

  it('exposes the generator ids', () => {
    expect(chartTypeGenerators).toEqual(['histogram', 'waterfall', 'heatmap', 'candlestick', 'candlestick-hollow', 'ohlc', 'error-bars', 'pie', 'donut', 'gauge']);
  });
});

// The pivot from a generated provider's parallel arrays to data-tab rows was written once per port.
describe('getRandomDataObjects', () => {
  const seriesValues = { sales: [10, 20], cost: [3, undefined] };

  function mochartConfig(categoryAxis: Record<string, unknown>) {
    return enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...categoryAxis },
      series: [{ property: 'sales' }, { property: 'cost' }]
    } as never);
  }

  it('writes one row per category, keyed by the config properties', () => {
    expect(getRandomDataObjects(mochartConfig({}), ['Jan', 'Feb'], seriesValues)).toEqual([
      { month: 'Jan', sales: 10, cost: 3 },
      { month: 'Feb', sales: 20, cost: undefined }
    ]);
  });

  it('adds the key property only when the axis names one', () => {
    const rows = getRandomDataObjects(mochartConfig({ keyProperty: 'monthKey' }), ['Jan'], { sales: [10] });
    expect(rows).toEqual([{ month: 'Jan', monthKey: 'Jan', sales: 10 }]);
  });

  it('is empty for an empty category set', () => {
    expect(getRandomDataObjects(mochartConfig({}), [], seriesValues)).toEqual([]);
  });
});
