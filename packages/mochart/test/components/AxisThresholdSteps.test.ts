// thresholdStep: threshold lines or ranges repeated by rule, from ordinal categories, date periods or
// value intervals, stepped by count and offset, clipped to the plot, and capped
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import { getSteppedThresholds, THRESHOLD_STEP_SHAPE_CAP } from '../../src/data/ThresholdSteps';
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
  return { visible: false, period: null, interval: null, count: 1, offset: 0, range: true, front: false, style: getThresholdEntryDefaults().style as CategoryAxisThresholdStepConfig['style'], pattern: null, gradient: null, ...overrides };
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

  it('draws nothing while not visible', () => {
    const container = mount({ categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', thresholdStep: { count: 2 } } }, letters);
    expect(rects(container)).toHaveLength(0);
  });
});

describe('threshold steps on linear scales', () => {
  it('bands alternate weeks between period boundaries on a linear date axis, starting from the period under way', () => {
    const rows = [{ day: '2026-06-03', value: 1 }, { day: '2026-06-10', value: 2 }, { day: '2026-06-24', value: 3 }];
    const stepped = getSteppedThresholds({ scale: 'linear', type: 'date', dateUTC: true, thresholdStep: step({ visible: true, period: 'week', count: 2 }) },
      [new Date('2026-06-03'), new Date('2026-06-24')], null);
    expect(stepped.map((threshold) => [new Date(threshold.value).toISOString().slice(0, 10), new Date(threshold.rangeValue!).toISOString().slice(0, 10)]))
      .toEqual([['2026-06-01', '2026-06-08'], ['2026-06-15', '2026-06-22']]);
    const container = mount({ categoryAxis: { property: 'day', type: 'date', scale: 'linear', thresholdStep: { visible: true, period: 'week', count: 2, style: stepStyle } } }, rows);
    expect(rects(container)).toHaveLength(2);
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
  });

  it('caps the shapes one rule draws', () => {
    const stepped = getSteppedThresholds({ scale: 'linear', type: 'number', thresholdStep: step({ visible: true, interval: 1 }) }, [0, 10000], null);
    expect(stepped).toHaveLength(THRESHOLD_STEP_SHAPE_CAP);
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
});
