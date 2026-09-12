/**
 * Category axis `tickStep`: which ticks an ordinal axis shows by rule — every count-th category from an
 * offset, or under a period the first category of each calendar period — thinned to what fits, with a
 * linear date axis placing its ticks on the period boundaries instead.
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

function renderChart(categoryAxisConfig: Record<string, unknown>, data: Record<string, unknown>[], width = 1200) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label', ...categoryAxisConfig },
    valueAxes: [{ id: 'va', min: 0, max: 3, visible: false }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.errors).toEqual([]);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width,
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

/** Weekdays from a start date (inclusive) for a number of calendar days, skipping the given ISO dates. */
function weekdays(start: string, days: number, holidays: string[] = []): string[] {
  const dates: string[] = [];
  const date = new Date(start);
  for (let i = 0; i < days; i++) {
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.includes(iso)) {
      dates.push(iso);
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

const letters = 'abcdefghijklmno'.split('');
const letterRows = letters.map((label, index) => ({ label, value: 1 + (index % 3) }));
const dateRows = (dates: string[]) => dates.map((label, index) => ({ label, value: 1 + (index % 3) }));

describe('category axis tick step on an ordinal axis', () => {
  it('shows every count-th category from the offset', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickStep: { count: 5, offset: 3 } }, letterRows);
    expect(getAxisLabels(container)).toEqual(['d', 'i', 'n']);
    chart.destroy();
  });

  it('adds the first category back with includeFirst', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickStep: { count: 5, offset: 3, includeFirst: true } }, letterRows);
    expect(getAxisLabels(container)).toEqual(['a', 'd', 'i', 'n']);
    chart.destroy();
  });

  it('steps by week to the first trading day of each week, across a holiday and a partial first week', () => {
    // Wednesday June 3 2026 start; Monday June 8 is a holiday, so that week starts on the Tuesday
    const dates = weekdays('2026-06-03', 19, ['2026-06-08']);
    const { container, chart } = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'week' } }, dateRows(dates));
    expect(getAxisLabels(container)).toEqual(['Jun 03', 'Jun 09', 'Jun 15']);
    chart.destroy();
  });

  it('skips the partial first week with an offset, and steps every second week with a count', () => {
    const dates = weekdays('2026-06-03', 33);
    const skipped = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'week', offset: 1 } }, dateRows(dates));
    expect(getAxisLabels(skipped.container)).toEqual(['Jun 08', 'Jun 15', 'Jun 22', 'Jun 29']);
    skipped.chart.destroy();
    const fortnightly = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'week', count: 2 } }, dateRows(dates));
    expect(getAxisLabels(fortnightly.container)).toEqual(['Jun 03', 'Jun 15', 'Jun 29']);
    fortnightly.chart.destroy();
  });

  it('steps by month and year to the first category of each period', () => {
    const dates = ['2025-11-10', '2025-11-24', '2025-12-08', '2026-01-05', '2026-01-19', '2026-02-02'];
    const monthly = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'month' } }, dateRows(dates));
    expect(getAxisLabels(monthly.container)).toEqual(['Nov 10', 'Dec 08', 'Jan 05', 'Feb 02']);
    monthly.chart.destroy();
    const yearly = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%Y' }, tickStep: { period: 'year' } }, dateRows(dates));
    expect(getAxisLabels(yearly.container)).toEqual(['2025', '2026']);
    yearly.chart.destroy();
  });

  it('thins the surviving ticks to what fits, keeping them on the rule', () => {
    const dates = weekdays('2026-06-01', 26 * 7);
    const { container, chart } = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'week' } }, dateRows(dates), 300);
    const labels = getAxisLabels(container);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.length).toBeLessThan(26);
    const mondays = dates.filter((date) => new Date(date).getUTCDay() === 1).map((date) => date.slice(5).replace('-', ' '));
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mondayLabels = mondays.map((monthDay) => monthNames[Number(monthDay.slice(0, 2)) - 1] + ' ' + monthDay.slice(3));
    // every label is a Monday, and the survivors are evenly strided through the Mondays
    const positions = labels.map((label) => mondayLabels.indexOf(label));
    expect(positions).not.toContain(-1);
    const strides = new Set(positions.slice(1).map((position, i) => position - positions[i]));
    expect(strides.size).toBe(1);
    expect([...strides][0]).toBeGreaterThan(1);
    chart.destroy();
  });

  it('leaves the automatic ticks alone at the defaults', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickStep: {} }, letterRows);
    expect(getAxisLabels(container)).toEqual(letters);
    chart.destroy();
  });
});

describe('category axis tick step on a linear date axis', () => {
  it('places the ticks on the period boundaries', () => {
    const dates = weekdays('2026-06-03', 19, ['2026-06-08']);
    const { container, chart } = renderChart({ type: 'date', scale: 'linear', tickLabel: { format: '%b %d' }, tickStep: { period: 'week' } }, dateRows(dates));
    // the boundaries inside the domain: the holiday Monday still gets its tick, the partial first week does not
    expect(getAxisLabels(container)).toEqual(['Jun 08', 'Jun 15']);
    chart.destroy();
  });
});

describe('category axis tick step validation', () => {
  it('rejects the ordinal-only members on a linear axis and a period on a non-date axis', () => {
    const { enhanceConfig } = mochart;
    const linear = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'number', scale: 'linear', tickStep: { count: 2, offset: 1, includeFirst: true } },
      series: [{ property: 'value' }]
    });
    expect(linear.validation.errors.filter((error) => error.includes('tickStep'))).toHaveLength(3);
    const stringUnit = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', tickStep: { period: 'week' } },
      series: [{ property: 'value' }]
    });
    expect(stringUnit.validation.errors.join('\n')).toMatch(/tickStep\.period/);
  });
});
