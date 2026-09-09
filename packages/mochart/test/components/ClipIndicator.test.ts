// The band marking plot edges that have data hidden behind them: an overlay that never enters the layout pass
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;

const overflowing = [{ c: 'a', v: 5 }, { c: 'b', v: 50 }];
const contained = [{ c: 'a', v: 5 }, { c: 'b', v: 8 }];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'c', type: 'string', scale: 'ordinal' },
    valueAxes: [{ min: 0, max: 10 }],
    series: [{ property: 'v', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mount(config = makeConfig(), data: readonly unknown[] = overflowing): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

interface BandInfo {
  edge: string;
  points: [number, number][];
  x: number; y: number; width: number; height: number;
  label: string | null; transform: string | null; visibility: string | null;
}

function bands(container: Element): BandInfo[] {
  return [...container.querySelectorAll(getCssSelector('clipIndicator') + ' > g')].map((group) => {
    const d = group.querySelector('path')!.getAttribute('d') ?? '';
    const points = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, px, py]) => [Number(px), Number(py)] as [number, number]);
    const xs = points.map(([px]) => px);
    const ys = points.map(([, py]) => py);
    const text = group.querySelector('text');
    return {
      edge: (group.getAttribute('class') ?? '').replace(/^.*band-/, ''),
      points,
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      label: text?.textContent ?? null,
      transform: text?.getAttribute('transform') ?? null,
      visibility: text?.getAttribute('visibility') ?? null
    };
  });
}

function byEdge(container: Element): Record<string, BandInfo | undefined> {
  return Object.fromEntries(bands(container).map((band) => [band.edge, band]));
}

function plotRect(container: Element) {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;
  return {
    x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height'))
  };
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('band presence', () => {
  it('draws a band on the clipped edge', () => {
    expect(bands(mount()).map((band) => band.edge)).toEqual(['top']);
  });

  it('draws nothing when the data fits', () => {
    expect(mount(makeConfig(), contained).querySelector(getCssSelector('clipIndicator'))).toBeNull();
  });

  it('draws nothing when the indicator is turned off', () => {
    expect(mount(makeConfig({ clipIndicator: { visible: false } })).querySelector(getCssSelector('clipIndicator'))).toBeNull();
  });

  it('draws one band per clipped edge', () => {
    const drawn = bands(mount(makeConfig(), [{ c: 'a', v: -50 }, { c: 'b', v: 50 }]));
    expect(drawn.map((band) => band.edge).sort()).toEqual(['bottom', 'top']);
  });

  it('follows the edge when the axis is reversed', () => {
    const drawn = bands(mount(makeConfig({ valueAxes: [{ min: 0, max: 10, reversed: true }] })));
    expect(drawn.map((band) => band.edge)).toEqual(['bottom']);
  });
});

describe('band geometry', () => {
  it('is a plain rectangle when no neighbouring edge clips', () => {
    const container = mount();
    const plot = plotRect(container);
    const [band] = bands(container);
    expect(band.points).toEqual([
      [plot.x, plot.y], [plot.x + plot.width, plot.y],
      [plot.x + plot.width, plot.y + band.height], [plot.x, plot.y + band.height]
    ]);
  });

  it('uses an explicit clipIndicatorSize as the depth', () => {
    expect(bands(mount(makeConfig({ clipIndicator: { size: 9 } })))[0].height).toBe(9);
  });

  it('derives an automatic depth from the measured label plus padding on both sides', () => {
    // jsdom's getBBox shim reports 0, so the measured label height is 0 and only padding remains
    expect(bands(mount(makeConfig({ clipIndicator: { labelPadding: 5 } })))[0].height).toBe(0 + 5 * 2);
  });

  it('never grows deeper than the plot itself', () => {
    const container = mount(makeConfig({ clipIndicator: { size: 10000 } }));
    expect(bands(container)[0].height).toBe(plotRect(container).height);
  });

  it('anchors a bottom band to the bottom of the plot', () => {
    const container = mount(makeConfig({ clipIndicator: { size: 8 } }), [{ c: 'a', v: -50 }, { c: 'b', v: 5 }]);
    const plot = plotRect(container);
    const [band] = bands(container);
    expect(band.edge).toBe('bottom');
    expect(band.y).toBe(plot.y + plot.height - 8);
  });
});

describe('band presentation', () => {

  it('exempts the label, so it shows no I-beam and takes no selection', () => {
    // the pointer falls through to the band behind, which still triggers the <title>
    expect(mount().querySelector(getCssSelector('clipIndicator') + ' > g text')!.getAttribute('pointer-events')).toBe('none');
    expect(mount().querySelector(getCssSelector('clipIndicator') + ' > g path')!.getAttribute('pointer-events')).toBeNull();
  });

  it('fills the band with a hatch pattern rather than a flat tint', () => {
    const container = mount();
    const pattern = container.querySelector(getCssSelector('clipIndicator') + ' pattern')!;
    const shape = container.querySelector(getCssSelector('clipIndicator') + ' > g path')!;
    expect(shape.getAttribute('fill')).toBe(`url(#${pattern.getAttribute('id')})`);
    expect(pattern.getAttribute('patternTransform')).toBe('rotate(45)');
    expect(pattern.querySelector('line')!.getAttribute('stroke')).toBe('currentColor');
  });

  it('strokes the band with a currentColor border by default', () => {
    const shape = mount().querySelector(getCssSelector('clipIndicator') + ' > g path')!;
    expect(shape.getAttribute('stroke')).toBe('currentColor');
    expect(shape.getAttribute('stroke-opacity')).toBe('0.4');
    expect(shape.getAttribute('stroke-width')).toBe('1');
  });

  it('takes its style from the config, the fill colouring the hatch', () => {
    const container = mount(makeConfig({
      clipIndicator: { style: { fillColor: '#ff0000', fillOpacity: 0.5, strokeColor: '#0000ff' } }
    }));
    expect(container.querySelector(getCssSelector('clipIndicator') + ' pattern line')!.getAttribute('stroke')).toBe('#ff0000');
    const shape = container.querySelector(getCssSelector('clipIndicator') + ' > g path')!;
    expect(shape.getAttribute('fill-opacity')).toBe('0.5');
    expect(shape.getAttribute('stroke')).toBe('#0000ff');
  });

  it('takes the hatch geometry from the config', () => {
    const pattern = mount(makeConfig({ clipIndicator: { hatch: { spacing: 10, lineWidth: 3 } } }))
      .querySelector(getCssSelector('clipIndicator') + ' pattern')!;
    expect(pattern.getAttribute('width')).toBe('10');
    expect(pattern.getAttribute('height')).toBe('10');
    const line = pattern.querySelector('line')!;
    expect(line.getAttribute('stroke-width')).toBe('3');
    // centred in the tile: a line along x=0 loses its negative half to the tile clip
    expect(line.getAttribute('x1')).toBe('5');
    expect(line.getAttribute('x2')).toBe('5');
    expect(line.getAttribute('y1')).toBe('0');
    expect(line.getAttribute('y2')).toBe('10');
  });

  it('gives each chart its own pattern id', () => {
    const idOf = (container: Element) => container.querySelector(getCssSelector('clipIndicator') + ' pattern')!.getAttribute('id');
    expect(idOf(mount())).not.toBe(idOf(mount()));
  });

  it('sits in front of the series by default, and behind when asked', () => {
    const inFront = mount();
    expect(inFront.querySelector(getCssSelector('seriesContainer'))!
      .compareDocumentPosition(inFront.querySelector(getCssSelector('clipIndicator'))!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const behind = mount(makeConfig({ clipIndicator: { front: false } }));
    expect(behind.querySelector(getCssSelector('seriesContainer'))!
      .compareDocumentPosition(behind.querySelector(getCssSelector('clipIndicator'))!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

describe('hatch off', () => {
  const noHatch = () => makeConfig({ clipIndicator: { hatch: null } });

  it('fills the band flat, with no pattern element left behind', () => {
    const container = mount(noHatch());
    expect(container.querySelector(getCssSelector('clipIndicator') + ' pattern')).toBeNull();
    expect(container.querySelector(getCssSelector('clipIndicator') + ' > g path')!.getAttribute('fill')).toBe('currentColor');
  });

  it('drops to the lighter unstroked style, so the flat band is not a slab', () => {
    // the style default is conditional on the hatch: a solid fill at the hatched weight reads far heavier
    const shape = mount(noHatch()).querySelector(getCssSelector('clipIndicator') + ' > g path')!;
    expect(shape.getAttribute('fill-opacity')).toBe('0.15');
    expect(shape.getAttribute('stroke')).toBeNull();
  });

  it('still honours an explicit style', () => {
    const shape = mount(makeConfig({ clipIndicator: { hatch: null, style: { fillColor: '#ff0000', fillOpacity: 0.6 } } }))
      .querySelector(getCssSelector('clipIndicator') + ' > g path')!;
    expect(shape.getAttribute('fill')).toBe('#ff0000');
    expect(shape.getAttribute('fill-opacity')).toBe('0.6');
  });
});

describe('degenerate hatches', () => {
  const shapeOf = (hatch: unknown) => mount(makeConfig({ clipIndicator: { hatch } }))
    .querySelector(getCssSelector('clipIndicator') + ' > g path')!;

  it('collapses to a flat fill when the lines are as thick as the gaps', () => {
    // a closed-up hatch is a solid fill, and drawn as a pattern it would seam along the 45deg tile edge
    expect(shapeOf({ spacing: 6, lineWidth: 6 }).getAttribute('fill')).toBe('currentColor');
    expect(shapeOf({ spacing: 6, lineWidth: 9 }).getAttribute('fill')).toBe('currentColor');
  });

  it('collapses to a flat fill when the spacing leaves no tile to draw', () => {
    expect(shapeOf({ spacing: 0, lineWidth: 2 }).getAttribute('fill')).toBe('currentColor');
  });

  it('paints nothing when the lines have no width', () => {
    expect(shapeOf({ spacing: 6, lineWidth: 0 }).getAttribute('fill')).toBeNull();
  });
});

describe('label', () => {
  it('renders the default label in the band, centred', () => {
    const container = mount();
    const plot = plotRect(container);
    const [band] = bands(container);
    expect(band.label).toBe('Clipped');
    expect(band.transform).toBe(`translate(${Math.floor(plot.x + plot.width / 2)},${Math.floor(plot.y + band.height / 2)})`);
    expect(band.visibility).toBeNull();
  });

  it('renders custom text', () => {
    expect(bands(mount(makeConfig({ clipIndicator: { label: 'Off the chart' } })))[0].label).toBe('Off the chart');
  });

  it('drops the label but keeps the band when set to null', () => {
    const [band] = bands(mount(makeConfig({ clipIndicator: { label: null } })));
    expect(band.label).toBeNull();
    expect(band.edge).toBe('top');
    expect(band.height).toBeGreaterThan(0);
  });

  it('rotates the label on the side bands, matching the axis title on that side', () => {
    const dateRows = [{ c: '2020-01-01', v: 5 }, { c: '2020-06-01', v: 8 }];
    const sideConfig = (extra: Record<string, unknown>) => makeConfig({
      categoryAxis: { property: 'c', type: 'date', scale: 'linear', ...extra },
      valueAxes: [{}],
      series: [{ property: 'v', renderer: 'line' }]
    });
    const right = byEdge(mount(sideConfig({ min: '2020-01-01', max: '2020-03-01' }), dateRows)).right!;
    expect(right.transform).toContain('rotate(270)');

    const left = byEdge(mount(sideConfig({ min: '2020-03-01', max: '2020-12-01' }), dateRows)).left!;
    expect(left.transform).toContain('rotate(90)');
  });

  it('takes its text style from the config', () => {
    const text = mount(makeConfig({ clipIndicator: { textStyle: { fillColor: '#00ff00', fillOpacity: 0.9 } } }))
      .querySelector(getCssSelector('clipIndicator') + ' > g text')!;
    expect(text.getAttribute('fill')).toBe('#00ff00');
    expect(text.getAttribute('fill-opacity')).toBe('0.9');
  });
});

describe('accessible name', () => {
  it('renders an svg <title> mirroring the label', () => {
    const title = mount().querySelector(getCssSelector('clipIndicator') + ' > title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Clipped');
  });

  it('tracks a custom label', () => {
    expect(mount(makeConfig({ clipIndicator: { label: 'Off the chart' } }))
      .querySelector(getCssSelector('clipIndicator') + ' > title')!.textContent).toBe('Off the chart');
  });

  it('is dropped along with the label', () => {
    expect(mount(makeConfig({ clipIndicator: { label: null } }))
      .querySelector(getCssSelector('clipIndicator') + ' > title')).toBeNull();
  });
});

describe('mitred corners', () => {
  const dateRows = [{ c: '2020-01-01', v: -50 }, { c: '2020-06-01', v: 50 }];
  const fourEdges = (clipIndicator: Record<string, unknown>) => makeConfig({
    categoryAxis: { property: 'c', type: 'date', scale: 'linear', min: '2020-02-01', max: '2020-03-01' },
    valueAxes: [{ min: 0, max: 10 }],
    clipIndicator,
    series: [{ property: 'v', renderer: 'line' }]
  });

  // the same window, left open on the right: top, bottom and left clip, right does not
  const threeEdges = (clipIndicator: Record<string, unknown>) => makeConfig({
    categoryAxis: { property: 'c', type: 'date', scale: 'linear', min: '2020-02-01', max: '2020-07-01' },
    valueAxes: [{ min: 0, max: 10 }],
    clipIndicator,
    series: [{ property: 'v', renderer: 'line' }]
  });

  it('draws all four edges, each spanning its full side of the plot', () => {
    const container = mount(fourEdges({ size: 8 }), dateRows);
    const edges = byEdge(container);
    const plot = plotRect(container);
    expect(Object.keys(edges).sort()).toEqual(['bottom', 'left', 'right', 'top']);
    // the outer edge of each band runs the whole side, so the frame has no gaps
    expect(edges.top!.width).toBe(plot.width);
    expect(edges.bottom!.width).toBe(plot.width);
    expect(edges.left!.height).toBe(plot.height);
    expect(edges.right!.height).toBe(plot.height);
  });

  it('shares a diagonal between adjacent bands, so no corner is covered twice', () => {
    const container = mount(fourEdges({ size: 8 }), dateRows);
    const edges = byEdge(container);
    const plot = plotRect(container);
    const outerTopRight: [number, number] = [plot.x + plot.width, plot.y];
    const innerTopRight: [number, number] = [plot.x + plot.width - 8, plot.y + 8];

    // both bands carry the same two corner points, so their shared edge is one diagonal
    expect(edges.top!.points).toContainEqual(outerTopRight);
    expect(edges.top!.points).toContainEqual(innerTopRight);
    expect(edges.right!.points).toContainEqual(outerTopRight);
    expect(edges.right!.points).toContainEqual(innerTopRight);
  });

  // Regression: the per-edge test read the band's label rect, which is the part left clear of the
  // perpendicular bands — empty once those two span the extent — so a band with real depth vanished
  it('keeps a band whose perpendicular neighbours leave its label no room', () => {
    // 355x255 plot: top and bottom take the 127.5 half-share each, so the left band's label rect is 0 tall
    const container = mount(threeEdges({ size: 150 }), dateRows);
    const edges = byEdge(container);
    const plot = plotRect(container);
    expect(Object.keys(edges).sort()).toEqual(['bottom', 'left', 'top']);
    // the inner corners collapse onto one point: the band is the triangle between its neighbours' diagonals
    expect(edges.left!.width).toBe(150);
    expect(edges.left!.height).toBe(plot.height);
    expect(edges.left!.points).toEqual([
      [plot.x, plot.y],
      [plot.x + 150, plot.y + plot.height / 2],
      [plot.x + 150, plot.y + plot.height / 2],
      [plot.x, plot.y + plot.height]
    ]);
    // the label keeps its run along the text's own line, where the band has not tapered (AXIS-9)
    expect(edges.left!.visibility).toBeNull();
    expect(edges.top!.visibility).toBeNull();
  });

  // Regression (AXIS-9): the label was measured against the neighbour-free rectangle, which shrinks by
  // the full depth of both perpendicular bands, though the text sits halfway into the band where they
  // have taken only half of it. A 73px label on this 255px-tall plot used to hide from size 92 up.
  describe('label room along the band', () => {
    function withMeasuredLabel<T>(width: number, height: number, body: () => T): T {
      const proto = SVGElement.prototype as unknown as Record<string, unknown>;
      const previous = { length: proto.getComputedTextLength, box: proto.getBBox };
      proto.getComputedTextLength = () => width;
      proto.getBBox = () => ({ x: 0, y: 0, width, height });
      try {
        return body();
      }
      finally {
        proto.getComputedTextLength = previous.length;
        proto.getBBox = previous.box;
      }
    }

    const leftLabelVisibility = (size: number, labelWidth: number) => withMeasuredLabel(labelWidth, 12,
      () => byEdge(mount(threeEdges({ size, label: 'more data' }), dateRows)).left!.visibility);

    it('keeps a label the perpendicular bands have not actually reached', () => {
      expect(leftLabelVisibility(100, 73)).toBeNull();
      expect(leftLabelVisibility(150, 73)).toBeNull();
    });

    it('still hides a label longer than the run it has', () => {
      expect(leftLabelVisibility(100, 400)).toBe('hidden');
    });

    // the other dimension of the same rule: nothing measured the text across the band, so an explicit
    // size below the text height drew a label that overflowed the band onto the plot
    it('hides a label deeper than the band it sits in', () => {
      const visibilities = (size: number) => withMeasuredLabel(73, 12, () => {
        const edges = byEdge(mount(threeEdges({ size, label: 'more data' }), dateRows));
        return { left: edges.left!.visibility, top: edges.top!.visibility, bottom: edges.bottom!.visibility };
      });
      // a band shallower than the 12px glyph box cannot hold the text, whichever way it runs
      expect(visibilities(8)).toEqual({ left: 'hidden', top: 'hidden', bottom: 'hidden' });
      // exactly deep enough still shows it
      expect(visibilities(12)).toEqual({ left: null, top: null, bottom: null });
    });
  });

  it('drops the indicator when no band has room', () => {
    // opposing bands are capped at half the extent they share, so a huge size leaves nothing over
    const container = mount(fourEdges({ size: 10000 }), dateRows);
    expect(container.querySelector(getCssSelector('clipIndicator'))).toBeNull();
  });
});

describe('updates', () => {
  it('appears and disappears as the data moves in and out of range', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig(), data: contained, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    expect(container.querySelector(getCssSelector('clipIndicator'))).toBeNull();

    handle.update({ config: makeConfig(), data: overflowing, width: WIDTH, height: HEIGHT } as DefaultChartProps);
    expect(bands(container).map((band) => band.edge)).toEqual(['top']);

    handle.update({ config: makeConfig(), data: contained, width: WIDTH, height: HEIGHT } as DefaultChartProps);
    expect(container.querySelector(getCssSelector('clipIndicator'))).toBeNull();
  });
});
