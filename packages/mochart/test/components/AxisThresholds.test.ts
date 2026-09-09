// Threshold lines and their titles: title side, axis-side placement, and titleSnapToValue near the plot edges
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 50 },
  { month: 'Mar', sales: 100 }
];

const linearRows = [
  { x: 0, sales: 10 },
  { x: 50, sales: 50 },
  { x: 100, sales: 100 }
];

function mount(overrides: Record<string, unknown>, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  const config = {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

/** A vertical threshold: a value axis on an upright plot. */
function valueThreshold(threshold: Record<string, unknown>, axisExtra: Record<string, unknown> = {}): Element {
  return mount({ valueAxes: [{ min: 0, max: 100, thresholds: [threshold], ...axisExtra }] });
}

/** A horizontal threshold: a linear category axis on an upright plot. */
function categoryThreshold(threshold: Record<string, unknown>, axisExtra: Record<string, unknown> = {}): Element {
  return mount({
    categoryAxis: { property: 'x', type: 'number', scale: 'linear', min: 0, max: 100, thresholds: [threshold], ...axisExtra },
    series: [{ property: 'sales', renderer: 'line' }]
  }, linearRows);
}

function translation(element: Element | null): { x: number; y: number } {
  expect(element).not.toBeNull();
  const match = /translate\(([^,]+),([^)]+)\)/.exec(element!.getAttribute('transform') ?? '');
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

function titlePosition(container: Element): { x: number; y: number } {
  return translation(container.querySelector(getCssSelector('axisThresholdTitle')));
}

/** Plot-local translate of the threshold line's group. */
function linePosition(container: Element): { x: number; y: number } {
  return translation(container.querySelector(getCssSelector('axisThreshold') + ' line')?.parentElement ?? null);
}

/** Each upright bar as `{ top, bottom }` in the series group's coordinates. */
function bars(container: Element): { top: number; bottom: number }[] {
  return [...container.querySelectorAll(getCssSelector('series') + ' path')].map((path) => {
    const match = /^M(-?[\d.]+),(-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)/.exec(path.getAttribute('d') ?? '');
    expect(match, `unexpected bar path: ${path.getAttribute('d')}`).not.toBeNull();
    return { top: Number(match![2]), bottom: Number(match![2]) + Number(match![4]) };
  });
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('threshold lines', () => {

  it('draws a threshold behind the series when front is off', () => {
    expect(valueThreshold({ value: 50, front: false })
      .querySelector(getCssSelector('axisThreshold'))).not.toBeNull();
  });

  // the axis need not be drawn for its thresholds to be
  it('draws a threshold on a hidden axis', () => {
    const container = valueThreshold({ value: 50, title: { text: 'T' } }, { visible: false });
    expect(container.querySelector(getCssSelector('valueAxis'))).toBeNull();
    expect(container.textContent).toContain('T');
  });

  // the title is measured and laid out whether or not the axis is drawn
  it('places a titled threshold on a hidden axis like one on a visible axis', () => {
    const hidden = titlePosition(valueThreshold({ value: 50, title: { text: 'T' } }, { visible: false }));
    const shown = titlePosition(valueThreshold({ value: 50, title: { text: 'T' } }));
    expect(hidden.y).toEqual(shown.y);
    expect(hidden.x).toBeLessThan(shown.x);
    const hiddenLine = linePosition(valueThreshold({ value: 50, title: { text: 'T' } }, { visible: false }));
    expect(hidden).not.toEqual(hiddenLine);
  });

  it('draws a category axis threshold on a date axis', () => {
    const container = mount({
      categoryAxis: {
        property: 'when', type: 'date', scale: 'linear',
        thresholds: [{ value: '2024-02-01T00:00:00.000Z', title: { text: 'Launch' } }]
      },
      series: [{ property: 'sales', renderer: 'line' }]
    }, [
      { when: new Date('2024-01-01T00:00:00.000Z'), sales: 10 },
      { when: new Date('2024-03-01T00:00:00.000Z'), sales: 40 }
    ]);
    expect(container.textContent).toContain('Launch');
  });

  // a threshold is a position on a continuous scale, so an ordinal axis has nowhere to put it
  it('draws no line for a threshold on an ordinal axis', () => {
    const container = mount({
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', thresholds: [{ value: 1, title: { text: 'Cut' } }] }
    });
    expect(container.querySelector(getDescendantCssSelector('categoryAxisThreshold', 'axisThreshold'))).toBeNull();
    expect(container.textContent).not.toContain('Cut');
  });

  it('draws no line for a threshold outside the domain', () => {
    const container = valueThreshold({ value: 500, title: { text: 'Far' } });
    expect(container.querySelector(getCssSelector('axisThreshold'))).toBeNull();
    expect(container.textContent).not.toContain('Far');
  });
});

describe('threshold title placement', () => {
  it('puts a vertical title at the axis side', () => {
    const start = titlePosition(valueThreshold({ value: 50, title: { text: 'T' } }, { side: 'start' }));
    const end = titlePosition(valueThreshold({ value: 50, title: { text: 'T' } }, { side: 'end' }));
    expect(end.x).toBeGreaterThan(start.x);
  });

  it('puts a horizontal title at the axis side', () => {
    const start = titlePosition(categoryThreshold({ value: 50, title: { text: 'T' } }, { side: 'start' }));
    const end = titlePosition(categoryThreshold({ value: 50, title: { text: 'T' } }, { side: 'end' }));
    expect(end.y).toBeGreaterThan(start.y);
  });

  it('puts a vertical low title below the line and a high title above it', () => {
    const low = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: 'low' } }));
    const high = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: 'high' } }));
    expect(low.y).toBeGreaterThan(high.y);
  });

  it('puts a horizontal low title left of the line and a high title right of it', () => {
    const low = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: 'low', snapToValue: false } }));
    const high = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: 'high', snapToValue: false } }));
    expect(high.x).toBeGreaterThan(low.x);
  });
});

describe('titleSnapToValue', () => {
  // without snapping the title clamps flat against the plot edge; snapping
  // flips it to the other side of the line so it stays attached to it
  it('flips a vertical low title above a line near the plot floor', () => {
    const snapped = titlePosition(valueThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: true } }));
    const clamped = titlePosition(valueThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: false } }));
    expect(snapped.y).toBeLessThan(clamped.y);
  });

  it('flips a vertical high title below a line near the plot ceiling', () => {
    const snapped = titlePosition(valueThreshold({ value: 98, title: { text: 'T', side: 'high', snapToValue: true } }));
    const clamped = titlePosition(valueThreshold({ value: 98, title: { text: 'T', side: 'high', snapToValue: false } }));
    expect(snapped.y).toBeGreaterThan(clamped.y);
  });

  it('flips a horizontal low title right of a line near the plot start', () => {
    const snapped = titlePosition(categoryThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: true } }));
    const clamped = titlePosition(categoryThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: false } }));
    expect(snapped.x).toBeGreaterThan(clamped.x);
  });

  it('flips a horizontal high title left of a line near the plot end', () => {
    const snapped = titlePosition(categoryThreshold({ value: 99, title: { text: 'T', side: 'high', snapToValue: true } }));
    const clamped = titlePosition(categoryThreshold({ value: 99, title: { text: 'T', side: 'high', snapToValue: false } }));
    expect(snapped.x).toBeLessThan(clamped.x);
  });

  // room on its own side, so it stays there: the flip is for a title with nowhere to go
  it('leaves a horizontal high title right of a line that still has room', () => {
    const snapped = titlePosition(categoryThreshold({ value: 95, title: { text: 'T', side: 'high', snapToValue: true } }));
    const unsnapped = titlePosition(categoryThreshold({ value: 95, title: { text: 'T', side: 'high', snapToValue: false } }));
    expect(snapped).toEqual(unsnapped);
  });

  it('leaves a mid-domain vertical title where it is', () => {
    for (const titleSide of ['low', 'high'] as const) {
      const snapped = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: true } }));
      const unsnapped = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: false } }));
      expect(snapped).toEqual(unsnapped);
    }
  });

  it('leaves a mid-domain horizontal title where it is', () => {
    for (const titleSide of ['low', 'high'] as const) {
      const snapped = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: true } }));
      const unsnapped = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: false } }));
      expect(snapped).toEqual(unsnapped);
    }
  });
});

describe('threshold styling', () => {
  it('applies an explicit line and title style', () => {
    const container = valueThreshold({
      value: 50, title: {
        text: 'T',
        textStyle: {
          normal: { strokeColor: '#0000ff', strokeOpacity: 0.9, strokeWidth: 2, strokeDashArray: '1 1',
            fillColor: '#008000', fillOpacity: 0.8 }
        }
      },
      style: { normal: { strokeColor: '#ff0000', strokeOpacity: 0.5, strokeWidth: 3, strokeDashArray: '4 2' } }
    });
    const line = container.querySelector(getCssSelector('axisThreshold') + ' line')!;
    expect(line.getAttribute('stroke')).toBe('#ff0000');
    expect(line.getAttribute('stroke-dasharray')).toBe('4 2');
    const text = container.querySelector(getCssSelector('axisThresholdTitle') + ' text')!;
    expect(text.getAttribute('fill')).toBe('#008000');
    expect(text.getAttribute('stroke')).toBe('#0000ff');
  });

  it('draws the title background from titleBackgroundStyle behind the title text', () => {
    for (const [mountThreshold, vertical] of [[valueThreshold, true], [categoryThreshold, false]] as const) {
      const container = mountThreshold({
        value: 50, title: {
          text: 'Target',
          padding: { top: 1, right: 2, bottom: 3, left: 4 },
          backgroundStyle: { fillColor: '#ffff00', fillOpacity: 1, strokeColor: '#ff00ff', strokeOpacity: 1, strokeWidth: 1 }
        }
      });
      const title = container.querySelector(getCssSelector('axisThresholdTitle'))!;
      const background = title.querySelector(getCssSelector('axisThresholdTitleBackground'))!;
      expect(background).not.toBeNull();
      expect(background.tagName).toBe('rect');
      expect(background.nextElementSibling?.tagName).toBe('text');
      expect(background.getAttribute('fill')).toBe('#ffff00');
      expect(background.getAttribute('stroke')).toBe('#ff00ff');
      // the rect wraps the measured text plus its padding: taller than wide when the title runs along a horizontal line
      const width = Number(background.getAttribute('width'));
      const height = Number(background.getAttribute('height'));
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(vertical ? width > height : height > width).toBe(true);
    }
  });


  function mountOrphanAxis(visibleWhenAllFiltered: boolean): Element {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        valueAxes: [
          { id: 'VA0' },
          { id: 'VA1', min: 0, max: 100, visibleWhenAllFiltered, thresholds: [{ value: 50, title: { text: 'Orphan' } }] }
        ],
        series: [{ property: 'sales', renderer: 'bar', axis: 'VA0' }]
      } as unknown as MochartInputConfig,
      data: rows, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    return container;
  }

  // thresholds follow the axis: a series-less axis draws (and keeps its thresholds) only when visibleWhenAllFiltered
  it('keeps the thresholds of a visibleWhenAllFiltered axis no series uses', () => {
    const container = mountOrphanAxis(true);
    expect(container.querySelector(getIdCssSelector('valueAxis', 'VA1'))).not.toBeNull();
    expect(container.textContent).toContain('Orphan');
  });

  it('hides the thresholds of a value axis no series uses when visibleWhenAllFiltered is off', () => {
    const container = mountOrphanAxis(false);
    expect(container.querySelector(getIdCssSelector('valueAxis', 'VA1'))).toBeNull();
    expect(container.textContent).not.toContain('Orphan');
  });

  function mountAllFiltered(visibleWhenAllFiltered: boolean): Element {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        valueAxes: [{ id: 'VA0', min: 0, max: 100, visibleWhenAllFiltered, adjustForFiltering: false,
          thresholds: [{ value: 50, title: { text: 'Target' } }] }],
        series: [{ id: 'sales', property: 'sales', renderer: 'bar', axis: 'VA0' }]
      } as unknown as MochartInputConfig,
      data: rows, width: WIDTH, height: HEIGHT, filteredSeriesIds: { sales: true }
    } as DefaultChartProps));
    return container;
  }

  // the axis and its grid stay on screen for a visibleWhenAllFiltered axis, so its thresholds must too
  it('keeps the thresholds of a visibleWhenAllFiltered axis whose series are all filtered', () => {
    const container = mountAllFiltered(true);
    expect(container.querySelector(getCssSelector('valueAxis'))).not.toBeNull();
    expect(container.querySelector(getCssSelector('axisThreshold'))).not.toBeNull();
    expect(container.textContent).toContain('Target');
  });

  it('hides the thresholds of an all-filtered axis when visibleWhenAllFiltered is off', () => {
    const container = mountAllFiltered(false);
    expect(container.querySelector(getCssSelector('valueAxis'))).toBeNull();
    expect(container.querySelector(getCssSelector('axisThreshold'))).toBeNull();
    expect(container.textContent).not.toContain('Target');
  });
});

describe('degenerate thresholds', () => {
  // datePrimitive lets an iso string through on a numeric axis, where it is not a number
  it('draws no line for a date-string threshold on a numeric axis', () => {
    const container = valueThreshold({ value: '2024-01-01T00:00:00.000Z', title: { text: 'Wrong' } });
    expect(container.querySelector(getCssSelector('axisThreshold'))).toBeNull();
    expect(container.textContent).not.toContain('Wrong');
  });

  // a title more than half the plot deep has no room on either side of the
  // line, so snapping leaves it where the edge clamped it
  const oversizedPadding = { top: 200, right: 2, bottom: 200, left: 2 };

  it('leaves a vertical title clamped when neither side of the line has room', () => {
    for (const titleSide of ['low', 'high'] as const) {
      const threshold = { value: 50, title: { text: 'T', side: titleSide, padding: oversizedPadding } };
      const snapped = titlePosition(valueThreshold({ ...threshold, title: { ...threshold.title, snapToValue: true } }));
      const clamped = titlePosition(valueThreshold({ ...threshold, title: { ...threshold.title, snapToValue: false } }));
      // guard: the oversized padding must actually move the title, or these mounts test nothing
      expect(clamped).not.toEqual(titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: false } })));
      expect(snapped).toEqual(clamped);
    }
  });

  it('leaves a horizontal title clamped when neither side of the line has room', () => {
    for (const titleSide of ['low', 'high'] as const) {
      const threshold = { value: 50, title: { text: 'T', side: titleSide, padding: oversizedPadding } };
      const snapped = titlePosition(categoryThreshold({ ...threshold, title: { ...threshold.title, snapToValue: true } }));
      const clamped = titlePosition(categoryThreshold({ ...threshold, title: { ...threshold.title, snapToValue: false } }));
      expect(clamped).not.toEqual(titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: titleSide, snapToValue: false } })));
      expect(snapped).toEqual(clamped);
    }
  });
});

describe('inverted plots', () => {
  // inverting swaps the axes, so the value axis takes the horizontal path and
  // the category axis the vertical one
  it('places a value axis title on an inverted plot', () => {
    const container = mount({
      plot: { inverted: true },
      valueAxes: [{ min: 0, max: 100, thresholds: [{ value: 50, title: { text: 'T' } }] }]
    });
    expect(container.textContent).toContain('T');
  });

  it('places a category axis title on an inverted plot', () => {
    const container = mount({
      plot: { inverted: true },
      categoryAxis: { property: 'x', type: 'number', scale: 'linear', min: 0, max: 100,
        thresholds: [{ value: 50, title: { text: 'T' } }] },
      series: [{ property: 'sales', renderer: 'line' }]
    }, linearRows);
    expect(container.textContent).toContain('T');
  });
});

// Regression: a category threshold was placed at its raw domain fraction of the plot, but the category
// scale insets its range by half a slot, so the line never lined up with the tick or point of that value
describe('category threshold alignment', () => {
  /** x of the n-th point of the series line path, in the series group's coordinates. */
  function linePointX(container: Element, index: number): number {
    const d = container.querySelector(getCssSelector('series') + ' path')!.getAttribute('d')!;
    const points = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => Number(match[1]));
    return points[index];
  }

  it('lines a category threshold up with the data point of the same value', () => {
    for (const value of [0, 50, 100]) {
      const container = categoryThreshold({ value });
      const seriesGroup = container.querySelector(getCssSelector('series'))!.closest('g[transform]');
      const seriesOffset = translation(seriesGroup).x;
      const lineX = linePosition(container).x;
      // the threshold group is plot-relative; the series path is series-group relative
      expect(lineX - seriesOffset).toBeCloseTo(linePointX(container, [0, 50, 100].indexOf(value)), 2); // path coordinates carry 3 decimals
    }
  });
});

describe('reversed axes', () => {
  // reversing flips only the pixel direction, so a threshold at v on a reversed axis
  // lands where max + min - v lands on the normal one
  it('mirrors a value axis threshold', () => {
    const normal = linePosition(valueThreshold({ value: 25 }));
    const reversed = linePosition(valueThreshold({ value: 25 }, { reversed: true }));
    const mirrored = linePosition(valueThreshold({ value: 75 }));
    expect(reversed.y).toBeLessThan(normal.y);
    expect(reversed.y).toBeCloseTo(mirrored.y, 5);
    expect(reversed.x).toBe(normal.x);
  });

  it('mirrors a category axis threshold', () => {
    const normal = linePosition(categoryThreshold({ value: 25 }));
    const reversed = linePosition(categoryThreshold({ value: 25 }, { reversed: true }));
    const mirrored = linePosition(categoryThreshold({ value: 75 }));
    expect(reversed.x).toBeGreaterThan(normal.x);
    expect(reversed.x).toBeCloseTo(mirrored.x, 5);
    expect(reversed.y).toBe(normal.y);
  });

  // the line must sit on the data it marks: a reversed bar hangs from the ceiling, its far end at its value
  it('keeps a reversed value axis threshold level with the bar of the same value', () => {
    const container = mount({ valueAxes: [{ min: 0, max: 100, reversed: true, thresholds: [{ value: 20 }] }] },
      [{ month: 'Jan', sales: 20 }, { month: 'Feb', sales: 80 }]);
    const [jan, feb] = bars(container);
    const seriesOffset = translation(container.querySelector(getCssSelector('series')));
    expect(jan.top).toBe(feb.top);
    expect(linePosition(container).y - seriesOffset.y).toBeCloseTo(jan.bottom, 5);
  });

  it('mirrors a value axis threshold on an inverted plot', () => {
    const inverted = (threshold: Record<string, unknown>, axisExtra: Record<string, unknown> = {}) =>
      linePosition(mount({ plot: { inverted: true }, valueAxes: [{ min: 0, max: 100, thresholds: [threshold], ...axisExtra }] }));
    const normal = inverted({ value: 25 });
    const reversed = inverted({ value: 25 }, { reversed: true });
    const mirrored = inverted({ value: 75 });
    expect(reversed.x).toBeGreaterThan(normal.x);
    expect(reversed.x).toBeCloseTo(mirrored.x, 5);
    expect(reversed.y).toBe(normal.y);
  });

  it('mirrors a category axis threshold on an inverted plot', () => {
    const inverted = (threshold: Record<string, unknown>, axisExtra: Record<string, unknown> = {}) =>
      linePosition(mount({
        plot: { inverted: true },
        categoryAxis: { property: 'x', type: 'number', scale: 'linear', min: 0, max: 100, thresholds: [threshold], ...axisExtra },
        series: [{ property: 'sales', renderer: 'line' }]
      }, linearRows));
    const normal = inverted({ value: 25 });
    const reversed = inverted({ value: 25 }, { reversed: true });
    const mirrored = inverted({ value: 75 });
    expect(reversed.y).toBeGreaterThan(normal.y);
    expect(reversed.y).toBeCloseTo(mirrored.y, 5);
    expect(reversed.x).toBe(normal.x);
  });

  // snapping follows the pixel edge, not the value: a low value on a reversed axis is near the ceiling
  // on a reversed value axis the low side is above the line; a low-value line sits by the ceiling with no room there
  it('snaps a low title below a low-value line on a reversed value axis', () => {
    const snapped = titlePosition(valueThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: true } }, { reversed: true }));
    const clamped = titlePosition(valueThreshold({ value: 2, title: { text: 'T', side: 'low', snapToValue: false } }, { reversed: true }));
    expect(snapped.y).toBeGreaterThan(clamped.y);
  });
});

// Regression: titleSide picked a pixel side (low = below / left), so on a reversed value axis or an
// inverted category axis both sides landed toward the wrong values, the default 'high' included
describe('titleSide follows the value direction', () => {
  it('puts a low title toward the smaller values on a reversed value axis', () => {
    const low = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: 'low', snapToValue: false } }, { reversed: true }));
    const high = titlePosition(valueThreshold({ value: 50, title: { text: 'T', side: 'high', snapToValue: false } }, { reversed: true }));
    expect(low.y).toBeLessThan(high.y); // reversed: smaller values are up
  });

  it('puts a low title toward the smaller values on an inverted category axis', () => {
    const inverted = (titleSide: string) => titlePosition(mount({
      plot: { inverted: true },
      categoryAxis: { property: 'x', type: 'number', scale: 'linear', min: 0, max: 100, thresholds: [{ value: 50, title: { text: 'T', side: titleSide, snapToValue: false } }] },
      series: [{ property: 'sales', renderer: 'line' }]
    }, linearRows));
    expect(inverted('low').y).toBeLessThan(inverted('high').y); // inverted: categories ascend downward
  });

  it('puts a low title toward the smaller values on a reversed category axis', () => {
    const low = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: 'low', snapToValue: false } }, { reversed: true }));
    const high = titlePosition(categoryThreshold({ value: 50, title: { text: 'T', side: 'high', snapToValue: false } }, { reversed: true }));
    expect(low.x).toBeGreaterThan(high.x); // reversed: smaller values are right
  });
});
