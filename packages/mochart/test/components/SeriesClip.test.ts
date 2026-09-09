// Series are clipped to the plot so values past an explicit axis min/max cannot paint over the chrome; jsdom does not rasterize, so these assert the clip contract while the geometry deliberately still runs past the bound.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;

const rows = [{ c: 'a', v: 5 }, { c: 'b', v: 50 }];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
    series: [{ property: 'v', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mount(config = makeConfig(), data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

function plotRect(container: Element) {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;
  return {
    x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height'))
  };
}

function clipRect(container: Element) {
  const rect = container.querySelector('clipPath[id^="series__clippath__"] rect');
  return rect === null ? null : {
    x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height'))
  };
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('series clip', () => {
  it('clips the series container to the plot', () => {
    const container = mount(makeConfig({ valueAxes: [{ min: 0, max: 10 }] }));
    const seriesContainer = container.querySelector(getCssSelector('seriesContainer'))!;
    const clipPath = container.querySelector('clipPath[id^="series__clippath__"]')!;

    expect(clipPath).not.toBeNull();
    expect(seriesContainer.getAttribute('clip-path')).toBe(`url(#${clipPath.getAttribute('id')})`);
    // a bar chart draws no markers, so the clip is the plot exactly
    expect(clipRect(container)).toEqual(plotRect(container));
  });

  it('leaves the out-of-range geometry alone — clipping is a viewport operation', () => {
    const container = mount(makeConfig({ valueAxes: [{ min: 0, max: 10 }] }));
    const paths = [...container.querySelectorAll(getCssSelector('series') + ' path')];
    const tops = paths.map((path) => Number(/^M(-?[\d.]+),(-?[\d.]+)/.exec(path.getAttribute('d') ?? '')![2]));
    // the value-50 bar still starts far above the plot; the clip is what hides it
    expect(Math.min(...tops)).toBeLessThan(0);
  });

  it('gives each chart its own clip id', () => {
    const first = mount(makeConfig({ valueAxes: [{ min: 0, max: 10 }] }));
    const second = mount(makeConfig({ valueAxes: [{ min: 0, max: 10 }] }));
    const idOf = (container: Element) => container.querySelector('clipPath[id^="series__clippath__"]')!.getAttribute('id');
    expect(idOf(first)).not.toBe(idOf(second));
  });

  it('is not emitted for a pie chart, which has no axis bounds to exceed', () => {
    const container = mount(makeConfig({ chart: { type: 'pie' } }));
    expect(container.querySelector('clipPath[id^="series__clippath__"]')).toBeNull();
    expect(container.querySelector(getCssSelector('seriesContainer'))!.getAttribute('clip-path')).toBeNull();
  });
});

describe('plot.clipOverflow', () => {
  it('defaults to a clip that is exactly the plot', () => {
    const container = mount(makeConfig({
      valueAxes: [{ min: 0, max: 10 }],
      series: [{ property: 'v', renderer: 'line', marker: { shape: 'circle', size: 12 } }]
    }));
    // markers do not buy themselves room: a mark whose anchor sits on a bound is cut there
    expect(clipRect(container)).toEqual(plotRect(container));
  });

  it('widens the clip per side', () => {
    const container = mount(makeConfig({
      valueAxes: [{ min: 0, max: 10 }],
      plot: { clipOverflow: { top: 6, right: 4, bottom: 3, left: 2 } }
    }));
    const plot = plotRect(container);
    expect(clipRect(container)).toEqual({
      x: plot.x - 2,
      y: plot.y - 6,
      width: plot.width + 2 + 4,
      height: plot.height + 6 + 3
    });
  });

  it('accepts a partial object, leaving the other sides at zero', () => {
    const container = mount(makeConfig({
      valueAxes: [{ min: 0, max: 10 }],
      plot: { clipOverflow: { top: 8 } }
    }));
    const plot = plotRect(container);
    expect(clipRect(container)).toEqual({ x: plot.x, y: plot.y - 8, width: plot.width, height: plot.height + 8 });
  });
});
