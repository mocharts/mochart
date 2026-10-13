// Every text style's strokeDashArray reaches the text element, as it does for the chart title and legend.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart, createPie } from '../../src';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;
const textStyle = { normal: { strokeDashArray: '2 1' } };

function mount(config: Record<string, unknown>, data: readonly unknown[]): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: { version: '1.0.0', animation: { enabled: false }, ...config } as unknown as MochartInputConfig,
    data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

function dashArrays(container: Element, selector: string): (string | null)[] {
  const texts = [...container.querySelectorAll(selector)];
  expect(texts.length).toBeGreaterThan(0);
  return texts.map((text) => text.getAttribute('stroke-dasharray'));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('text strokeDashArray', () => {
  it('applies to axis titles, tick labels and series labels', () => {
    const container = mount({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal',
        title: { text: 'Month', textStyle }, tickLabel: { textStyle } },
      valueAxes: [{ title: { text: 'Sales', textStyle }, tickLabel: { textStyle } }],
      series: [{ property: 'sales', renderer: 'bar', labelProperty: 'sales', label: { textStyle } }]
    }, [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }]);
    for (const selector of [getCssSelector('axisTitle') + ' text', getCssSelector('axisTickLabel') + ' text', getCssSelector('seriesLabel')]) {
      expect(new Set(dashArrays(container, selector))).toEqual(new Set(['2 1']));
    }
  });

  it('applies to pie slice labels', () => {
    const pie = createPie([{ label: 'A', value: 60 }, { label: 'B', value: 40 }]);
    const series = pie.series.map((s) => ({ ...s, label: { textStyle } }));
    const container = mount({ chart: pie.chart, pie: { ...pie.pie, label: { visible: true } },
      categoryAxis: pie.categoryAxis, series }, pie.data);
    expect(new Set(dashArrays(container, getCssSelector('seriesSliceLabel')))).toEqual(new Set(['2 1']));
  });
});
