// expansion and contraction move the axes, so a series range change that moves no axis must not play them
import { describe, it, expect } from 'vitest';
import { getChartAnimationData } from '../../src/animation/ChartAnimationData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';

type Row = Record<string, number>;

function animationDataFor(config: Record<string, unknown>, from: Row[], to: Row[]) {
  const enhanced = makeConfig({ categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' }, ...config });
  const prev = getChartData(enhanced, new ArrayOfObjectsDataProvider(from), {});
  const next = getChartData(enhanced, new ArrayOfObjectsDataProvider(to), {});
  return getChartAnimationData(enhanced, prev, next);
}

describe('a value moving inside its error bars', () => {
  const config = { series: [{ property: 'v', renderer: 'line', errorLowProperty: 'lo', errorHighProperty: 'hi' }] };
  const low = [{ c: 0, v: 5, lo: 0, hi: 10 }, { c: 1, v: 6, lo: 0, hi: 10 }];
  const high = [{ c: 0, v: 5, lo: 0, hi: 10 }, { c: 1, v: 8, lo: 0, hi: 10 }];

  it('plays no expansion when it moves away from the others', () => {
    const data = animationDataFor(config, low, high);
    expect(data.axisExpansionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });

  it('plays no contraction when it moves back', () => {
    const data = animationDataFor(config, high, low);
    expect(data.axisContractionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });
});

describe('a value moving inside a fixed axis', () => {
  const config = { valueAxes: [{ min: 0, max: 20 }], series: [{ property: 'v', renderer: 'line' }] };
  const low = [{ c: 0, v: 5 }, { c: 1, v: 6 }];
  const high = [{ c: 0, v: 5 }, { c: 1, v: 12 }];

  it('plays no expansion when it grows', () => {
    expect(animationDataFor(config, low, high).axisExpansionData.deltaPercentage).toBe(0);
  });

  it('plays no contraction when it shrinks', () => {
    expect(animationDataFor(config, high, low).axisContractionData.deltaPercentage).toBe(0);
  });
});

describe('stacked values trading amounts', () => {
  it('plays no expansion when the stack totals stay the same', () => {
    const config = {
      seriesStacks: [{ id: 'S', axis: 'VA0' }],
      series: [{ property: 'a', renderer: 'bar', stack: 'S' }, { property: 'b', renderer: 'bar', stack: 'S' }]
    };
    const data = animationDataFor(config, [{ c: 0, a: 5, b: 5 }, { c: 1, a: 5, b: 5 }], [{ c: 0, a: 5, b: 5 }, { c: 1, a: 3, b: 7 }]);
    expect(data.axisExpansionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });
});

describe('a marker value change', () => {
  const low = [{ c: 0, v: 5, m: 1 }, { c: 1, v: 6, m: 2 }];
  const high = [{ c: 0, v: 5, m: 1 }, { c: 1, v: 6, m: 40 }];

  it('plays no expansion when no markers are drawn', () => {
    const config = { valueAxes: [{ min: 0, max: 20 }], series: [{ property: 'v', renderer: 'line', markerProperty: 'm', marker: { shape: null } }] };
    expect(animationDataFor(config, low, high).axisExpansionData.deltaPercentage).toBe(0);
  });

  it('still plays an expansion when markers are drawn, since their sizes are scaled to its range', () => {
    const config = { valueAxes: [{ min: 0, max: 20 }], series: [{ property: 'v', renderer: 'line', markerProperty: 'm', marker: { shape: 'circle' } }] };
    expect(animationDataFor(config, low, high).axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });
});

describe('expansions that move something', () => {
  it('still plays one when a value change moves an automatic axis', () => {
    const config = { series: [{ property: 'v', renderer: 'line' }] };
    expect(animationDataFor(config, [{ c: 0, v: 5 }, { c: 1, v: 6 }], [{ c: 0, v: 5 }, { c: 1, v: 12 }]).axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });

  it('still plays one for a bar color value change, since the bar colors are scaled to its range', () => {
    const config = { valueAxes: [{ min: 0, max: 20 }], series: [{ property: 'v', renderer: 'bar', colorProperty: 'k' }] };
    const data = animationDataFor(config, [{ c: 0, v: 5, k: 1 }, { c: 1, v: 6, k: 2 }], [{ c: 0, v: 5, k: 1 }, { c: 1, v: 6, k: 40 }]);
    expect(data.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });
});
