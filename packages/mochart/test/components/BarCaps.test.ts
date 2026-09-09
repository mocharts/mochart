// Bar cap geometry: cap selection via capType/capOnlyStackOuter/outerCapType, and the rounded cap's flat-end fallback
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', a: 10, b: 6 },
  { month: 'Feb', a: 20, b: 9 },
  { month: 'Mar', a: 30, b: 12 }
];

function mount(overrides: Record<string, unknown>, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  const config = {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'a', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

function barPaths(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('seriesBar'))].map(el => el.getAttribute('d') ?? '');
}

/** A stacked pair where the second series is the outer one. */
function stackedConfig(seriesExtra: Record<string, unknown>, stackExtra: Record<string, unknown>) {
  return {
    seriesStacks: [{ id: 'S', ...stackExtra }],
    series: [
      { id: 'inner', property: 'b', renderer: 'bar', stack: 'S', ...seriesExtra },
      { id: 'outer', property: 'a', renderer: 'bar', stack: 'S', ...seriesExtra }
    ]
  };
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('cap selection', () => {
  for (const inverted of [false, true]) {
    const plot = { plot: { inverted } };
    const orientation = inverted ? 'inverted' : 'upright';

    it(`draws no cap by default on an ${orientation} plot`, () => {
      const plain = barPaths(mount(plot));
      const capped = barPaths(mount({ ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'round' } }] }));
      expect(plain[0]).not.toBe(capped[0]);
    });

    for (const capType of ['point', 'curve', 'round'] as const) {
      it(`draws a ${capType} cap on an ${orientation} plot`, () => {
        const plain = barPaths(mount(plot));
        const capped = barPaths(mount({ ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: capType } }] }));
        expect(capped.length).toBe(rows.length);
        capped.forEach((d, i) => {
          expect(d.length).toBeGreaterThan(0);
          expect(d).not.toBe(plain[i]);
        });
      });
    }

    it(`draws a different shape for each cap type on an ${orientation} plot`, () => {
      const shapes = (['point', 'curve', 'round'] as const).map(capType =>
        barPaths(mount({ ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: capType } }] })).join('|'));
      expect(new Set(shapes).size).toBe(3);
    });

    it(`caps only the stack's outer segment when capOnlyStackOuter is set on an ${orientation} plot`, () => {
      const every = barPaths(mount({ ...plot, ...stackedConfig({ cap: { type: 'round' } }, {}) }));
      const outerOnly = barPaths(mount({
        ...plot, ...stackedConfig({ cap: { type: 'round', onlyStackOuter: true } }, {})
      }));
      expect(every.join('|')).not.toBe(outerOnly.join('|'));
    });

    it(`takes the cap from the stack's outerCapType when the series sets none on an ${orientation} plot`, () => {
      const none = barPaths(mount({ ...plot, ...stackedConfig({}, {}) }));
      const stackCapped = barPaths(mount({ ...plot, ...stackedConfig({}, { outerCap: { type: 'round', size: 6 } }) }));
      expect(none.join('|')).not.toBe(stackCapped.join('|'));
    });
  }

  // outerCapType lives on the stack config, so it reaches a series only through
  // its stack; stack: null is explicit because a sole declared stack is the default
  it('leaves a series opted out of the stack uncapped', () => {
    const plain = barPaths(mount({ series: [{ property: 'a', renderer: 'bar', stack: null }] }));
    const alsoPlain = barPaths(mount({
      seriesStacks: [{ id: 'S', outerCap: { type: 'round' } }],
      series: [{ property: 'a', renderer: 'bar', stack: null }]
    }));
    expect(plain).toEqual(alsoPlain);
  });

  it('joins the sole declared stack by default, so its outerCapType applies', () => {
    const optedOut = barPaths(mount({
      seriesStacks: [{ id: 'S', outerCap: { type: 'round' } }],
      series: [{ property: 'a', renderer: 'bar', stack: null }]
    }));
    const defaulted = barPaths(mount({ seriesStacks: [{ id: 'S', outerCap: { type: 'round' } }] }));
    expect(optedOut.join('|')).not.toBe(defaulted.join('|'));
  });
});

describe('rounded cap geometry', () => {
  for (const inverted of [false, true]) {
    const plot = { plot: { inverted } };
    const orientation = inverted ? 'inverted' : 'upright';

    // the rounding threshold is the bar's cross extent, so thin bars keep a flat (arc-free) end
    it(`falls back to a flat end for bars too thin to round on an ${orientation} plot`, () => {
      const rounded = barPaths(mount({ ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'round' } }] }));
      expect(rounded.every(d => d.includes('A'))).toBe(true);
      const flat = barPaths(mount({
        ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'round' }, bar: { widthFraction: 0.01 } }]
      }));
      expect(flat.length).toBe(rows.length);
      expect(flat.every(d => d.length > 0 && !d.includes('A'))).toBe(true);
    });

    it(`handles a cap larger than the bar's rounding radius on an ${orientation} plot`, () => {
      const paths = barPaths(mount({
        ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'round', size: 200 } }]
      }));
      expect(paths.every(d => d.length > 0)).toBe(true);
    });

    // Regression: the radius was bounded by the full slot, not the narrowed short bar, so the two arcs overlapped
    it(`keeps a short narrowed bar's arcs from overlapping on an ${orientation} plot`, () => {
      // 30 slots of ~20px; the first bar is ~7px tall and the cap narrows it, so its arcs must share the width
      const data = Array.from({ length: 30 }, (_, i) => ({ month: 'M' + i, a: i === 0 ? 14 : 1000 }));
      const paths = barPaths(mount({
        ...plot, legend: { visible: false }, categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', visible: false }, valueAxes: [{ visible: false }],
        series: [{ property: 'a', renderer: 'bar', cap: { type: 'round', size: 100, expand: false } }]
      }, data));
      const match = /A[^L]*?,([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)A/.exec(paths[0])!;
      expect(match).not.toBeNull();
      // the flat between the arcs runs forward along the bar's width, never back over the first arc
      const [arcEnd, flatEnd] = inverted ? [Number(match[2]), Number(match[4])] : [Number(match[1]), Number(match[3])];
      expect(flatEnd).toBeGreaterThanOrEqual(arcEnd - 1e-9);
    });

    it(`expands a cap wider than the bar when capExpand is off on an ${orientation} plot`, () => {
      const expanded = barPaths(mount({
        ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'point', size: 200, expand: true } }]
      }));
      const flat = barPaths(mount({
        ...plot, series: [{ property: 'a', renderer: 'bar', cap: { type: 'point', size: 200, expand: false } }]
      }));
      expect(expanded.join('|')).not.toBe(flat.join('|'));
    });
  }
});

describe('ranged line series', () => {
  for (const inverted of [false, true]) {
    it(`draws the range bound as a second line on an ${inverted ? 'inverted' : 'upright'} plot`, () => {
      const container = mount({
        plot: { inverted },
        series: [{ property: 'a', rangeProperty: 'b', renderer: 'line' }]
      });
      expect(container.querySelectorAll(getCssSelector('seriesLine')).length).toBe(2);
    });
  }
});
