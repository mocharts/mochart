/**
 * Category axis explicit `ticks`: replaces generated ticks with configured { value, label } entries —
 * an ordinal axis shows a tick at each matching category (a date matches by instant), labels fall
 * back to the formatted value, and a tick matching no category (or outside a linear domain) is hidden.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const weekdays = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10'];

function renderChart(categoryAxisConfig: Record<string, unknown>, data: Record<string, unknown>[]) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label', ...categoryAxisConfig },
    valueAxes: [{ id: 'va', min: 0, max: 3, visible: false }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.valid).toBe(true);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width: 300,
    height: 200
  });
  runFrames();
  return { container, chart };
}

function getAxisLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('text'))
    .filter((text) => (text as SVGTextElement & { style: CSSStyleDeclaration }).style.visibility !== 'hidden')
    .map((text) => text.textContent ?? '')
    .filter((label) => label !== '');
}

describe('category axis explicit ticks', () => {
  it('renders exactly the configured ticks at the matching string categories', () => {
    const { container, chart } = renderChart(
      { type: 'string', scale: 'ordinal', ticks: [{ value: 'a', label: 'First' }, { value: 'c', label: 'Third' }] },
      [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }]
    );
    expect(getAxisLabels(container).sort()).toEqual(['First', 'Third']);
    chart.destroy();
  });

  it('matches date categories by instant from ISO string and timestamp forms, and formats missing labels', () => {
    const { container, chart } = renderChart(
      { type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, ticks: [{ value: '2026-06-01' }, { value: Date.UTC(2026, 5, 8) }] },
      weekdays.map((label, index) => ({ label, value: 1 + (index % 3) }))
    );
    expect(getAxisLabels(container)).toEqual(['Jun 01', 'Jun 08']);
    chart.destroy();
  });

  it('hides a tick that matches no category', () => {
    const { container, chart } = renderChart(
      { type: 'string', scale: 'ordinal', ticks: [{ value: 'a', label: 'In' }, { value: 'z', label: 'Out' }] },
      [{ label: 'a', value: 1 }, { label: 'b', value: 2 }]
    );
    const labels = getAxisLabels(container);
    expect(labels).toContain('In');
    expect(labels).not.toContain('Out');
    chart.destroy();
  });

  it('places ticks on the scale of a linear axis and hides those outside its domain', () => {
    const { container, chart } = renderChart(
      { type: 'number', scale: 'linear', ticks: [{ value: 15, label: 'Mid' }, { value: 100, label: 'Out' }] },
      [{ label: 10, value: 1 }, { label: 20, value: 2 }, { label: 30, value: 3 }]
    );
    const labels = getAxisLabels(container);
    expect(labels).toContain('Mid');
    expect(labels).not.toContain('Out');
    chart.destroy();
  });

  it('names a category by its key on an axis with a keyProperty, so a repeated value can be told apart', () => {
    // the clocks go back: 01:30 shows twice, keyed by the real instant
    const rows = [
      { shown: '01:00', at: '2017-11-05T01:00:00-04:00', value: 1 },
      { shown: '01:30', at: '2017-11-05T01:30:00-04:00', value: 2 },
      { shown: '01:30', at: '2017-11-05T01:30:00-05:00', value: 3 },
      { shown: '02:00', at: '2017-11-05T02:00:00-05:00', value: 1 }
    ];
    const byKey = renderChart({ type: 'string', scale: 'ordinal', keyProperty: 'at', ticks: [{ value: '2017-11-05T01:30:00-05:00' }] }, rows.map(({ shown, at, value }) => ({ label: shown, at, value })));
    expect(getAxisLabels(byKey.container)).toEqual(['01:30']);
    byKey.chart.destroy();
    const byValue = renderChart({ type: 'string', scale: 'ordinal', keyProperty: 'at', ticks: [{ value: '01:30' }] }, rows.map(({ shown, at, value }) => ({ label: shown, at, value })));
    expect(getAxisLabels(byValue.container)).toEqual([]);
    byValue.chart.destroy();
  });

  it('rejects a tick value of the wrong form for the axis type', () => {
    const { enhanceConfig } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'number', scale: 'ordinal', ticks: [{ value: 'ten' }] },
      series: [{ property: 'value' }]
    });
    expect(mochartConfig.validation.valid).toBe(false);
    expect(mochartConfig.validation.errors.join('\n')).toMatch(/ticks/);
  });
});
