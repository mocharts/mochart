// scale: 'log' drawn: ticks at the powers of 10 with minor ticks at the multiples from 2 to 9, values at or below 0 missing or cut off at the plot edge, and no NaN anywhere.
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle, barRects } from './helpers';
import { createChart, createDefaultChart } from '../../src/createChart';
import { enhanceConfig } from '../../src/config/helper/index';
import { ArrayOfObjectsDataProvider } from '../../src/data/DataProvider';
import { getDomAccessors, getCssSelector, getIdCssClass, getIdCssSelector, getCssClassMatchSelector } from '../../src/utils/ChartDom';
import type { Bounds } from '../../src/types/geometry';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 400;
const HEIGHT = 300;

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface Mounted { container: Element; bounds: Bounds }

function mount(config: Record<string, unknown>, data: readonly unknown[]): Mounted {
  const container = mountContainer();
  let bounds: Bounds | null = null;
  trackHandle(createDefaultChart(container, {
    config: { version: '1.0.0', animation: { enabled: false }, categoryAxis: { property: 'c' }, ...config } as unknown as MochartInputConfig,
    data, width: WIDTH, height: HEIGHT,
    onSeriesLayoutBoundsChange: (b) => { bounds = b; }
  } as DefaultChartProps));
  expect(bounds, 'series layout bounds never reported').not.toBeNull();
  expect(container.innerHTML).not.toContain('NaN');
  return { container, bounds: bounds! };
}

const rowsFor = (values: readonly number[], extra: (value: number, i: number) => Record<string, unknown> = () => ({})) =>
  values.map((v, i) => ({ c: 'c' + i, v, ...extra(v, i) }));

// the shown labels: the hidden ones at the domain ends only reserve room
const shown = (texts: Iterable<Element>) => Array.from(texts).filter(text => text.getAttribute('style')?.includes('hidden') !== true).map(text => text.textContent ?? '');

function majorLabels(container: Element, axisId = 'VA0'): string[] {
  return shown(getDomAccessors(container).getValueAxisMajorTicksDomElementsForId(axisId));
}

// the charts here have one value axis, and its category axis draws no minor ticks
function count(container: Element, key: 'axisMinorTickMark' | 'axisMinorGridLine'): number {
  return container.querySelectorAll(getCssSelector(key)).length;
}

describe('log value axis ticks', () => {
  const powersOfTen = { valueAxes: [{ scale: 'log', min: 1, max: 1000 }], series: [{ property: 'v' }] };

  it('ticks the powers of 10, with the other 1 to 9 multiples as minor tick marks and grid lines but no minor labels', () => {
    const { container } = mount({ ...powersOfTen, valueAxes: [{ scale: 'log', min: 1, max: 1000, tickCount: 4, gridLine: { visible: true } }] }, rowsFor([2, 30, 400]));
    expect(majorLabels(container)).toEqual(['1', '10', '100', '1k']);
    expect(count(container, 'axisMinorTickMark')).toBe(8 * 3);
    expect(count(container, 'axisMinorGridLine')).toBe(8 * 3);
    expect(getDomAccessors(container).getValueAxisMinorTicksDomElementsForId('VA0')).toHaveLength(0);
  });

  it('hides the minor grid lines along with the major ones', () => {
    const { container } = mount({ ...powersOfTen, valueAxes: [{ scale: 'log', min: 1, max: 1000, gridLine: { visible: false } }] }, rowsFor([2, 30]));
    expect(count(container, 'axisMinorGridLine')).toBe(0);
  });

  it('adds the 2 and 5 multiples when the powers are too few', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100, tickCount: 8 }], series: [{ property: 'v' }] }, rowsFor([2, 30]));
    expect(majorLabels(container)).toEqual(['1', '2', '5', '10', '20', '50', '100']);
  });

  it('keeps every second power when they do not all fit', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 0.001, max: 1e9, tickCount: 7 }], series: [{ property: 'v' }] }, rowsFor([2, 30]));
    expect(majorLabels(container)).toEqual(['10m', '1', '100', '10k', '1M', '100M']);
  });

  it('keeps the 2 and 5 multiples on a tall axis rather than falling back to linear ticks', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 10 }], series: [{ property: 'v' }] }, rowsFor([2, 8]));
    expect(majorLabels(container)).toEqual(['1', '2', '5', '10']);
    expect(count(container, 'axisMinorTickMark')).toBe(6);
  });

  it('ticks every 1 to 9 multiple when they all fit and there are too few powers', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 50, max: 80, tickCount: 7 }], series: [{ property: 'v' }] }, rowsFor([55, 70]));
    expect(majorLabels(container)).toEqual(['50', '60', '70', '80']);
    expect(count(container, 'axisMinorTickMark')).toBe(0);
  });

  it('falls back to linear ticks between two neighbouring powers of 10 when fewer than half the tick count of multiples lie there', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 50, max: 80, tickCount: 12 }], series: [{ property: 'v' }] }, rowsFor([55, 70]));
    expect(majorLabels(container)).toEqual(['50', '55', '60', '65', '70', '75', '80']);
    expect(count(container, 'axisMinorTickMark')).toBe(0);
  });

  it('drops linear fallback ticks until their gaps fit, since they sit closer towards the maximum end', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 50, max: 80, tickCount: 12, minTickSpacing: 60 }], series: [{ property: 'v' }] }, rowsFor([55, 70]));
    expect(majorLabels(container)).toEqual(['60', '80']);
  });

  it('formats each tick at its own magnitude', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 0.001, max: 1000, tickCount: 7 }], series: [{ property: 'v' }] }, rowsFor([2, 30]));
    expect(majorLabels(container)).toEqual(['1m', '10m', '100m', '1', '10', '100', '1k']);
  });

  it('labels ticks with a format that leaves its precision open at 3 significant digits, trimmed', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 1000, tickCount: 4, tickLabel: { format: 's' } }], series: [{ property: 'v' }] }, rowsFor([2, 30, 400]));
    expect(majorLabels(container)).toEqual(['1', '10', '100', '1k']);
  });

  it('labels explicit ticks by value', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', ticks: [{ value: 1 }, { value: 45 }, { value: 1000 }] }], series: [{ property: 'v' }] }, rowsFor([1, 1000]));
    expect(majorLabels(container)).toEqual(['1', '45', '1k']);
  });

  it('draws no ticks when every value is at or below 0', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = mount({ valueAxes: [{ scale: 'log' }], series: [{ property: 'v' }] }, rowsFor([0, -2]));
    expect(majorLabels(container)).toEqual([]);
  });
});

describe('log value axis positions', () => {
  const barConfig = (axis: Record<string, unknown> = {}, plot: Record<string, unknown> = {}) => ({
    plot, valueAxes: [{ scale: 'log', min: 1, max: 1000, ...axis }], series: [{ id: 'S', property: 'v', renderer: 'bar' }]
  });

  it('grows bars from the axis minimum end, by ratio', () => {
    const { container, bounds } = mount(barConfig(), rowsFor([10, 100, 1000]));
    expect(barRects(container, 'S').map(bar => bar.height / bounds.height)).toEqual([
      expect.closeTo(1 / 3, 1), expect.closeTo(2 / 3, 1), expect.closeTo(1, 1)
    ]);
  });

  it('grows bars both ways from a base above 0', () => {
    const { container, bounds } = mount(barConfig({ base: 10 }), rowsFor([1, 100]));
    const [below, above] = barRects(container, 'S');
    expect(below!.height / bounds.height).toBeCloseTo(1 / 3, 1);
    expect(above!.height / bounds.height).toBeCloseTo(1 / 3, 1);
    expect(below!.y).toBeCloseTo(above!.y + above!.height, 0);
  });

  it('reverses and inverts like a linear axis', () => {
    const reversed = mount(barConfig({ reversed: true }), rowsFor([10]));
    const [reversedBar] = barRects(reversed.container, 'S');
    expect(reversedBar!.y).toBeCloseTo(0, 0);
    expect(reversedBar!.height / reversed.bounds.height).toBeCloseTo(1 / 3, 1);
    const inverted = mount(barConfig({}, { inverted: true }), rowsFor([10]));
    expect(barRects(inverted.container, 'S')[0]!.width / inverted.bounds.width).toBeCloseTo(1 / 3, 1);
  });

  it('leaves a linear axis beside a log one linear', () => {
    const { container } = mount({
      valueAxes: [{ id: 'L', min: 0, max: 100, tickCount: 3 }, { id: 'G', scale: 'log', min: 1, max: 100, tickCount: 3 }],
      series: [{ property: 'v', axis: 'L' }, { property: 'w', axis: 'G' }]
    }, rowsFor([10, 50], v => ({ w: v })));
    expect(majorLabels(container, 'L')).toEqual(['0', '50', '100']);
    expect(majorLabels(container, 'G')).toEqual(['1', '10', '100']);
  });
});

// the warning each chart logs for its dropped values is checked in LogScaleData.test.ts
describe('values at or below 0 on a log value axis', () => {
  function linePath(container: Element): string {
    return container.querySelector(getIdCssSelector('series', 'S') + ' ' + getCssSelector('seriesLine'))!.getAttribute('d') ?? '';
  }

  it.each([
    ['break', 2],
    ['connect', 1]
  ])('draws them as missing under missingValueMode %s', (missingValueMode, segments) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = mount({ valueAxes: [{ scale: 'log' }], series: [{ id: 'S', property: 'v', missingValueMode }] }, rowsFor([5, 0, 20, 40]));
    expect(linePath(container).match(/M/g)).toHaveLength(segments);
  });

  it('puts them at the base under missingValueMode base', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, bounds } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100 }], series: [{ id: 'S', property: 'v', missingValueMode: 'base' }] },
      rowsFor([5, -1, 20]));
    const points = Array.from(linePath(container).matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)).map(point => Number(point[2]));
    expect(points).toHaveLength(3);
    expect(points[1]).toBeCloseTo(bounds.height, 0);
  });

  it('runs an error bar end at or below 0 off the minimum end and shows the clip indicator', () => {
    const { container, bounds } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100 }],
      series: [{ id: 'S', property: 'v', errorLowProperty: 'lo', errorHighProperty: 'hi' }] }, rowsFor([5, 20], v => ({ lo: v - 8, hi: v + 8 })));
    const paths = Array.from(container.querySelectorAll(getIdCssSelector('series', 'S') + ' path' + getCssClassMatchSelector(getIdCssClass('seriesErrorBar', ''))));
    const low = Number(/^M-?[\d.]+,(-?[\d.]+)V/.exec(paths[0]!.getAttribute('d')!)![1]);
    expect(low).toBeGreaterThan(bounds.height);
    expect(container.querySelector(getCssSelector('clipIndicator'))).not.toBeNull();
  });

  it('shows no clip indicator when every error bar end is above 0', () => {
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100 }],
      series: [{ id: 'S', property: 'v', errorLowProperty: 'lo', errorHighProperty: 'hi' }] }, rowsFor([5, 20], v => ({ lo: v - 1, hi: v + 1 })));
    expect(container.querySelector(getCssSelector('clipIndicator'))).toBeNull();
  });

  it('cuts off the lower end of a range at the plot edge, whichever property holds it', () => {
    const { container, bounds } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100 }],
      series: [{ id: 'S', property: 'v', rangeProperty: 'r', renderer: 'bar' }] }, rowsFor([10, 0], (_v, i) => ({ r: i === 0 ? -2 : 10 })));
    for (const bar of barRects(container, 'S')) {
      expect(Math.abs(bar.y - bounds.height / 2)).toBeLessThanOrEqual(1);
      expect(bar.y + bar.height).toBeGreaterThan(bounds.height);
    }
    expect(container.querySelector(getCssSelector('clipIndicator'))).not.toBeNull();
  });

  it('leaves out a range with both ends at or below 0', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100 }],
      series: [{ id: 'S', property: 'v', rangeProperty: 'r', renderer: 'bar' }] }, rowsFor([10, 0], (_v, i) => ({ r: i === 0 ? 20 : -1 })));
    expect(barRects(container, 'S')).toHaveLength(1);
  });

  it('fills a threshold range with one end at or below 0 from the minimum end', () => {
    const { container, bounds } = mount({ valueAxes: [{ scale: 'log', min: 1, max: 100, thresholds: [{ value: 0, rangeValue: 10 }] }],
      series: [{ property: 'v' }] }, rowsFor([5, 20]));
    const rect = container.querySelector(getCssSelector('valueAxisThreshold') + ' rect')!;
    expect(Number(rect.getAttribute('height')) / bounds.height).toBeCloseTo(1 / 2, 1);
  });
});

describe('log category axis', () => {
  function markerXs(container: Element): number[] {
    return Array.from(container.querySelectorAll(getIdCssSelector('series', 'S') + ' ' + getCssClassMatchSelector(getIdCssClass('seriesMarker', ''))))
      .map(marker => Number(/translate\((-?[\d.]+)/.exec(marker.getAttribute('transform') ?? '')![1]));
  }

  const logCategory = { property: 'x', type: 'number', scale: 'log', categoryCountPadding: 0 };

  it('spaces category values by ratio and ticks the powers of 10', () => {
    const { container, bounds } = mount({ categoryAxis: { ...logCategory, tickCount: 4 }, series: [{ id: 'S', property: 'v' }] },
      [1, 10, 100, 1000].map((x, i) => ({ x, v: i + 1 })));
    const xs = markerXs(container);
    expect(xs.map(x => x / bounds.width)).toEqual([0, expect.closeTo(1 / 3, 1), expect.closeTo(2 / 3, 1), expect.closeTo(1, 1)]);
    const labels = shown(getDomAccessors(container).getCategoryAxisMajorTicksDomElements());
    // the 1k label would spill past the axis end with no padding there, so it is hidden, as on a linear axis
    expect(labels).toEqual(['1', '10', '100']);
  });

  it('keeps half a slot at each end for evenly spaced values, as a linear axis does', () => {
    const { container, bounds } = mount({ categoryAxis: { ...logCategory, categoryCountPadding: 1 }, series: [{ id: 'S', property: 'v' }] },
      [1, 10, 100, 1000].map((x, i) => ({ x, v: i + 1 })));
    const xs = markerXs(container);
    expect(xs[0]! / bounds.width).toBeCloseTo(1 / 8, 1);
    expect(xs[3]! / bounds.width).toBeCloseTo(7 / 8, 1);
  });

  // a custom data provider skips getDataErrors, so category values at or below 0 reach drawing
  function mountProvider(rows: Record<string, number>[], categoryAxis: Record<string, unknown> = logCategory): Element {
    const mochartConfig = enhanceConfig({
      version: '1.0.0', animation: { enabled: false }, categoryAxis,
      series: [{ id: 'S', property: 'v' }]
    } as unknown as MochartInputConfig);
    const container = mountContainer();
    trackHandle(createChart(container, { mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(rows), width: WIDTH, height: HEIGHT }));
    expect(container.innerHTML).not.toContain('NaN');
    return container;
  }

  it('draws nothing at a category value at or below 0 from a custom data provider, and no NaN', () => {
    const container = mountProvider([{ x: -1, v: 1 }, { x: 10, v: 2 }, { x: 100, v: 3 }]);
    expect(markerXs(container)).toHaveLength(2);
  });

  it('draws no tick at a lone category value at or below 0, none when every value is, and a lone fitting tick at the first value above 0', () => {
    const categoryLabels = (container: Element) => shown(getDomAccessors(container).getCategoryAxisMajorTicksDomElements());
    expect(categoryLabels(mountProvider([{ x: -5, v: 1 }]))).toEqual([]);
    expect(categoryLabels(mountProvider([{ x: -5, v: 1 }, { x: 0, v: 2 }]))).toEqual([]);
    expect(categoryLabels(mountProvider([{ x: -5, v: 1 }, { x: 10, v: 2 }, { x: 100, v: 3 }], { ...logCategory, tickCount: 1 }))).toEqual(['10']);
  });
});
