// nothing draws from a series label or tooltip range, so widening or narrowing one alone must not play an expansion or contraction
import { describe, it, expect } from 'vitest';
import { getChartAnimationData } from '../../src/animation/ChartAnimationData';
import { getChartData } from '../../src/data/ChartData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';

type Row = Record<string, number>;

function animationDataFor(extraProperty: string, from: Row[], to: Row[]) {
  const config = makeConfig({
    categoryAxis: { property: 'c', type: 'number', scale: 'ordinal' },
    valueAxes: [{ min: 0, max: 20 }],
    series: [{ property: 'v', renderer: 'line', [extraProperty]: 'x', marker: { shape: 'circle' } }]
  });
  const prev = getChartData(config, new ArrayOfObjectsDataProvider(from), {});
  const next = getChartData(config, new ArrayOfObjectsDataProvider(to), {});
  return getChartAnimationData(config, prev, next);
}

const narrow: Row[] = [{ c: 0, v: 5, x: 1 }, { c: 1, v: 6, x: 2 }];
const wide: Row[] = [{ c: 0, v: 5, x: 1 }, { c: 1, v: 6, x: 40 }];

describe.each([['labelProperty', 'label'], ['tooltipProperty', 'tooltip']])('a %s change alone', (extraProperty, key) => {
  it('plays no expansion when its range widens', () => {
    const data = animationDataFor(extraProperty, narrow, wide);
    expect(data.axisExpansionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });

  it('still hands the widened range to the value change', () => {
    const data = animationDataFor(extraProperty, narrow, wide);
    const [domains] = Object.values(data.axisExpansionData.final!.seriesData.raw.domains);
    expect(domains[key]).toEqual([1, 40]);
  });

  it('plays no contraction when its range narrows', () => {
    const data = animationDataFor(extraProperty, wide, narrow);
    expect(data.axisContractionData.deltaPercentage).toBe(0);
    expect(data.valueChangeData.deltaPercentage).toBeGreaterThan(0);
  });

  it('leaves the expansion of a value change paced by that value alone', () => {
    const valueOnly = animationDataFor(extraProperty, narrow, [{ c: 0, v: 5, x: 1 }, { c: 1, v: 30, x: 2 }]);
    const both = animationDataFor(extraProperty, narrow, [{ c: 0, v: 5, x: 1 }, { c: 1, v: 30, x: 40 }]);
    expect(valueOnly.axisExpansionData.deltaPercentage).toBeGreaterThan(0);
    expect(both.axisExpansionData.deltaPercentage).toBe(valueOnly.axisExpansionData.deltaPercentage);
  });
});

describe('a marker value change alone', () => {
  it('still plays an expansion, since marker sizes are scaled from its range', () => {
    expect(animationDataFor('markerProperty', narrow, wide).axisExpansionData.deltaPercentage).toBeGreaterThan(0);
  });
});
