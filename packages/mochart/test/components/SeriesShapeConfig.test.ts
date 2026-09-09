// Three drawing switches no test or demo had ever set: series.missingValueMarkers, seriesStacks.outerCapExpand, and pie.centerOffsetXFraction.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

function mountChart(overrides: Record<string, unknown>, data: readonly unknown[]): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

/** The x of a path's opening moveTo, which is where its left edge starts. */
function pathStartX(container: Element, seriesId: string): number {
  const bar = container.querySelector(getIdCssSelector('series', seriesId) + ' ' + getCssSelector('seriesBar'));
  expect(bar).not.toBeNull();
  const d = bar!.getAttribute('d') ?? '';
  const match = /^M\s*([-\d.]+)/.exec(d);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

function markerCount(container: Element): number {
  return container.querySelectorAll(getDescendantCssSelector('seriesMarkers', 'seriesMarker')).length;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('missing value markers', () => {
  // 'base' keeps a position for the gap, so a marker there is possible but off by default
  const gapRows = [
    { month: 'Jan', sales: 10 },
    { month: 'Feb' },
    { month: 'Mar', sales: 30 }
  ];
  const lineSeries = (extra: Record<string, unknown>) => ({
    series: [{ id: 'S0', property: 'sales', renderer: 'line', missingValueMode: 'base', ...extra }]
  });

  it('skips the missing category by default', () => {
    expect(markerCount(mountChart(lineSeries({}), gapRows))).toBe(gapRows.length - 1);
  });

  it('marks the missing category when missingValueMarkers is on', () => {
    expect(markerCount(mountChart(lineSeries({ marker: { showForMissingValues: true } }), gapRows))).toBe(gapRows.length);
  });

  it('changes nothing when no value is missing', () => {
    const full = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }];

    expect(markerCount(mountChart(lineSeries({}), full))).toBe(full.length);
    expect(markerCount(mountChart(lineSeries({ marker: { showForMissingValues: true } }), full))).toBe(full.length);
  });
});

describe('stack outer cap expand', () => {
  // the top segment is far shorter than the cap radius, which is what the switch decides about
  const stackRows = [
    { month: 'Jan', base: 100, tip: 1 },
    { month: 'Feb', base: 120, tip: 1 }
  ];
  const stacked = (outerCapExpand: boolean) => ({
    seriesStacks: [{ id: 'ST', outerCap: { type: 'round', size: 20, expand: outerCapExpand } }],
    series: [
      { id: 'BASE', property: 'base', renderer: 'bar', stack: 'ST' },
      { id: 'TIP', property: 'tip', renderer: 'bar', stack: 'ST' }
    ]
  });

  it('keeps the capped segment at full category width when expanding', () => {
    const container = mountChart(stacked(true), stackRows);

    // the uncapped segment below it defines the full width, and the cap does not pull in from it
    expect(pathStartX(container, 'TIP')).toBeCloseTo(pathStartX(container, 'BASE'));
  });

  it('narrows the capped segment instead when not expanding', () => {
    const container = mountChart(stacked(false), stackRows);

    expect(pathStartX(container, 'TIP')).toBeGreaterThan(pathStartX(container, 'BASE'));
  });

  it('leaves the segments below the cap alone either way', () => {
    expect(pathStartX(mountChart(stacked(false), stackRows), 'BASE'))
      .toBeCloseTo(pathStartX(mountChart(stacked(true), stackRows), 'BASE'));
  });
});

describe('pie centre offset', () => {
  const pieRows = [
    { slice: 'A', value: 60 },
    { slice: 'B', value: 40 }
  ];
  const pie = (extra: Record<string, unknown>) => ({
    chart: { type: 'pie' },
    categoryAxis: { property: 'slice', type: 'string', scale: 'ordinal' },
    pie: { centerLabel: { text: 'Total' }, ...extra },
    series: [{ id: 'S0', property: 'value', renderer: 'bar' }]
  });

  function centre(container: Element): { x: number; y: number } {
    const group = container.querySelector(getCssSelector('pieCenter'));
    expect(group).not.toBeNull();
    const match = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(group!.getAttribute('transform') ?? '');
    expect(match).not.toBeNull();
    return { x: Number(match![1]), y: Number(match![2]) };
  }

  it('shifts the centre horizontally in proportion to the fraction', () => {
    const none = centre(mountChart(pie({}), pieRows));
    const small = centre(mountChart(pie({ centerOffsetXFraction: 0.2 }), pieRows));
    const large = centre(mountChart(pie({ centerOffsetXFraction: 0.4 }), pieRows));

    expect(small.x - none.x).toBeGreaterThan(0);
    // the offset is the fraction times the outer radius, so twice the fraction is twice the shift
    expect(large.x - none.x).toBeCloseTo(2 * (small.x - none.x));
    // and the horizontal offset leaves the vertical position alone
    expect(small.y).toBeCloseTo(none.y);
    expect(large.y).toBeCloseTo(none.y);
  });

  it('shifts the other way for a negative fraction', () => {
    const none = centre(mountChart(pie({}), pieRows));
    const left = centre(mountChart(pie({ centerOffsetXFraction: -0.2 }), pieRows));

    expect(left.x).toBeLessThan(none.x);
  });
});
