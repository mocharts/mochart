// axis.reversed runs an axis in the opposite direction by reversing the scale's *range* only — bases, thresholds, tick generation and animation deltas all keep seeing an ascending domain.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;

const rows = [{ c: 'a', v: 2 }, { c: 'b', v: 8 }];

function mount(overrides: Record<string, unknown>, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: {
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
      series: [{ property: 'v', renderer: 'bar' }],
      ...overrides
    } as unknown as MochartInputConfig,
    data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

/** Each bar as `{ top, bottom }` in plot-local coordinates. */
function bars(container: Element) {
  return [...container.querySelectorAll(getCssSelector('series') + ' path')].map((path) => {
    const match = /^M(-?[\d.]+),(-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)/.exec(path.getAttribute('d') ?? '');
    expect(match, `unexpected bar path: ${path.getAttribute('d')}`).not.toBeNull();
    return { x: Number(match![1]), top: Number(match![2]), bottom: Number(match![2]) + Number(match![4]) };
  });
}

/** Vertices of the first line path, in plot-local coordinates. */
function linePoints(container: Element) {
  const path = container.querySelector(getCssSelector('series') + ' path')!;
  const d = path.getAttribute('d') ?? '';
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

/** Tick labels of an axis, each with the translate position its wrapper places it at. */
function tickLabels(container: Element, axis: 'value' | 'category') {
  const axisKey = axis === 'value' ? 'valueAxis' : 'categoryAxis';
  return [...container.querySelectorAll(getCssSelector(axisKey) + ' text')].map((text) => {
    const transform = text.parentElement!.getAttribute('transform') ?? '';
    const match = /translate\((-?[\d.]+)[ ,]\s*(-?[\d.]+)\)/.exec(transform);
    expect(match, `unexpected tick transform: ${transform}`).not.toBeNull();
    return { label: text.textContent, y: Number(match![2]) };
  });
}

/** Plot-local translate of the value axis base line. */
function baseLinePosition(container: Element) {
  const transform = container.querySelector(getCssSelector('axisBaseLine'))!.getAttribute('transform') ?? '';
  const match = /translate\((-?[\d.]+)[ ,]\s*(-?[\d.]+)\)/.exec(transform);
  expect(match, `unexpected base line transform: ${transform}`).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('value axis reversed', () => {
  it('grows bars from the top instead of the bottom', () => {
    const normal = bars(mount({ valueAxes: [{ min: 0, max: 10 }] }));
    const reversed = bars(mount({ valueAxes: [{ min: 0, max: 10, reversed: true }] }));

    // normal: bars hang down to the plot floor, the larger value starting higher
    expect(normal[0].bottom).toBe(normal[1].bottom);
    expect(normal[1].top).toBeLessThan(normal[0].top);

    // reversed: bars hang from the plot ceiling, the larger value reaching further down
    expect(reversed[0].top).toBe(reversed[1].top);
    expect(reversed[1].bottom).toBeGreaterThan(reversed[0].bottom);

    // and it is a mirror: each bar's extent is preserved, just flipped (bar edges round to
    // whole pixels, so mirroring can differ by 1)
    for (let i = 0; i < normal.length; i++) {
      const flipped = reversed[i].bottom - reversed[i].top;
      const original = normal[i].bottom - normal[i].top;
      expect(Math.abs(flipped - original), `bar ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('mirrors the tick label positions without changing the values', () => {
    const normal = tickLabels(mount({ valueAxes: [{ min: 0, max: 10 }] }), 'value');
    const reversed = tickLabels(mount({ valueAxes: [{ min: 0, max: 10, reversed: true }] }), 'value');

    // ticks are generated in ascending domain order either way; only their positions flip
    expect(normal.length).toBeGreaterThan(1);
    expect(reversed.map((tick) => tick.label)).toEqual(normal.map((tick) => tick.label));
    const byPosition = (ticks: { label: string | null; y: number }[]) =>
      [...ticks].sort((a, b) => a.y - b.y).map((tick) => tick.label);
    expect(byPosition(reversed)).toEqual(byPosition(normal).reverse());
  });

  it('keeps the base line where the bars pivot', () => {
    const mixed = [{ c: 'a', v: -2 }, { c: 'b', v: 8 }];
    const axis = { min: -5, max: 10, base: 0 };
    const normalContainer = mount({ valueAxes: [axis] }, mixed);
    const reversedContainer = mount({ valueAxes: [{ ...axis, reversed: true }] }, mixed);
    const normal = baseLinePosition(normalContainer);
    const reversed = baseLinePosition(reversedContainer);

    // base 0 sits a third of the way up the -5..10 domain: two thirds down normally, one third reversed
    expect(normal.y / reversed.y).toBeCloseTo(2, 5);

    // either way every bar has an edge on the line (bar edges round to whole pixels)
    for (const [container, position] of [[normalContainer, normal], [reversedContainer, reversed]] as const) {
      for (const bar of bars(container)) {
        expect(Math.min(Math.abs(bar.top - position.y), Math.abs(bar.bottom - position.y))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leaves an unreversed axis untouched', () => {
    const implicit = bars(mount({ valueAxes: [{ min: 0, max: 10 }] }));
    const explicit = bars(mount({ valueAxes: [{ min: 0, max: 10, reversed: false }] }));
    expect(explicit).toEqual(implicit);
  });
});

/** Series labels as `{ y, dy, anchor }` in plot-local coordinates. */
function labels(container: Element) {
  return [...container.querySelectorAll(getCssSelector('seriesLabels') + ' text')].map((text) => {
    const transform = text.getAttribute('transform') ?? '';
    const match = /translate\((-?[\d.]+)[ ,]\s*(-?[\d.]+)\)/.exec(transform);
    expect(match, `unexpected label transform: ${transform}`).not.toBeNull();
    return { x: Number(match![1]), y: Number(match![2]), dy: text.getAttribute('dy'), anchor: text.getAttribute('text-anchor') };
  });
}

describe('value axis reversed series labels', () => {
  const mixed = [{ c: 'a', v: -2 }, { c: 'b', v: 8 }];
  const series = (overrides: Record<string, unknown>) => [{ property: 'v', renderer: 'bar', labelProperty: 'v', ...overrides }];

  it('keeps outside labels outside the bar and inside labels inside', () => {
    for (const labelPosition of ['outside', 'inside'] as const) {
      const container = mount({ valueAxes: [{ min: -5, max: 10, base: 0, reversed: true }], series: series({ label: { position: labelPosition } }) }, mixed);
      const [below, above] = labels(container);
      // reversed: the positive bar grows downward, so an outside label hangs below its end and an inside one sits above it
      expect(above.dy).toBe(labelPosition === 'outside' ? '1.35em' : '-0.65em');
      expect(below.dy).toBe(labelPosition === 'outside' ? '-0.65em' : '1.35em');
    }
  });

  it('mirrors the text anchor when inverted', () => {
    const container = mount({ plot: { inverted: true }, valueAxes: [{ min: -5, max: 10, base: 0, reversed: true }], series: series({ label: { position: 'outside' } }) }, mixed);
    const [below, above] = labels(container);
    // reversed + inverted: the positive bar grows leftward, so its outside label ends at the bar end
    expect(above.anchor).toBe('end');
    expect(below.anchor).toBe('start');
  });

  it('flips the label offset with the pixel direction', () => {
    const plain = labels(mount({ valueAxes: [{ min: -5, max: 10, base: 0, reversed: true }], series: series({}) }, mixed));
    const offset = labels(mount({ valueAxes: [{ min: -5, max: 10, base: 0, reversed: true }], series: series({ label: { offset: 5 } }) }, mixed));
    // a positive offset moves labels toward the base: upward for the positive bar once reversed
    expect(offset[1].y - plain[1].y).toBe(-5);
    expect(offset[0].y - plain[0].y).toBe(5);
  });
});

describe('category axis reversed', () => {
  it('reverses the category order on an ordinal axis', () => {
    const normal = bars(mount({}));
    const reversed = bars(mount({ categoryAxis: { property: 'c', type: 'string', scale: 'ordinal', reversed: true } }));

    // same two bars, mirrored across the plot: first is now on the right
    expect(reversed[0].x).toBeGreaterThan(reversed[1].x);
    expect(normal[0].x).toBeLessThan(normal[1].x);
    // heights are unaffected — only the category positions moved
    for (let i = 0; i < normal.length; i++) {
      expect(reversed[i].bottom - reversed[i].top).toBe(normal[i].bottom - normal[i].top);
    }
  });

  it('reverses a linear date category axis', () => {
    const dates = [{ c: '2020-01-01', v: 2 }, { c: '2020-01-05', v: 8 }];
    const axis = { property: 'c', type: 'date', scale: 'linear' };
    const series = [{ property: 'v', renderer: 'line' }];
    const normal = linePoints(mount({ categoryAxis: axis, series }, dates));
    const reversed = linePoints(mount({ categoryAxis: { ...axis, reversed: true }, series }, dates));

    // the earlier date is on the left normally and on the right reversed; the values it maps to
    // are unchanged, so the y of each point simply swaps sides with it
    expect(normal[0].x).toBeLessThan(normal[1].x);
    expect(reversed[0].x).toBeGreaterThan(reversed[1].x);
    expect(reversed.map((point) => point.y)).toEqual(normal.map((point) => point.y));
  });
});

describe('reversed composes with plot.inverted', () => {
  it('mirrors the value axis in the inverted orientation too', () => {
    const normal = bars(mount({ plot: { inverted: true }, valueAxes: [{ min: 0, max: 10 }] }));
    const reversed = bars(mount({ plot: { inverted: true }, valueAxes: [{ min: 0, max: 10, reversed: true }] }));
    expect(reversed.length).toBe(normal.length);
    // inverted bars run horizontally, so the flip shows in x rather than in the vertical extent
    expect(reversed.map((bar) => bar.x)).not.toEqual(normal.map((bar) => bar.x));
  });

  it('reverses both axes at once', () => {
    const container = mount({
      categoryAxis: { property: 'c', type: 'string', scale: 'ordinal', reversed: true },
      valueAxes: [{ min: 0, max: 10, reversed: true }]
    });
    const reversed = bars(container);
    expect(reversed[0].x).toBeGreaterThan(reversed[1].x);
    expect(reversed[0].top).toBe(reversed[1].top);
  });
});

