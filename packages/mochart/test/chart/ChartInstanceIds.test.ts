import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';

let mochart: typeof import('../../src');

const chartInstanceCounterKey = Symbol.for('mochart.chartInstanceCounter');
const counterScope = globalThis as unknown as Record<symbol, number | undefined>;

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function renderChart(): HTMLElement {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'i', type: 'number', scale: 'linear' },
    valueAxes: [{ id: 'va' }],
    series: [{ axis: 'va', property: 'value', renderer: 'line' }]
  });
  const container = mountContainer();
  createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider([{ i: 0, value: 3 }, { i: 1, value: 7 }]),
    width: 150,
    height: 32
  });
  runFrames();
  return container;
}

function clipPathIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('clipPath')).map(element => element.id);
}

describe('chart instance ids', () => {

  // Regression: the counter was module state, so a second bundled copy of the library restarted it
  // at 1 and both copies minted the same ids into one document.
  it('continues from a count another copy of the library already reached', () => {
    counterScope[chartInstanceCounterKey] = 40;
    const first = clipPathIds(renderChart());
    const second = clipPathIds(renderChart());

    expect(first.length).toBeGreaterThan(0);
    expect(first.some(id => id.endsWith('__41'))).toBe(true);
    expect(second.some(id => id.endsWith('__42'))).toBe(true);
    expect(first.filter(id => second.includes(id))).toEqual([]);
  });
});
