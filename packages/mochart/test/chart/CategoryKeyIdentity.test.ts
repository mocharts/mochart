/**
 * categoryAxis.keyProperty identifies categories across data changes, so display values are free to
 * repeat. Focus remapping has to key on the same values every other stage does.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import type { MochartInputConfig } from '../../src/types/config';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const ROWS = [
  { id: 1, label: 'Mon', value: 3 },
  { id: 2, label: 'Mon', value: 7 },
  { id: 3, label: 'Tue', value: 5 }
];

const CONFIG = {
  version: '1.0.0',
  animation: { enabled: false },
  categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'va' }],
  series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
} as MochartInputConfig;

describe('category key identity', () => {
  it('keeps focus on the category the key names when repeated labels are re-read', () => {
    const focuses: { focusedCategoryIndex: number }[] = [];
    const mochartConfig = mochart.enhanceConfig(CONFIG);
    const props = {
      mochartConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(ROWS),
      width: 300, height: 200,
      onFocus: (focus: { focusedCategoryIndex: number }) => focuses.push(focus)
    };
    const container = mountContainer();
    // focus the second 'Mon' (id 2), then release the controlled value keeping that focus
    const chart = mochart.createChart(container, { ...props, focusedCategoryIndex: 1 } as never);
    runFrames();
    chart.replace(props as never);

    chart.update({ ...props, dataProvider: new mochart.ArrayOfObjectsDataProvider([...ROWS]) } as never);
    runFrames();

    // identical data, so the focused category is still index 1 — matching by label would report 0
    expect(focuses.map(focus => focus.focusedCategoryIndex)).toEqual([]);
    chart.destroy();
  });

  it('follows the keyed category when the rows are reordered', () => {
    const focuses: { focusedCategoryIndex: number }[] = [];
    const mochartConfig = mochart.enhanceConfig(CONFIG);
    const props = {
      mochartConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(ROWS),
      width: 300, height: 200,
      onFocus: (focus: { focusedCategoryIndex: number }) => focuses.push(focus)
    };
    const container = mountContainer();
    const chart = mochart.createChart(container, { ...props, focusedCategoryIndex: 1 } as never);
    runFrames();
    chart.replace(props as never);

    const [first, second, third] = ROWS;
    chart.update({ ...props, dataProvider: new mochart.ArrayOfObjectsDataProvider([third, first, second]) } as never);
    runFrames();

    // id 2 is last now; matching by label would land on the first 'Mon' at index 1 instead
    expect(focuses.map(focus => focus.focusedCategoryIndex)).toEqual([2]);
    chart.destroy();
  });

  it('drops focus when the keyed category is gone, even though its label remains', () => {
    const focuses: { focusedCategoryIndex: number }[] = [];
    const mochartConfig = mochart.enhanceConfig(CONFIG);
    const props = {
      mochartConfig,
      dataProvider: new mochart.ArrayOfObjectsDataProvider(ROWS),
      width: 300, height: 200,
      onFocus: (focus: { focusedCategoryIndex: number }) => focuses.push(focus)
    };
    const container = mountContainer();
    const chart = mochart.createChart(container, { ...props, focusedCategoryIndex: 1 } as never);
    runFrames();
    chart.replace(props as never);

    const remaining = ROWS.filter(row => row.id !== 2);
    chart.update({ ...props, dataProvider: new mochart.ArrayOfObjectsDataProvider(remaining) } as never);
    runFrames();

    // 'Mon' is still there under id 1, but the focused category itself is not
    expect(focuses.map(focus => focus.focusedCategoryIndex)).toEqual([-1]);
    chart.destroy();
  });
});
