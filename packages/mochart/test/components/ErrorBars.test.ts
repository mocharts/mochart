// errorLowProperty/errorHighProperty whiskers, centered on the bar slot (grouped sub-slots included) or line point;
// asserts parse whisker paths: `M{cx},{low}V{high}` plus one `M{x},{y}H{x2}` cap per defined bound.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle, barRects } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import type { DataObject } from '../../src/types/data';
import { getIdCssClass, getIdCssSelector, getCssClassMatchSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { label: 'A', value: 10, low: 8, high: 14 },
  { label: 'B', value: 20, low: 15, high: 24 },
  { label: 'C', value: 30, low: 28, high: 37 }
];

function mountChart(config: MochartInputConfig, data: DataObject[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

interface Whisker { center: number; low: number; high: number; caps: { at: number; from: number; to: number }[] }

/** Parse a vertical whisker path: M{cx},{low}V{high} then M{cx-h},{pos}H{cx+h} caps. */
function whiskers(container: Element, seriesId: string): Whisker[] {
  return errorBarPaths(container, seriesId).map((d) => {
    const match = /^M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)/.exec(d);
    expect(match, `unexpected whisker path: ${d}`).not.toBeNull();
    const caps = Array.from(d.matchAll(/M(-?[\d.]+),(-?[\d.]+)H(-?[\d.]+)/g))
      .map((cap) => ({ from: Number(cap[1]), at: Number(cap[2]), to: Number(cap[3]) }));
    return { center: Number(match![1]), low: Number(match![2]), high: Number(match![3]), caps };
  });
}

function errorBarPaths(container: Element, seriesId: string): string[] {
  const paths = container.querySelectorAll(getIdCssSelector('series', seriesId) + ' path' + getCssClassMatchSelector(getIdCssClass('seriesErrorBar', '')));
  return Array.from(paths).map((path) => path.getAttribute('d') ?? '');
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

function makeConfig(series: Record<string, unknown>[], overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
    series,
    ...overrides
  } as unknown as MochartInputConfig;
}

describe('error bars on bar series', () => {
  it('draws a whisker from low to high centered on each bar, with caps at both ends', () => {
    // The base-anchored reference bars put their value edge at the scaled
    // bound positions, giving an oracle for the whisker ends.
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high' },
      { id: 'RL', property: 'low', renderer: 'bar' },
      { id: 'RH', property: 'high', renderer: 'bar' }
    ]));
    const valueBars = barRects(container, 'V');
    const lowBars = barRects(container, 'RL');
    const highBars = barRects(container, 'RH');
    const valueWhiskers = whiskers(container, 'V');
    expect(valueWhiskers).toHaveLength(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const whisker = valueWhiskers[i];
      expect(whisker.center).toBeCloseTo(valueBars[i].x + valueBars[i].width / 2, 6);
      // vertical chart: the whisker's first end is the low bound (larger y)
      expect(whisker.low).toBeCloseTo(lowBars[i].y, 6);
      expect(whisker.high).toBeCloseTo(highBars[i].y, 6);
      expect(whisker.caps).toHaveLength(2);
      const [lowCap, highCap] = whisker.caps;
      expect(lowCap.at).toBeCloseTo(whisker.low, 6);
      expect(highCap.at).toBeCloseTo(whisker.high, 6);
      // default errorBarCapSize of 6, centered on the whisker
      expect(lowCap.to - lowCap.from).toBeCloseTo(6, 6);
      expect(lowCap.from).toBeCloseTo(whisker.center - 3, 6);
    }
  });

  it('expands the value axis domain to cover the error bounds', () => {
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high' }
    ]));
    const valueBars = barRects(container, 'V');
    const valueWhiskers = whiskers(container, 'V');
    // the highest bound (37 on category C) must render inside the plot: above
    // its bar's value edge yet at a non-negative plot y
    const topWhisker = valueWhiskers[2];
    expect(topWhisker.high).toBeLessThan(valueBars[2].y);
    expect(topWhisker.high).toBeGreaterThanOrEqual(0);
  });

  it('centers whiskers on grouped bar sub-slots', () => {
    const container = mountChart(makeConfig([
      { id: 'V1', property: 'value', renderer: 'bar', group: 'G', errorLowProperty: 'low', errorHighProperty: 'high' },
      { id: 'V2', property: 'high', renderer: 'bar', group: 'G', errorLowProperty: 'low', errorHighProperty: 'high' }
    ], { seriesGroups: [{ id: 'G' }] }));
    const firstBars = barRects(container, 'V1');
    const secondBars = barRects(container, 'V2');
    const firstWhiskers = whiskers(container, 'V1');
    const secondWhiskers = whiskers(container, 'V2');
    for (let i = 0; i < rows.length; i++) {
      expect(firstWhiskers[i].center).toBeCloseTo(firstBars[i].x + firstBars[i].width / 2, 6);
      expect(secondWhiskers[i].center).toBeCloseTo(secondBars[i].x + secondBars[i].width / 2, 6);
      expect(firstWhiskers[i].center).not.toBeCloseTo(secondWhiskers[i].center, 6);
    }
  });

  it('clamps the cap width to the bar layout slot', () => {
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', bar: { widthFraction: 0.02 },
        errorLowProperty: 'low', errorHighProperty: 'high', errorBar: { capSize: 500 } }
    ]));
    const valueBars = barRects(container, 'V');
    const valueWhiskers = whiskers(container, 'V');
    for (let i = 0; i < rows.length; i++) {
      const cap = valueWhiskers[i].caps[0];
      expect(cap.to - cap.from).toBeCloseTo(valueBars[i].width, 4);
    }
  });

  it('draws plain whiskers without caps when errorBarCapSize is 0', () => {
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high', errorBar: { capSize: 0 } }
    ]));
    const valueWhiskers = whiskers(container, 'V');
    expect(valueWhiskers).toHaveLength(rows.length);
    for (const whisker of valueWhiskers) {
      expect(whisker.caps).toHaveLength(0);
    }
  });
});

describe('error bars on line series', () => {
  it('centers whiskers on the point positions', () => {
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'line', errorLowProperty: 'low', errorHighProperty: 'high' }
    ]));
    const markerTransforms = Array.from(container.querySelectorAll(getIdCssSelector('series', 'V') + ' path' + getCssClassMatchSelector(getIdCssClass('seriesMarker', ''))))
      .map((marker) => /translate\((-?[\d.]+)/.exec(marker.getAttribute('transform') ?? '')![1])
      .map(Number);
    const valueWhiskers = whiskers(container, 'V');
    expect(valueWhiskers).toHaveLength(rows.length);
    for (let i = 0; i < rows.length; i++) {
      expect(valueWhiskers[i].center).toBeCloseTo(markerTransforms[i], 6);
    }
  });
});

describe('error bars on inverted charts', () => {
  it('draws horizontal whiskers with vertical caps', () => {
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high' }
    ], { plot: { inverted: true } }));
    const paths = errorBarPaths(container, 'V');
    expect(paths).toHaveLength(rows.length);
    for (const d of paths) {
      expect(d).toMatch(/^M-?[\d.]+,-?[\d.]+H-?[\d.]+/);
      expect(Array.from(d.matchAll(/M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)/g))).toHaveLength(2);
    }
  });
});

describe('missing bounds and values', () => {
  it('draws a one-sided whisker from the point to the sole defined bound', () => {
    const data = [
      { label: 'A', value: 10, low: 8 },
      { label: 'B', value: 20, low: 15, high: 24 }
    ];
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high' },
      { id: 'R', property: 'value', renderer: 'bar' }
    ]), data);
    const referenceBars = barRects(container, 'R');
    const valueWhiskers = whiskers(container, 'V');
    expect(valueWhiskers).toHaveLength(2);
    // category A: high is missing, so the whisker runs from the value position
    // down to the low bound with a single cap on the low end
    expect(valueWhiskers[0].high).toBeCloseTo(referenceBars[0].y, 6);
    expect(valueWhiskers[0].low).toBeGreaterThan(valueWhiskers[0].high);
    expect(valueWhiskers[0].caps).toHaveLength(1);
    expect(valueWhiskers[0].caps[0].at).toBeCloseTo(valueWhiskers[0].low, 6);
    expect(valueWhiskers[1].caps).toHaveLength(2);
  });

  it('skips error bars for categories with no bounds and for missing points', () => {
    const data = [
      { label: 'A', value: 10 },
      { label: 'B', low: 15, high: 24 },
      { label: 'C', value: 30, low: 28, high: 37 }
    ];
    const container = mountChart(makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', missingValueMode: 'connect', errorLowProperty: 'low', errorHighProperty: 'high' }
    ]), data);
    // A has no bounds and B has no point: only C gets an error bar, indexed
    // by its compacted position
    const paths = errorBarPaths(container, 'V');
    expect(paths).toHaveLength(1);
    const valueBars = barRects(container, 'V');
    expect(valueBars).toHaveLength(2);
    const whisker = whiskers(container, 'V')[0];
    expect(whisker.center).toBeCloseTo(valueBars[1].x + valueBars[1].width / 2, 6);
  });
});

describe('validation', () => {
  it('rejects error properties on stacked series', async () => {
    const { default: validateConfig } = await import('../../src/config/validation/mochartConfig');
    const { getDefaults } = await import('../../src/config/defaults/mochartConfig');
    const bad = makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', stack: 'S', errorLowProperty: 'low' }
    ], { seriesStacks: [{ id: 'S' }] });
    const { errors } = validateConfig(bad, getDefaults(bad as never) as never);
    expect(errors.join('\n')).toContain('errorLowProperty');
  });

  it('accepts error properties on unstacked series', async () => {
    const { default: validateConfig } = await import('../../src/config/validation/mochartConfig');
    const { getDefaults } = await import('../../src/config/defaults/mochartConfig');
    const good = makeConfig([
      { id: 'V', property: 'value', renderer: 'bar', errorLowProperty: 'low', errorHighProperty: 'high' }
    ]);
    const { errors } = validateConfig(good, getDefaults(good as never) as never);
    expect(errors).toHaveLength(0);
  });
});
