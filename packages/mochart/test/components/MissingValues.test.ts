// missingValueMode 'connect' index-mapping regressions: positions compact only for 'connect', and the compacted->raw
// remap (skipCategoryIndexMap) must track the data and feed every raw-indexed lookup (focus, colors, labels, marker sizes).
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { ChartHandle } from '../../src/createChart';
import type { ChartFocus, DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

// defaultColors from the color palette defaults
const PALETTE_1 = '#ee6677';
const PALETTE_2 = '#228833';

function makeConfig(seriesOverrides: Record<string, unknown>): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: false },
    tooltip: { visible: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', ...seriesOverrides }]
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, data: readonly unknown[], callbacks: Partial<DefaultChartProps> = {}): { container: Element; handle: ChartHandle<DefaultChartProps> } {
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT, ...callbacks
  } as DefaultChartProps));
  return { container, handle };
}

function click(target: Element): void {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('missingValueMode base', () => {
  // Positions are not compacted in this combination, so the raw-index remap
  // must be the identity, not an empty-map lookup.
  it('still renders labels, markers, error bars and value colors', () => {
    const rows = [
      { month: 'Jan', sales: 10, low: 8, high: 12 },
      { month: 'Feb' },
      { month: 'Mar', sales: 30, low: 27, high: 33 }
    ];
    const { container } = mountChart(makeConfig({
      renderer: 'bar', missingValueMode: 'base',
      labelProperty: 'sales', marker: { shape: 'circle' }, colorProperty: 'sales',
      errorLowProperty: 'low', errorHighProperty: 'high'
    }), rows);

    const labels = container.querySelectorAll(getCssSelector('seriesLabel'));
    expect(labels.length).toBe(2);
    expect([...labels].map(label => label.textContent)).toEqual(['10.00', '30.00']);
    expect(container.querySelectorAll(getCssSelector('seriesMarker')).length).toBe(2);
    expect(container.querySelectorAll(getCssSelector('seriesErrorBar')).length).toBe(2);

    const fills = [...container.querySelectorAll(getCssSelector('seriesBar'))].map(bar => bar.getAttribute('fill'));
    expect(fills.length).toBe(3);
    expect(fills.some(fill => fill !== null && fill.includes('NaN'))).toBe(false);
  });
});

describe('missingValueMode connect category-index remapping', () => {
  it('names bars by the data category index, and focuses the one named', () => {
    const focuses: ChartFocus[] = [];
    const { container, handle } = mountChart(
      makeConfig({ renderer: 'bar', missingValueMode: 'connect', focusCategoryOnClick: true }),
      [{ month: 'Jan', sales: 10 }, { month: 'Feb' }, { month: 'Mar', sales: 30 }],
      { onFocus: focus => { focuses.push(focus); } }
    );

    // Feb is missing, so its bar is absent — the suffix skips 1 rather than compacting
    expect(container.querySelector(getIdCssSelector('seriesBar', '1'))).toBeNull();
    click(container.querySelector(getIdCssSelector('seriesBar', '2'))!);
    expect(focuses[focuses.length - 1]!.focusedCategoryIndex).toBe(2);

    // now Feb is defined and Mar is missing: bar-1 exists, bar-2 does not
    handle.update({ data: [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }, { month: 'Mar' }] } as Partial<DefaultChartProps>);
    expect(container.querySelector(getIdCssSelector('seriesBar', '2'))).toBeNull();
    click(container.querySelector(getIdCssSelector('seriesBar', '1'))!);
    expect(focuses[focuses.length - 1]!.focusedCategoryIndex).toBe(1);
  });

  it('keeps categoryIndex palette colors raw-indexed across a gap', () => {
    const { container } = mountChart(makeConfig({
      renderer: 'bar', missingValueMode: 'connect',
      shapeStyle: { normal: { fillColor: 'categoryIndex' } }
    }), [{ month: 'Jan', sales: 10 }, { month: 'Feb' }, { month: 'Mar', sales: 30 }]);

    // bar-2 is raw category 2, so it takes palette slot 2, not slot 1
    const bar = container.querySelector(getIdCssSelector('seriesBar', '2'))!;
    expect(bar.getAttribute('fill')).toBe(PALETTE_2);
    expect(bar.getAttribute('fill')).not.toBe(PALETTE_1);
  });

  // Regression: shapes were keyed by the compacted index, so a category appearing earlier in the
  // series shifted every later shape's key — the retained list then handed one category's node to
  // its neighbour and tweened the geometry across, instead of leaving it alone and adding a node.
  it('keeps a category on its own node when an earlier category gains a value', () => {
    const { container, handle } = mountChart(
      makeConfig({ renderer: 'bar', missingValueMode: 'connect' }),
      [{ month: 'Jan', sales: 10 }, { month: 'Feb' }, { month: 'Mar', sales: 30 }]
    );
    const marSelector = getIdCssSelector('seriesBar', '2');
    const marBefore = container.querySelector(marSelector)!;
    const marPathBefore = marBefore.getAttribute('d');
    expect(marPathBefore).not.toBeNull();

    handle.update({ data: [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }, { month: 'Mar', sales: 30 }] } as Partial<DefaultChartProps>);

    const marAfter = container.querySelector(marSelector)!;
    expect(marAfter).toBe(marBefore);
    expect(marAfter.getAttribute('d')).toBe(marPathBefore);
    expect(container.querySelectorAll(getCssSelector('seriesBar')).length).toBe(3);
  });

  it('keeps markerProperty sizes raw-indexed when marker values have their own gaps', () => {
    const { container } = mountChart(makeConfig({
      renderer: 'line', missingValueMode: 'connect', marker: { shape: 'circle' }, markerProperty: 'size'
    }), [
      { month: 'Jan', sales: 10, size: 4 },
      { month: 'Feb', sales: 20 },
      { month: 'Mar', sales: 30, size: 8 }
    ]);

    // Feb has a value but no marker value: only its own marker is dropped
    expect(container.querySelector(getIdCssSelector('seriesMarker', '0'))).not.toBeNull();
    expect(container.querySelector(getIdCssSelector('seriesMarker', '1'))).toBeNull();
    expect(container.querySelector(getIdCssSelector('seriesMarker', '2'))).not.toBeNull();
  });
});
