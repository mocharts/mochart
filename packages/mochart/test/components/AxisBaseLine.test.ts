// Value axis base line geometry: where AxisBaseContainer/AxisBaseLine put the line for each orientation, reversed axes, domain edges and filtering.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, barRects } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { Bounds } from '../../src/types/geometry';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;

const rows = [{ c: 'a', v: -2 }, { c: 'b', v: 8 }];

// -5..10 puts base 0 a third of the way up the domain
const axis = { min: -5, max: 10, base: 0 };

interface Mounted { container: Element; bounds: Bounds }

function mount(overrides: Record<string, unknown>, props: Partial<DefaultChartProps> = {}, data: readonly unknown[] = rows): Mounted {
  const container = mountContainer();
  let bounds: Bounds | null = null;
  trackHandle(createDefaultChart(container, {
    config: {
      version: '1.0.0',
      animation: { enabled: false },
      categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
      valueAxes: [axis],
      series: [{ id: 'v', property: 'v', renderer: 'bar' }],
      ...overrides
    } as unknown as MochartInputConfig,
    data, width: WIDTH, height: HEIGHT,
    onSeriesLayoutBoundsChange: (b) => { bounds = b; },
    ...props
  } as DefaultChartProps));
  expect(bounds, 'series layout bounds never reported').not.toBeNull();
  return { container, bounds: bounds! };
}

interface BaseLine { tx: number; ty: number; x1: number; y1: number; x2: number; y2: number }

/** The base line's group translate plus its line endpoints, or null when no line is drawn. */
function baseLine(container: Element): BaseLine | null {
  const group = container.querySelector(getCssSelector('axisBaseLine'));
  if (group === null) {
    return null;
  }
  const transform = group.getAttribute('transform') ?? '';
  const match = /^translate\((-?[\d.]+),(-?[\d.]+)\)$/.exec(transform);
  expect(match, `unexpected base line transform: ${transform}`).not.toBeNull();
  const line = group.querySelector('line');
  expect(line).not.toBeNull();
  const attr = (name: string) => Number(line!.getAttribute(name));
  return { tx: Number(match![1]), ty: Number(match![2]), x1: attr('x1'), y1: attr('y1'), x2: attr('x2'), y2: attr('y2') };
}

/** Distance from `position` to the nearest bar edge along the value direction. */
function nearestBarEdgeDistance(container: Element, position: number, inverted: boolean): number {
  const rects = barRects(container, 'v');
  expect(rects.length).toBe(rows.length);
  return Math.max(...rects.map((rect) => {
    const [start, end] = inverted ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height];
    return Math.min(Math.abs(start - position), Math.abs(end - position));
  }));
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('vertical value axis', () => {
  it('spans the plot width at the base fraction of the height, measured from the bottom', () => {
    const { container, bounds } = mount({});
    const line = baseLine(container)!;
    expect(line).not.toBeNull();

    // the group translate carries the plot-local position, the line itself the plot origin and extent
    expect(line.tx).toBe(0);
    expect(line.ty).toBeCloseTo(bounds.height * 2 / 3, 6);
    expect(line.x1).toBe(bounds.x);
    expect(line.x2).toBe(bounds.x + bounds.width);
    expect(line.y1).toBe(bounds.y);
    expect(line.y2).toBe(bounds.y);
    // and the bars pivot on it (bar edges round to whole pixels)
    expect(nearestBarEdgeDistance(container, line.ty, false)).toBeLessThanOrEqual(1);
  });

  it('mirrors across the plot height when the axis is reversed', () => {
    const { container, bounds } = mount({ valueAxes: [{ ...axis, reversed: true }] });
    const line = baseLine(container)!;
    expect(line).not.toBeNull();

    expect(line.tx).toBe(0);
    expect(line.ty).toBeCloseTo(bounds.height / 3, 6);
    expect(line.x1).toBe(bounds.x);
    expect(line.x2).toBe(bounds.x + bounds.width);
    expect(nearestBarEdgeDistance(container, line.ty, false)).toBeLessThanOrEqual(1);
  });

  it('follows the base value along the domain', () => {
    const { container, bounds } = mount({ valueAxes: [{ ...axis, base: 5 }] });
    // base 5 is two thirds of the way up -5..10
    expect(baseLine(container)!.ty).toBeCloseTo(bounds.height / 3, 6);
  });
});

describe('inverted value axis', () => {
  it('spans the plot height at the base fraction of the width, measured from the left', () => {
    const { container, bounds } = mount({ plot: { inverted: true } });
    const line = baseLine(container)!;
    expect(line).not.toBeNull();

    expect(line.ty).toBe(0);
    expect(line.tx).toBeCloseTo(bounds.width / 3, 6);
    expect(line.x1).toBe(bounds.x);
    expect(line.x2).toBe(bounds.x);
    expect(line.y1).toBe(bounds.y);
    expect(line.y2).toBe(bounds.y + bounds.height);
    expect(nearestBarEdgeDistance(container, line.tx, true)).toBeLessThanOrEqual(1);
  });

  it('mirrors across the plot width when the axis is reversed', () => {
    const { container, bounds } = mount({ plot: { inverted: true }, valueAxes: [{ ...axis, reversed: true }] });
    const line = baseLine(container)!;
    expect(line).not.toBeNull();

    expect(line.ty).toBe(0);
    expect(line.tx).toBeCloseTo(bounds.width * 2 / 3, 6);
    expect(line.y1).toBe(bounds.y);
    expect(line.y2).toBe(bounds.y + bounds.height);
    expect(nearestBarEdgeDistance(container, line.tx, true)).toBeLessThanOrEqual(1);
  });
});

describe('domain edges', () => {
  it('draws no line when the base sits on a domain edge', () => {
    expect(baseLine(mount({ valueAxes: [{ ...axis, base: -5 }] }).container)).toBeNull();
    expect(baseLine(mount({ valueAxes: [{ ...axis, base: 10 }] }).container)).toBeNull();
  });

  it('draws no line when the base is outside the domain', () => {
    expect(baseLine(mount({ valueAxes: [{ ...axis, base: -20 }] }).container)).toBeNull();
    expect(baseLine(mount({ valueAxes: [{ ...axis, base: 20 }] }).container)).toBeNull();
  });

  it('draws no line for a null base', () => {
    expect(baseLine(mount({ valueAxes: [{ ...axis, base: null }] }).container)).toBeNull();
  });
});

describe('filtering', () => {
  // an unbounded axis whose lower reach comes from one series alone
  const mixed = [{ c: 'a', v: 8, w: -10, u: -2 }, { c: 'b', v: 10, w: -6, u: -1 }];
  const series = [
    { id: 'v', property: 'v', renderer: 'bar' },
    { id: 'w', property: 'w', renderer: 'bar' },
    { id: 'u', property: 'u', renderer: 'bar' }
  ];

  function filteredBaseY(adjustForFiltering: boolean, filter: boolean): number {
    const { container } = mount({ valueAxes: [{ base: 0, adjustForFiltering }], series },
      filter ? { filteredSeriesIds: { w: true } } : {}, mixed);
    const line = baseLine(container);
    expect(line).not.toBeNull();
    return line!.ty;
  }

  it('moves with the filtered domain when adjustForFiltering is on', () => {
    // dropping the most negative series raises the domain minimum, so the base drops toward the floor
    expect(filteredBaseY(true, true)).toBeGreaterThan(filteredBaseY(true, false));
  });

  it('stays on the raw domain when adjustForFiltering is off', () => {
    expect(filteredBaseY(false, true)).toBe(filteredBaseY(false, false));
  });
});
