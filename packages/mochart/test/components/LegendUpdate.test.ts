/**
 * Regression tests for legend membership changes through the public update()
 * path: flipping a series' showInLegend must take the re-measure path instead
 * of laying out the new item set with bounds measured for the old one.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDomAccessors } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 }
];

function makeConfig(costsShowInLegend: boolean): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }, { property: 'costs', showInLegend: costsShowInLegend }]
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig): { container: Element; handle: ChartHandle<DefaultChartProps> } {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: 800, height: 600
  } as DefaultChartProps));
  return { container, handle };
}

function legendItemCount(container: Element): number {
  return container.querySelectorAll(getCssSelector('legendItem')).length;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

// Regression: the per-item class was `mochart-legend-item-<id>`, so a series id of `text` stamped the structural
// `mochart-legend-item-text` class on the item root; the text accessor then over-matched and every legend item fell
// back to default text bounds
describe('legend item id classes', () => {
  it('lays a series with a structural-suffix id out the same as any other id', () => {
    const layout = (id: string) => {
      const config = { ...makeConfig(true), series: [{ property: 'sales', id }, { property: 'costs' }] } as MochartInputConfig;
      const { container } = mountChart(config);
      expect(getDomAccessors(container).getLegendItemTextDomElements().length).toBe(2);
      return [...container.querySelectorAll(getCssSelector('legendItem'))].map(item => item.getAttribute('transform'));
    };
    expect(layout('text')).toEqual(layout('tex1'));
    expect(layout('background')).toEqual(layout('tex1'));
  });
});

describe('legend membership config updates', () => {
  it('adds the legend item when showInLegend flips false -> true', () => {
    const { container, handle } = mountChart(makeConfig(false));
    expect(legendItemCount(container)).toBe(1);
    handle.update({ config: makeConfig(true) } as Partial<DefaultChartProps>);
    expect(legendItemCount(container)).toBe(2);
  });

  it('removes the legend item when showInLegend flips true -> false', () => {
    const { container, handle } = mountChart(makeConfig(true));
    expect(legendItemCount(container)).toBe(2);
    handle.update({ config: makeConfig(false) } as Partial<DefaultChartProps>);
    expect(legendItemCount(container)).toBe(1);
  });
});
