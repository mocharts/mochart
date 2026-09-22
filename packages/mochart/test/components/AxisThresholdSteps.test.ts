// thresholdStep: threshold lines or ranges repeated by rule, from ordinal categories, date periods or
// value intervals, stepped by count and offset, clipped to the plot, and kept minSpacing apart
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { getSteppedThresholds } from '../../src/data/ThresholdSteps';
import { getStepCandidates } from '../../src/data/Steps';
import { getThresholdEntryDefaults } from '../../src/config/defaults/axisConfig';
import { enhanceConfig } from '../../src';
import type { CategoryAxisThresholdStepConfig } from '../../src/types/config';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

function mount(overrides: Record<string, unknown>, data: readonly unknown[]): Element {
  const container = mountContainer();
  const config = {
    version: '1.0.0',
    animation: { enabled: false },
    series: [{ property: 'value', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

function rects(container: Element, axisKey: 'categoryAxisThreshold' | 'valueAxisThreshold' = 'categoryAxisThreshold'): { x: number; y: number; width: number; height: number }[] {
  return [...container.querySelectorAll(getDescendantCssSelector(axisKey, 'axisThresholdRange'))].map((element) => ({
    x: Number(element.getAttribute('x')), y: Number(element.getAttribute('y')),
    width: Number(element.getAttribute('width')), height: Number(element.getAttribute('height'))
  }));
}

function lineCount(container: Element): number {
  return container.querySelectorAll(getCssSelector('axisThreshold') + ' line').length;
}

const letters = 'abcdefgh'.split('').map((label, index) => ({ label, value: 1 + (index % 3) }));

/** Weekdays from a start date for a number of calendar days, skipping the given ISO dates. */
function weekdays(start: string, days: number, holidays: string[] = []): { day: string; value: number }[] {
  const rows: { day: string; value: number }[] = [];
  const date = new Date(start);
  for (let i = 0; i < days; i++) {
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.includes(iso)) {
      rows.push({ day: iso, value: 1 + (rows.length % 3) });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return rows;
}

const stepStyle = { normal: { strokeOpacity: 0, fillOpacity: 0.1 } };

/** A resolved thresholdStep with the given members over the defaults, for the expansion function alone. */
function step(overrides: Partial<CategoryAxisThresholdStepConfig>): CategoryAxisThresholdStepConfig {
  return { visible: false, period: null, interval: null, count: 1, offset: 0, minSpacing: 2, range: true, front: false, style: getThresholdEntryDefaults().style as CategoryAxisThresholdStepConfig['style'], pattern: null, gradient: null, ...overrides };
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('threshold steps on an ordinal axis', () => {
  it('stripes alternate categories with count 2, each band one slot wide, tiling from the plot edge', () => {
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { visible: true, count: 2, style: stepStyle } } }, letters);
    const bands = rects(container);
    expect(bands).toHaveLength(4);
    const slot = bands[1]!.x - bands[0]!.x;
    for (const band of bands) {
      expect(band.width).toBeCloseTo(slot / 2, 5);
    }
    // the edge lines are still drawn, at the style's zero stroke opacity
    expect(lineCount(container)).toBe(8);
  });

  it('places the stepped ranges by category key on an axis with a keyProperty', () => {
    // the keys differ from the values, so a stepped threshold naming the display value would find no category
    const keyed = letters.map((row, index) => ({ ...row, k: 'k' + index }));
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', keyProperty: 'k', thresholdStep: { visible: true, count: 2, style: stepStyle } } }, keyed);
    const bands = rects(container);
    expect(bands).toHaveLength(4);
    const slot = bands[1]!.x - bands[0]!.x;
    for (const band of bands) {
      expect(band.width).toBeCloseTo(slot / 2, 5);
    }
  });

  it('draws lines instead with range false, honouring the offset', () => {
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { visible: true, count: 3, offset: 1, range: false } } }, letters);
    expect(rects(container)).toHaveLength(0);
    expect(lineCount(container)).toBe(3);
  });

  it('bands every other week on a date axis, each band running to the last trading day of its week', () => {
    // Wednesday June 3 start, Monday June 15 a holiday: the third week starts on the Tuesday
    const rows = weekdays('2026-06-03', 26, ['2026-06-15']);
    const stepped = getSteppedThresholds({ scale: 'ordinal', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'week', count: 2 }) }, [null, null], rows.map((row) => new Date(row.day)));
    expect(stepped.map((threshold) => [new Date(threshold.value).toISOString().slice(0, 10), new Date(threshold.rangeValue!).toISOString().slice(0, 10)]))
      .toEqual([['2026-06-03', '2026-06-05'], ['2026-06-16', '2026-06-19']]);
    const container = mount({ categoryAxis: { property: 'day', type: 'date', scale: 'ordinal', thresholdStep: { visible: true, period: 'week', count: 2, style: stepStyle } } }, rows);
    expect(rects(container)).toHaveLength(2);
  });

  it('starts one step per period however the categories are ordered', () => {
    // two weeks interleaved: the second category of each week is no new period
    const dates = ['2026-06-03', '2026-06-10', '2026-06-04', '2026-06-11'].map((day) => new Date(day));
    expect(getStepCandidates({ period: 'week', count: 1, offset: 0 }, dates, 'date', true)).toEqual({ candidates: [0, 1], selected: [0, 1] });
  });

  it('draws nothing while not visible', () => {
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { count: 2 } } }, letters);
    expect(rects(container)).toHaveLength(0);
  });
});

describe('threshold steps on linear scales', () => {
  it('bands alternate weeks between period boundaries on a linear date axis, the same weeks whatever the domain', () => {
    const rows = [{ day: '2026-06-03', value: 1 }, { day: '2026-06-10', value: 2 }, { day: '2026-06-24', value: 3 }];
    const weeks = (domain: [Date, Date]) => getSteppedThresholds({ scale: 'linear', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'week', count: 2 }) }, domain, null)
      .map((threshold) => [new Date(threshold.value).toISOString().slice(0, 10), new Date(threshold.rangeValue!).toISOString().slice(0, 10)]);
    // the weeks are numbered from a fixed Monday, so the week of June 8 2026 is the even one; the week under way at the domain start still counts
    expect(weeks([new Date('2026-06-03'), new Date('2026-06-24')])).toEqual([['2026-06-08', '2026-06-15'], ['2026-06-22', '2026-06-29']]);
    expect(weeks([new Date('2026-06-10'), new Date('2026-06-24')])).toEqual([['2026-06-08', '2026-06-15'], ['2026-06-22', '2026-06-29']]);
    const container = mount({ categoryAxis: { property: 'day', type: 'date', scale: 'linear', thresholdStep: { visible: true, period: 'week', count: 2, style: stepStyle } } }, rows);
    expect(rects(container)).toHaveLength(2);
  });

  it('keeps the same multiples of the interval whatever the domain, with the offset shifting them', () => {
    const multiples = (domain: [number, number], offset = 0) => getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 10, count: 2, offset }) }, domain, null)
      .map((threshold) => [threshold.value, threshold.rangeValue]);
    expect(multiples([0, 50])).toEqual([[0, 10], [20, 30], [40, 50]]);
    expect(multiples([15, 50])).toEqual([[20, 30], [40, 50]]);
    expect(multiples([-15, 30])).toEqual([[-20, -10], [0, 10], [20, 30]]);
    expect(multiples([15, 50], 1)).toEqual([[10, 20], [30, 40]]);
  });

  // Regression: the loop visited every multiple of the interval and tested each against count, so a tiny interval
  // with a large count passed the spacing guard (the kept thresholds are far apart) yet walked tens of millions of steps
  it('walks only the multiples count keeps, so a tiny interval with a large count costs no more than the thresholds drawn', () => {
    const values = getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1e-7, count: 1e7, offset: 3, range: false }) }, [0, 100], null, null, 800)
      .map((threshold) => threshold.value);
    expect(values).toHaveLength(100);
    expect(values.slice(0, 3).map((value) => Number(Number(value).toFixed(7)))).toEqual([0.0000003, 1.0000003, 2.0000003]);
  });

  it('bands multiples of the interval on a value axis and follows a domain that lets a band be clipped', () => {
    const rows = [{ label: 'a', value: 5 }, { label: 'b', value: 33 }];
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ min: 0, max: 35, thresholdStep: { visible: true, interval: 10, count: 2, style: stepStyle } }] }, rows);
    const bands = rects(container, 'valueAxisThreshold');
    // 0 to 10 and 20 to 30 in full, then 40 to 50 lies outside: two bands, the lower one full height of a 10-unit span
    expect(bands).toHaveLength(2);
    expect(bands[0]!.height).toBeCloseTo(bands[1]!.height, 5);
    const lines = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ min: 0, max: 35, thresholdStep: { visible: true, interval: 10, range: false } }] }, rows);
    expect(lineCount(lines)).toBe(4);
    // a line sits at the multiple on the domain max too, where a range would start outside the domain: 0, 10, 20, 30
    const topLines = (range: boolean) => getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 10, range }) }, [0, 30], null).map((threshold) => threshold.value);
    expect(topLines(false)).toEqual([0, 10, 20, 30]);
    expect(topLines(true)).toEqual([0, 10, 20]);
  });

  it('draws nothing when the thresholds would be closer together than minSpacing, counted before any is built', () => {
    // 10000 steps of 1 along 800 pixels: 0.08 pixels apart
    const flood = (minSpacing: number, axisLength: number, count = 1) => getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1, count, minSpacing }) }, [0, 10000], null, null, axisLength);
    expect(flood(2, 800)).toHaveLength(0);
    // 800 pixels for 100 steps is 8 pixels apart: at the default it draws, at a larger minSpacing it does not
    expect(getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1 }) }, [0, 100], null, null, 800)).toHaveLength(100);
    expect(getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1, minSpacing: 10 }) }, [0, 100], null, null, 800)).toHaveLength(0);
    // the spacing is between the thresholds that are drawn, so count 2 doubles it
    expect(getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1, count: 2, minSpacing: 10 }) }, [0, 100], null, null, 800)).toHaveLength(50);
  });

  it('counts the periods of a date rule the same way', () => {
    // 365 days along 400 pixels is about 1.1 pixels apart; weeks are about 7.7 apart
    const domain: [Date, Date] = [new Date('2026-01-01'), new Date('2027-01-01')];
    expect(getSteppedThresholds({ scale: 'linear', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'day' }) }, domain, null, null, 400)).toHaveLength(0);
    expect(getSteppedThresholds({ scale: 'linear', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'week' }) }, domain, null, null, 400).length).toBeGreaterThan(50);
    expect(getSteppedThresholds({ scale: 'linear', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'week', minSpacing: 8 }) }, domain, null, null, 400)).toHaveLength(0);
  });

  it('warns once naming the axis when a mounted rule is too dense to draw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const rows = [{ label: 'a', value: 5 }, { label: 'b', value: 33 }];
      const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
        valueAxes: [{ min: 0, max: 100000, thresholdStep: { visible: true, interval: 1, style: stepStyle } }] }, rows);
      expect(rects(container, 'valueAxisThreshold')).toHaveLength(0);
      const messages = warn.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('thresholdStep'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/value axis VA0 thresholdStep draws nothing/);
    }
    finally {
      warn.mockRestore();
    }
  });

  // Regression: the warning ran on every expansion, so every domain change (and every frame of an animated one) logged it again
  it('warns again only once the rule fits and then turns too dense again, not on every domain change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const rows = (max: number) => [{ label: 'a', value: 5 }, { label: 'b', value: max }];
      const config = { categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
        valueAxes: [{ min: 0, thresholdStep: { visible: true, interval: 1, style: stepStyle } }] };
      mount(config, rows(33));
      const handle = lastHandle();
      const messages = () => warn.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('thresholdStep'));
      expect(messages()).toHaveLength(0);
      handle.update({ data: rows(120000) });
      expect(messages()).toHaveLength(1);
      handle.update({ data: rows(130000) });
      expect(messages()).toHaveLength(1);
      handle.update({ data: rows(33) });
      handle.update({ data: rows(120000) });
      expect(messages()).toHaveLength(2);
    }
    finally {
      warn.mockRestore();
    }
  });
});

describe('threshold step validation', () => {
  it('rejects a period or interval off their scales, a non-positive interval, and unknown fill ids', () => {
    const errors = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { visible: true, period: 'week', interval: 5, pattern: 'missing' } },
      valueAxes: [{ thresholdStep: { visible: true, interval: 0, gradient: 'missing' } }],
      series: [{ property: 'value' }]
    }).validation.errors.join('\n');
    expect(errors).toMatch(/categoryAxis - thresholdStep\.period/);
    expect(errors).toMatch(/categoryAxis - thresholdStep\.interval/);
    expect(errors).toMatch(/categoryAxis - thresholdStep\.pattern - should be the id of a patterns entry/);
    expect(errors).toMatch(/valueAxes\[0\] - thresholdStep\.interval - should be a number greater than 0/);
    expect(errors).toMatch(/valueAxes\[0\] - thresholdStep\.gradient/);
  });

  it('rejects a minSpacing below 2 on a linear axis and any but 2 on an ordinal axis', () => {
    const errors = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { minSpacing: 3 } },
      valueAxes: [{ thresholdStep: { minSpacing: 1 } }],
      series: [{ property: 'value' }]
    }).validation.errors.join('\n');
    expect(errors).toMatch(/categoryAxis - thresholdStep\.minSpacing - should be equal to 2 when scale is ordinal/);
    expect(errors).toMatch(/valueAxes\[0\] - thresholdStep\.minSpacing/);
    expect(enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'x', type: 'number', scale: 'linear', thresholdStep: { minSpacing: 3 } },
      valueAxes: [{ thresholdStep: { minSpacing: 2.5 } }],
      series: [{ property: 'value' }]
    }).validation.errors).toEqual([]);
  });
});
