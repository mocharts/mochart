/**
 * Value axis explicit `ticks`: replaces generated ticks with configured { value, label } entries.
 * Labels fall back to the formatted value, ticks outside the current axis domain are hidden.
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

function renderChart(valueAxisConfig: Record<string, unknown>, height = 200) {
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
    height
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

  // the auto precision came from d3's own 1-2-5 step for the tick count, so 0.125 read as 0.1
  it('names unlabeled explicit ticks exactly, with the precision of their smallest gap', () => {
    const { container, chart } = renderChart({ ticks: [{ value: 0 }, { value: 0.125 }, { value: 0.5 }] });
    expect(getAxisLabels(container)).toEqual(['0.000', '0.125', '0.500']);
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

describe('value axis tick step label precision', () => {
  // the data reach 3, so the domains below hold them: a clipped value would add a clip indicator label
  const steps = (from: number, to: number, step: number, decimals: number) =>
    Array.from({ length: Math.round((to - from) / step) + 1 }, (_v, i) => (from + i * step).toFixed(decimals));

  it('names the interval ticks exactly under the auto format', () => {
    const quarters = renderChart({ min: 0, max: 3, maxTickCount: 20, tickStep: { interval: 0.25 } }, 600);
    expect(getAxisLabels(quarters.container)).toEqual(steps(0, 3, 0.25, 2));
    quarters.chart.destroy();
    const halves = renderChart({ min: 0, max: 10, tickStep: { interval: 2.5 } });
    expect(getAxisLabels(halves.container)).toEqual(['0.0', '2.5', '5.0', '7.5', '10.0']);
    halves.chart.destroy();
  });

  it('follows the spacing of the ticks count keeps, not the interval', () => {
    const { container, chart } = renderChart({ min: 0, max: 10, tickStep: { interval: 2.5, count: 2 } });
    expect(getAxisLabels(container)).toEqual(['0', '5', '10']);
    chart.destroy();
  });

  it('names the minor step ticks exactly while the ticks keep the interval precision', () => {
    const { container, chart } = renderChart({ min: 0, max: 3, tickLabel: { minorFormat: 'auto' }, tickStep: { interval: 1, minorSteps: 4 } }, 600);
    const labels = getAxisLabels(container);
    expect(labels).toEqual(expect.arrayContaining(['0', '1', '2', '3', '0.25', '0.50', '0.75', '1.25', '2.75']));
    expect(labels).not.toContain('0.3');
    chart.destroy();
  });

  it('keeps a specifier precision and derives an open one for other format types', () => {
    const fixed = renderChart({ min: 0, max: 3, maxTickCount: 20, tickLabel: { format: '.1f' }, tickStep: { interval: 0.25 } }, 600);
    // the specifier's own precision stands, so the quarter ticks round the way they did before
    expect(getAxisLabels(fixed.container).slice(0, 5)).toEqual(['0.0', '0.3', '0.5', '0.8', '1.0']);
    fixed.chart.destroy();
    const general = renderChart({ min: 0, max: 3, maxTickCount: 20, tickLabel: { format: '' }, tickStep: { interval: 0.25 } }, 600);
    expect(getAxisLabels(general.container).slice(0, 5)).toEqual(['0', '0.25', '0.5', '0.75', '1']);
    general.chart.destroy();
    const percent = renderChart({ min: 0, max: 4, maxTickCount: 20, tickLabel: { format: '%' }, tickStep: { interval: 0.25 } }, 600);
    expect(getAxisLabels(percent.container).slice(0, 4)).toEqual(['0%', '25%', '50%', '75%']);
    percent.chart.destroy();
  });
});
