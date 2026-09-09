/**
 * Value axis explicit `ticks`: replaces generated ticks with configured { value, label } entries —
 * labels fall back to the formatted value, ticks outside the current axis domain are hidden.
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

function renderChart(valueAxisConfig: Record<string, unknown>) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', visible: false },
    valueAxes: [{ id: 'va', min: 0, max: 3, ...valueAxisConfig }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.valid).toBe(true);
  const data = [
    { label: 'a', value: 1 },
    { label: 'b', value: 3 }
  ];
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

describe('value axis explicit ticks', () => {
  it('renders exactly the configured ticks with their labels', () => {
    const { container, chart } = renderChart({
      ticks: [
        { value: 0.5, label: 'Low' },
        { value: 1.5, label: 'Mid' },
        { value: 2.5, label: 'High' }
      ]
    });
    expect(getAxisLabels(container).sort()).toEqual(['High', 'Low', 'Mid']);
    chart.destroy();
  });

  it('falls back to the formatted value when a tick has no label', () => {
    const { container, chart } = renderChart({
      ticks: [{ value: 1.5 }],
      tickLabel: { format: '.1f' }
    });
    expect(getAxisLabels(container)).toEqual(['1.5']);
    chart.destroy();
  });

  it('hides ticks outside the axis domain', () => {
    const { container, chart } = renderChart({
      ticks: [
        { value: 1, label: 'In' },
        { value: 7, label: 'Out' }
      ]
    });
    const labels = getAxisLabels(container);
    expect(labels).toContain('In');
    expect(labels).not.toContain('Out');
    chart.destroy();
  });
});

describe('value axis tick labels under filtering', () => {
  // Regression: the visible ticks came from the filtered-domain scale but were formatted with the raw
  // domain's precision, so a 0–3 axis left after filtering a 0–5000 series read 0.0k, 0.0k, …
  it('formats the visible ticks with the filtered domain\'s precision when adjustForFiltering is on', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', visible: false },
      valueAxes: [{ id: 'va', adjustForFiltering: true }],
      series: [
        { id: 'big', axis: 'va', property: 'big', renderer: 'bar' },
        { id: 'small', axis: 'va', property: 'small', renderer: 'bar' }
      ]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    const data = [
      { label: 'a', big: 1000, small: 1 },
      { label: 'b', big: 5000, small: 3 }
    ];
    const container = mountContainer();
    createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 400,
      filteredSeriesIds: { big: true }
    });
    runFrames();
    const labels = getAxisLabels(container).filter(label => /^[\d.]+k?$/.test(label));
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain('0.0k');
  });
});
