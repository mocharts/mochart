// the pointer cursor follows what a click does: legend items that filter or focus, tooltip rows a click acts on
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 'sales' },
      { id: 'S1', property: 'costs' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT }));
  return container;
}

function legendItemCursors(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll<SVGGElement>(getCssSelector('legendItem'))).map(item => item.getAttribute('cursor'));
}

function openTooltip(container: Element): void {
  const root = container.querySelector(getChartRootCssSelector())!;
  root.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
  root.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
  expect(container.querySelector(getCssSelector('tooltip'))).not.toBeNull();
}

function seriesRow(container: Element, seriesId: string): HTMLElement {
  return container.querySelector<HTMLElement>(getCssSelector('tooltip') + ' ' + getIdCssSelector('tooltipSeriesLine', seriesId))!;
}

function categoryRow(container: Element): HTMLElement {
  return container.querySelector<HTMLElement>(getCssSelector('tooltip') + ' ' + getCssSelector('tooltipCategoryLine'))!;
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('legend items', () => {
  it('show the pointer when a click filters or focuses, with or without accessibility', () => {
    expect(legendItemCursors(mountChart(makeConfig({ legend: { visible: true } })))).toEqual(['pointer', 'pointer']);
    expect(legendItemCursors(mountChart(makeConfig({ legend: { visible: true, filterOnClick: false, focusOnClick: true } })))).toEqual(['pointer', 'pointer']);
    expect(legendItemCursors(mountChart(makeConfig({ legend: { visible: true }, accessibility: { enabled: false } })))).toEqual(['pointer', 'pointer']);
  });

  it('keep the default cursor when nothing responds to a click', () => {
    expect(legendItemCursors(mountChart(makeConfig({ legend: { visible: true, filterOnClick: false, focusOnClick: false } })))).toEqual([null, null]);
  });
});

describe('tooltip rows', () => {
  it('show the pointer on the rows a click acts on and only those', () => {
    const filtering = mountChart(makeConfig({ legend: { visible: false }, tooltip: { filterSeriesOnClick: true } }));
    openTooltip(filtering);
    expect(seriesRow(filtering, 'S0').style.cursor).toBe('pointer');
    expect(seriesRow(filtering, 'S1').style.cursor).toBe('pointer');
    expect(categoryRow(filtering).style.cursor).toBe('');

    const inert = mountChart(makeConfig({ legend: { visible: false } }));
    openTooltip(inert);
    expect(seriesRow(inert, 'S0').style.cursor).toBe('');
    expect(categoryRow(inert).style.cursor).toBe('');
  });
});
