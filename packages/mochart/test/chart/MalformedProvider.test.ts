/**
 * A provider missing its accessor is invalid, and both entry points have to agree about that:
 * createChart delegates the provider for its own reads, and the pipeline's shape checks see the
 * delegate rather than the host's object.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import type { MochartInputConfig } from '../../src/types/config';
import type { DataProvider } from '../../src/types/data';
import { getCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const CONFIG = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0' }],
  series: [{ property: 'sales', renderer: 'bar' }]
} as unknown as MochartInputConfig;

const ROWS = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }];

// a partially built provider, or a plain-JS host: the type forbids it, so only a cast reaches here
const malformed = { rows: ROWS } as unknown as DataProvider;

describe('a dataset with a null entry', () => {
  // Regression: the `in` check threw a TypeError on the null entry, so the raw error replaced
  // the descriptive data error
  it('renders the error state instead of throwing', () => {
    const container = mountContainer();
    let chart: { destroy: () => void } | undefined;
    expect(() => {
      chart = mochart.createDefaultChart(container, {
        config: CONFIG, data: [{ month: 'Jan', sales: 10 }, null], width: 300, height: 200
      } as never);
    }).not.toThrow();
    runFrames();
    expect(container.querySelectorAll(getCssSelector('seriesBar')).length).toBe(0);
    chart!.destroy();
  });
});

describe('a provider with no getPropertyValues', () => {
  it('renders the no-data state from createChart instead of throwing', () => {
    const container = mountContainer();
    let chart;
    expect(() => {
      chart = mochart.createChart(container, {
        mochartConfig: mochart.enhanceConfig(CONFIG),
        dataProvider: malformed,
        width: 300, height: 200
      } as never);
    }).not.toThrow();
    runFrames();
    expect(container.querySelectorAll(getCssSelector('seriesBar')).length).toBe(0);
    (chart as unknown as { destroy: () => void }).destroy();
  });

  it('renders the same way from createDefaultChart', () => {
    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, {
      config: CONFIG, dataProvider: malformed, width: 300, height: 200
    } as never);
    runFrames();
    expect(container.querySelectorAll(getCssSelector('seriesBar')).length).toBe(0);
    chart.destroy();
  });

  it('still draws a well-formed provider', () => {
    const container = mountContainer();
    const chart = mochart.createChart(container, {
      mochartConfig: mochart.enhanceConfig(CONFIG),
      dataProvider: new mochart.ArrayOfObjectsDataProvider(ROWS),
      width: 300, height: 200
    } as never);
    runFrames();
    expect(container.querySelectorAll(getCssSelector('seriesBar')).length).toBeGreaterThan(0);
    chart.destroy();
  });
});
