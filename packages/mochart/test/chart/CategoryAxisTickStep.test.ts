/**
 * `tickStep`: which ticks an axis shows by rule. An ordinal axis keeps every count-th category from an
 * offset, or under a period the first category of each calendar period, thinned to what fits, and the
 * categories between are minor ticks. A linear axis places its ticks on period boundaries or interval
 * multiples with minor ticks between them from minorPeriod or minorSteps. The tickLabel, tickMark and
 * gridLine minor settings draw the minor ticks, and minor labels show only where they fit beside their neighbours.
 */
import { describe, it, beforeAll, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function renderChart(categoryAxisConfig: Record<string, unknown>, data: Record<string, unknown>[], width = 1200, valueAxisConfig: Record<string, unknown> = { min: 0, max: 3, visible: false }, height = 200) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label', ...categoryAxisConfig },
    valueAxes: [{ id: 'va', ...valueAxisConfig }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.errors).toEqual([]);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(data),
    width,
    height
  });
  runFrames();
  return { container, chart };
}

const isShown = (element: Element) => (element as SVGElement & { style: CSSStyleDeclaration }).style.visibility !== 'hidden';

function getAxisLabels(container: HTMLElement, selector = 'text'): string[] {
  return Array.from(container.querySelectorAll(selector))
    .filter(isShown)
    .map((text) => text.textContent ?? '')
    .filter((label) => label !== '');
}

const categoryTickLabels = getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel');
const valueTickLabels = getDescendantCssSelector('valueAxis', 'axisTickLabels', 'axisTickLabel');
const minorLabel = getCssSelector('axisMinorTickLabel');
const categoryTickMarks = getDescendantCssSelector('categoryAxis', 'axisTickMarks', 'axisTickMark');
const minorMark = getCssSelector('axisMinorTickMark');
const categoryGridLines = getDescendantCssSelector('categoryAxisGrid', 'axisGridLine');
const minorGridLine = getCssSelector('axisMinorGridLine');

/** The labels of one kind (minor or not) under a tick label selector, shown ones only. */
function getKindLabels(container: HTMLElement, tickLabels: string, minor: boolean): string[] {
  return getAxisLabels(container, tickLabels + (minor ? minorLabel : ':not(' + minorLabel + ')') + ' text');
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

  it('hides a week tick that would collide with the one before it when a week holds a single category', () => {
    // Jun 1 alone, Jun 8 to 12, Jun 15 alone, Jun 22 to 26, Jun 29 alone, Jul 6 to 10: three ticks sit one slot after another
    const dates = ['2026-06-01', ...weekdays('2026-06-08', 5), '2026-06-15', ...weekdays('2026-06-22', 5), '2026-06-29', ...weekdays('2026-07-06', 5)];
    // the shims measure no label width, so the spacing alone is the room a tick needs: 80px against 33px slots at 600px wide
    const weekly = { type: 'date', scale: 'ordinal', minTickSpacing: 80, tickLabel: { format: '%b %d' }, tickStep: { period: 'week' } };
    const roomy = renderChart(weekly, dateRows(dates), 2400);
    expect(getAxisLabels(roomy.container)).toEqual(['Jun 01', 'Jun 08', 'Jun 15', 'Jun 22', 'Jun 29', 'Jul 06']);
    roomy.chart.destroy();
    const crowded = renderChart(weekly, dateRows(dates), 600);
    const labels = getAxisLabels(crowded.container);
    // the tick one slot after a lone-category week is the one that goes, and every survivor is still a Monday
    expect(labels).not.toContain('Jun 22');
    expect(labels).toContain('Jun 15');
    expect(labels.every((label) => ['Jun 01', 'Jun 08', 'Jun 15', 'Jun 29', 'Jul 06'].includes(label))).toBe(true);
    crowded.chart.destroy();
  });

  it('leaves the automatic ticks alone at the defaults', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickStep: {} }, letterRows);
    expect(getAxisLabels(container)).toEqual(letters);
    chart.destroy();
  });
});

describe('category axis tick step minor labels', () => {
  // Wednesday June 3 2026 start with Monday June 8 a holiday: Jun 03, Jun 09 and Jun 15 are the rule's ticks
  const dates = weekdays('2026-06-03', 19, ['2026-06-08']);
  const weeklyAxis = { type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d', minorFormat: '%a' }, tickStep: { period: 'week' } };

  it('labels the categories between the weekly ticks with the minor format', () => {
    const { container, chart } = renderChart(weeklyAxis, dateRows(dates));
    expect(getAxisLabels(container)).toEqual(['Jun 03', 'Thu', 'Fri', 'Jun 09', 'Wed', 'Thu', 'Fri', 'Jun 15', 'Tue', 'Wed', 'Thu', 'Fri']);
    chart.destroy();
  });

  it('hides every minor label together where a category slot cannot fit the widest one, leaving the weekly ticks alone', () => {
    // jsdom measures every label at the 20px default, so a 200px chart's 12 slots are too narrow for any minor
    const narrow = renderChart(weeklyAxis, dateRows(dates), 200);
    const narrowWithoutMinors = renderChart({ ...weeklyAxis, tickLabel: { format: '%b %d' } }, dateRows(dates), 200);
    const labels = getAxisLabels(narrow.container);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.every((label) => label.startsWith('Jun '))).toBe(true);
    expect(labels).toEqual(getAxisLabels(narrowWithoutMinors.container));
    narrow.chart.destroy();
    narrowWithoutMinors.chart.destroy();
  });

  it('keeps the weekly ticks the same with and without a minor format', () => {
    const withMinors = renderChart(weeklyAxis, dateRows(dates));
    const withoutMinors = renderChart({ ...weeklyAxis, tickLabel: { format: '%b %d' } }, dateRows(dates));
    const majors = (container: HTMLElement) => getAxisLabels(container).filter((label) => label.includes(' '));
    expect(majors(withMinors.container)).toEqual(majors(withoutMinors.container));
    expect(getAxisLabels(withoutMinors.container)).toEqual(['Jun 03', 'Jun 09', 'Jun 15']);
    withMinors.chart.destroy();
    withoutMinors.chart.destroy();
  });

  it('formats a number axis\'s minor ticks with a number format', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((label) => ({ label, value: 1 + (label % 3) }));
    const { container, chart } = renderChart({ type: 'number', scale: 'ordinal', tickLabel: { minorFormat: '.1f' }, tickStep: { count: 5 } }, rows);
    expect(getAxisLabels(container)).toEqual(['1', '2.0', '3.0', '4.0', '5.0', '6', '7.0', '8.0', '9.0', '10.0']);
    chart.destroy();
  });

  it('marks the minor tick labels, tick marks and grid lines with the minor classes', () => {
    const { container, chart } = renderChart({ ...weeklyAxis, tickMark: { visible: true }, gridLine: { visible: true } }, dateRows(dates));
    const count = (selector: string) => container.querySelectorAll(selector).length;
    // 12 categories, 3 of them the rule's ticks, plus the hidden single-tick fallback the axis keeps
    expect(count(categoryTickLabels + minorLabel)).toBe(9);
    expect(count(categoryTickLabels)).toBe(13);
    expect(count(categoryTickMarks + minorMark)).toBe(9);
    expect(count(categoryTickMarks)).toBe(13);
    expect(count(categoryGridLines + minorGridLine)).toBe(9);
    expect(count(categoryGridLines)).toBe(13);
    chart.destroy();
  });

  it('draws the minor labels in the minor font and text style, leaving the other labels alone', () => {
    const minorAxis = { ...weeklyAxis, tickLabel: { ...weeklyAxis.tickLabel, minorFont: { size: '0.85em' }, minorTextStyle: { normal: { fillOpacity: 0.6 }, defocused: { fillOpacity: 0.3 } } } };
    const { container, chart } = renderChart(minorAxis, dateRows(dates));
    const minorText = container.querySelector<SVGTextElement>(categoryTickLabels + minorLabel + ' text')!;
    const majorText = container.querySelector<SVGTextElement>(categoryTickLabels + ':not(' + minorLabel + ') text')!;
    expect(minorText.style.fontSize).toBe('0.85em');
    expect(minorText.getAttribute('fill-opacity')).toBe('0.6');
    expect(majorText.style.fontSize).toBe('');
    expect(majorText.getAttribute('fill-opacity')).toBe('1');
    chart.destroy();
  });

  it('draws no minor tick marks or grid lines while nothing asks for minor ticks, and draws them when minorVisible says so', () => {
    const stepOnly = { type: 'date', scale: 'ordinal', tickLabel: { format: '%b %d' }, tickStep: { period: 'week' }, tickMark: { visible: true }, gridLine: { visible: true } };
    const quiet = renderChart(stepOnly, dateRows(dates));
    expect(quiet.container.querySelectorAll(categoryTickMarks + minorMark).length).toBe(0);
    expect(quiet.container.querySelectorAll(categoryGridLines + minorGridLine).length).toBe(0);
    expect(quiet.container.querySelectorAll(categoryTickLabels + minorLabel).length).toBe(0);
    quiet.chart.destroy();
    const marked = renderChart({ ...stepOnly, tickMark: { visible: true, minorVisible: true }, gridLine: { visible: true, minorVisible: true } }, dateRows(dates));
    expect(marked.container.querySelectorAll(categoryTickMarks + minorMark).length).toBe(9);
    expect(Array.from(marked.container.querySelectorAll(categoryTickMarks + minorMark + ' line')).filter(isShown).length).toBe(9);
    expect(marked.container.querySelectorAll(categoryGridLines + minorGridLine).length).toBe(9);
    expect(marked.container.querySelectorAll(categoryTickLabels + minorLabel).length).toBe(0);
    marked.chart.destroy();
  });

  it('draws no labels and thins nothing when tickLabel.visible is false', () => {
    const rows = dateRows(weekdays('2026-06-01', 26 * 7));
    const { container, chart } = renderChart({ type: 'date', scale: 'ordinal', tickLabel: { visible: false }, tickStep: { period: 'week' }, tickMark: { visible: true } }, rows, 300);
    expect(container.querySelectorAll(categoryTickLabels).length).toBe(0);
    // every Monday keeps its tick mark: 26 weeks, none thinned to make room for labels that are not drawn
    expect(Array.from(container.querySelectorAll(categoryTickMarks + ':not(' + minorMark + ') line')).filter(isShown).length).toBe(26);
    chart.destroy();
  });

  it('hides the minor ticks of a part whose visible is false, whatever its minorVisible says', () => {
    const { container, chart } = renderChart({ type: 'date', scale: 'ordinal', tickStep: { period: 'week' },
      tickLabel: { visible: false, minorVisible: true }, tickMark: { visible: false, minorVisible: true }, gridLine: { visible: false, minorVisible: true } }, dateRows(dates));
    expect(container.querySelectorAll(categoryTickLabels).length).toBe(0);
    expect(container.querySelectorAll(categoryTickMarks).length).toBe(0);
    expect(container.querySelectorAll(categoryGridLines).length).toBe(0);
    chart.destroy();
  });

  it('adds no minor class without a tick step', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickMark: { visible: true } }, letterRows);
    expect(container.querySelectorAll(minorLabel).length).toBe(0);
    expect(container.querySelectorAll(minorMark).length).toBe(0);
    chart.destroy();
  });

  it('rejects a minor format on a string axis but accepts one on a linear axis', () => {
    const { enhanceConfig } = mochart;
    const stringAxis = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', tickLabel: { minorFormat: '%a' }, tickStep: { count: 2 } },
      series: [{ property: 'value' }]
    });
    expect(stringAxis.validation.errors.join('\n')).toMatch(/tickLabel\.minorFormat/);
    const linearAxis = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'date', scale: 'linear', tickLabel: { minorFormat: '%a' }, tickStep: { period: 'week', minorPeriod: 'day' } },
      series: [{ property: 'value' }]
    });
    expect(linearAxis.validation.errors).toEqual([]);
  });
});

describe('explicit minor ticks', () => {
  it('draws a ticks entry marked minor with the minor settings', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal', tickLabel: { minorFont: { size: '0.85em' } }, ticks: [{ value: 'a' }, { value: 'b', minor: true }, { value: 'c' }] }, letterRows);
    expect(getKindLabels(container, categoryTickLabels, false)).toEqual(['a', 'c']);
    expect(getKindLabels(container, categoryTickLabels, true)).toEqual(['b']);
    expect(container.querySelector<SVGTextElement>(categoryTickLabels + minorLabel + ' text')!.style.fontSize).toBe('0.85em');
    chart.destroy();
  });

  it('rejects two entries naming the same category', () => {
    const { enhanceConfig } = mochart;
    const errors = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'date', scale: 'ordinal', ticks: [{ value: '2026-06-01' }, { value: new Date('2026-06-01').getTime(), minor: true }] },
      valueAxes: [{ ticks: [{ value: 1 }, { value: 2 }, { value: 1, minor: true }] }],
      series: [{ property: 'value' }]
    }).validation.errors.join('\n');
    expect(errors).toMatch(/categoryAxis - ticks\[1\]\.value - should not repeat the value of another ticks entry/);
    expect(errors).toMatch(/valueAxes\[0\] - ticks\[2\]\.value - should not repeat/);
  });

  it('rejects the string and number forms of one key on a keyed ordinal axis, as the chart matches them to one category', () => {
    const { enhanceConfig } = mochart;
    const errors = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', keyProperty: 'id', type: 'string', scale: 'ordinal', ticks: [{ value: 1 }, { value: '1', minor: true }] },
      valueAxes: [{}],
      series: [{ property: 'value' }]
    }).validation.errors.join('\n');
    expect(errors).toMatch(/categoryAxis - ticks\[1\]\.value - should not repeat the value of another ticks entry/);
  });
});

describe('tick step on linear axes', () => {
  const numberRows = [{ label: 0, value: 1 }, { label: 40, value: 2 }];

  it('places ticks on the multiples of an interval, keeps every count-th, and splits each interval into minor steps', () => {
    const { container, chart } = renderChart({ type: 'number', scale: 'linear', min: 0, max: 40, tickLabel: { minorFormat: 'auto' }, tickStep: { interval: 10, count: 2, minorSteps: 5 } }, numberRows);
    expect(getKindLabels(container, categoryTickLabels, false)).toEqual(['0', '20', '40']);
    // the steps count skips get a minor tick only where an even step falls: 10 and 30 are minor, 20 is not
    expect(getKindLabels(container, categoryTickLabels, true)).toEqual(['2', '4', '6', '8', '10', '12', '14', '16', '18', '22', '24', '26', '28', '30', '32', '34', '36', '38']);
    chart.destroy();
  });

  it('places value axis ticks the same way', () => {
    const { container, chart } = renderChart({ type: 'string', scale: 'ordinal' }, letterRows, 1200, { min: 0, max: 40, tickLabel: { minorFormat: 'auto' }, tickStep: { interval: 10, minorSteps: 5 } }, 800);
    expect(getKindLabels(container, valueTickLabels, false)).toEqual(['0', '10', '20', '30', '40']);
    expect(getKindLabels(container, valueTickLabels, true)).toEqual(['2', '4', '6', '8', '12', '14', '16', '18', '22', '24', '26', '28', '32', '34', '36', '38']);
    chart.destroy();
  });

  it('hides a minor period tick closer to a period tick than a whole minor period', () => {
    const rows = [{ label: '2026-06-01', value: 1 }, { label: '2026-08-31', value: 2 }];
    const { container, chart } = renderChart({ type: 'date', scale: 'linear', tickLabel: { format: '%b', minorFormat: '%b %d' }, tickStep: { period: 'month', minorPeriod: 'week' } }, rows, 2400);
    expect(getKindLabels(container, categoryTickLabels, false)).toEqual(['Jul', 'Aug']);
    const minors = getKindLabels(container, categoryTickLabels, true);
    // the Mondays a few days after the 1st of July and August are hidden, the rest of the Mondays show
    expect(minors).toContain('Jun 08');
    expect(minors).toContain('Jul 13');
    expect(minors).not.toContain('Jul 06');
    expect(minors).not.toContain('Aug 03');
    chart.destroy();
  });

  it('creates no minor ticks, then no ticks, when they would be closer than minSpacing, warning once each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // about 60px between the ticks and 12px between the minor ticks along a 300px chart
      const minorsOnly = renderChart({ type: 'number', scale: 'linear', min: 0, max: 40, tickLabel: { minorFormat: 'auto' }, tickStep: { interval: 10, minorSteps: 5, minSpacing: 30 } }, numberRows, 300);
      const majors = getKindLabels(minorsOnly.container, categoryTickLabels, false);
      expect(majors).toEqual(expect.arrayContaining(['10', '20', '30']));
      expect(majors).not.toContain('5');
      expect(minorsOnly.container.querySelectorAll(categoryTickLabels + minorLabel).length).toBe(0);
      minorsOnly.chart.destroy();
      const none = renderChart({ type: 'number', scale: 'linear', min: 0, max: 40, tickLabel: { minorFormat: 'auto' }, tickStep: { interval: 1, minorSteps: 5 } }, numberRows, 60);
      expect(none.container.querySelectorAll(categoryTickLabels + minorLabel).length).toBe(0);
      none.chart.destroy();
      const messages = warn.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('tickStep'));
      expect(messages).toEqual([
        'mochart categoryAxis tickStep creates no minor ticks: they would be closer together than minSpacing (30px)',
        'mochart categoryAxis tickStep creates no ticks: they would be closer together than minSpacing (2px)'
      ]);
    }
    finally {
      warn.mockRestore();
    }
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
  it('rejects includeFirst on a linear axis, a count or offset there without a period or interval, and a period on a non-date axis', () => {
    const { enhanceConfig } = mochart;
    const linear = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'number', scale: 'linear', tickStep: { count: 2, offset: 1, includeFirst: true }, thresholdStep: { count: 2, offset: 1 } },
      series: [{ property: 'value' }]
    });
    expect(linear.validation.errors.filter((error) => error.includes('tickStep'))).toHaveLength(3);
    expect(linear.validation.errors.filter((error) => error.includes('thresholdStep'))).toHaveLength(2);
    expect(linear.validation.errors.join('\n')).toMatch(/tickStep\.count - should be left at its default on a linear axis unless period or interval is set/);
    const placed = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'number', scale: 'linear', tickStep: { interval: 10, count: 2, offset: 1 }, thresholdStep: { interval: 10, count: 2, offset: 1 } },
      series: [{ property: 'value' }]
    });
    expect(placed.validation.errors).toEqual([]);
    const stringUnit = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', tickStep: { period: 'week' } },
      series: [{ property: 'value' }]
    });
    expect(stringUnit.validation.errors.join('\n')).toMatch(/tickStep\.period/);
  });
});

describe('minor tick step validation', () => {
  it('needs a period for minorPeriod, a shorter one than period, an interval for minorSteps, and a linear axis for either', () => {
    const { enhanceConfig } = mochart;
    const errors = (tickStep: Record<string, unknown>, scale: 'linear' | 'ordinal' = 'linear') => enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'date', scale, tickStep },
      series: [{ property: 'value' }]
    }).validation.errors.join('\n');
    expect(errors({ minorPeriod: 'day' })).toMatch(/tickStep\.minorPeriod - should be null unless period is set/);
    expect(errors({ period: 'week', minorPeriod: 'month' })).toMatch(/tickStep\.minorPeriod - should be a shorter period than period/);
    expect(errors({ period: 'week', minorPeriod: 'week' })).toMatch(/tickStep\.minorPeriod - should be a shorter period than period/);
    expect(errors({ period: 'week', minorPeriod: 'day' }, 'ordinal')).toMatch(/tickStep\.minorPeriod/);
    expect(enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'number', scale: 'linear', tickStep: { minorSteps: 5 } },
      valueAxes: [{ tickStep: { minorSteps: 1 } }],
      series: [{ property: 'value' }]
    }).validation.errors.join('\n')).toMatch(/categoryAxis - tickStep\.minorSteps - should be null unless interval is set[\s\S]*valueAxes\[0\] - tickStep\.minorSteps/);
  });
});
