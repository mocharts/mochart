/**
 * Regression tests for a chartData change that reshapes the layout while keeping
 * the categoryData identity: filtering the last series of a value axis collapses
 * its gutter and widens the plot, so the category axis must be rebuilt for the
 * new width rather than keep positions computed for the old one. Drives the Chart
 * component directly, since that is the contract the finding is about; jsdom
 * measures every text as the same default box, so no re-measure pass heals a
 * stale axis here.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, mockBoundingClientRect } from './helpers';
import Chart from '../../src/components/Chart';
import type { ChartProps } from '../../src/components/Chart';
import { getChartData, getChartDataWithCategoryData } from '../../src/data/ChartData';
import { getFocusData } from '../../src/data/FocusData';
import { makeConfig, ArrayOfObjectsDataProvider } from '../data/fixtures';
import type { ChartData } from '../../src/types/data';
import { getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 15, costs: 6 }
];

const config = makeConfig({
  animation: { enabled: false },
  legend: { visible: false },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', side: 'start' }, { id: 'VA1', side: 'end', visibleWhenAllFiltered: false }],
  series: [
    { id: 'sales', property: 'sales', renderer: 'bar', axis: 'VA0' },
    { id: 'costs', property: 'costs', renderer: 'bar', axis: 'VA1' }
  ]
});
const dataProvider = new ArrayOfObjectsDataProvider(rows);

const charts: Chart[] = [];

function chartProps(chartData: ChartData): ChartProps {
  const focusData = getFocusData(config, chartData, -1, null, null);
  return { mochartConfig: config, dataProvider, chartData, focusData, width: WIDTH, height: HEIGHT, standalone: true };
}

function mountChart(chartData: ChartData): { container: Element; chart: Chart } {
  const container = mountContainer();
  const chart = new Chart();
  charts.push(chart);
  chart.mount(container, null, chartProps(chartData));
  return { container, chart };
}

/** The filtered chartData sharing the unfiltered categoryData object, as a data change touching only the series side. */
function chartDataPair(filteredSeriesIds: Record<string, boolean>): { from: ChartData; to: ChartData } {
  const from = getChartData(config, dataProvider, {});
  const to = getChartDataWithCategoryData(getChartData(config, dataProvider, filteredSeriesIds), from.categoryData);
  return { from, to };
}

function categoryTickTransforms(container: Element): string[] {
  return [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel'))]
    .map(el => el.getAttribute('transform') ?? '');
}

function plotClipWidth(container: Element): number {
  return Number(container.querySelector('clipPath[id^="series__clippath__"] rect')!.getAttribute('width'));
}

function hasValueAxis(container: Element, id: string): boolean {
  return container.querySelector(getIdCssSelector('valueAxis', id)) !== null;
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

afterEach(() => {
  for (const chart of charts) {
    chart.destroy();
  }
  charts.length = 0;
});

describe('layout-only chartData changes', () => {
  it('rebuilds the category axis when filtering collapses a value axis gutter', () => {
    const { from, to } = chartDataPair({ costs: true });
    const { container: updated, chart } = mountChart(from);
    expect(hasValueAxis(updated, 'VA1')).toBe(true);
    chart.update(chartProps(to));
    expect(hasValueAxis(updated, 'VA1')).toBe(false);

    const { container: fresh } = mountChart(to);
    expect(plotClipWidth(updated)).toBe(plotClipWidth(fresh));
    const transforms = categoryTickTransforms(updated);
    expect(transforms.length).toBe(rows.length);
    expect(transforms).toEqual(categoryTickTransforms(fresh));
  });

  it('rebuilds the category axis when unfiltering restores a value axis gutter', () => {
    const { from, to } = chartDataPair({ costs: true });
    const { container: updated, chart } = mountChart(to);
    expect(hasValueAxis(updated, 'VA1')).toBe(false);
    chart.update(chartProps(from));
    expect(hasValueAxis(updated, 'VA1')).toBe(true);

    const { container: fresh } = mountChart(from);
    expect(plotClipWidth(updated)).toBe(plotClipWidth(fresh));
    expect(categoryTickTransforms(updated)).toEqual(categoryTickTransforms(fresh));
  });
});
