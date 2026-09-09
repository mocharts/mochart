// Axis placement and chrome permutations: side, collapsed, visibility, tick label anchor/rotation/size, title size
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 4 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 12 }
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

const categoryAxis = (extra: Record<string, unknown>) => ({
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...extra }
});

function tickLabels(container: Element): string[] {
  return [...container.querySelectorAll(getCssSelector('axisTickLabel'))].map(el => el.textContent ?? '');
}

function categoryTickLabelTexts(container: Element): Element[] {
  return [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')];
}

function expectAnchoredAt(container: Element, anchor: string): void {
  const styles = categoryTickLabelTexts(container).map(el => el.getAttribute('style') ?? '');
  expect(styles.length).toBeGreaterThan(0);
  expect(styles.every(style => style.includes(`text-anchor: ${anchor}`))).toBe(true);
}

function plotClipHeight(container: Element): number {
  return Number(container.querySelector('clipPath[id^="series__clippath__"] rect')!.getAttribute('height'));
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('axis side and collapse', () => {
  for (const side of ['start', 'end'] as const) {
    for (const inverted of [false, true]) {
      it(`lays out a ${side}-side axis on an ${inverted ? 'inverted' : 'upright'} plot`, () => {
        const container = mount({
          ...categoryAxis({ side }),
          valueAxes: [{ side }],
          plot: { inverted }
        });
        expect(container.querySelector(getCssSelector('categoryAxis'))).not.toBeNull();
        expect(tickLabels(container).length).toBeGreaterThan(0);
      });
    }
  }

  // a collapsed axis keeps its ticks but gives its space back to the plot
  it('collapses an end-side axis', () => {
    const collapsed = mount({ ...categoryAxis({ side: 'end', collapsed: true }) });
    const normal = mount({ ...categoryAxis({ side: 'end', collapsed: false }) });
    expect(collapsed.querySelector(getCssSelector('categoryAxis'))).not.toBeNull();
    expect(collapsed.innerHTML).not.toBe(normal.innerHTML);
  });

  it('collapses a start-side axis', () => {
    expect(mount({ ...categoryAxis({ side: 'start', collapsed: true }) })
      .querySelector(getCssSelector('categoryAxis'))).not.toBeNull();
  });

  // Regression: the margin boxes were assigned inner/outer by side alone while the text followed the
  // collapsed reading order, so a collapsed axis's tick label background missed its labels
  it('keeps a collapsed axis tick label background around its labels', () => {
    const tickLabelStyle = { tickLabel: { marginInner: 0, marginOuter: 20, backgroundStyle: { fillColor: 'red', fillOpacity: 1 } } };
    const backgroundY = (container: Element) => Number(container.querySelector(getDescendantCssSelector('categoryAxis', 'axisTickLabelBackground') + ' rect')!.getAttribute('y'));
    const labelY = (container: Element) => Number(/translate\([^,]+,\s*([-\d.]+)\)/.exec(container.querySelector(getDescendantCssSelector('categoryAxis', 'axisTickLabel'))!.getAttribute('transform')!)![1]);
    const normal = mount({ ...categoryAxis({ side: 'end', collapsed: false, ...tickLabelStyle }) });
    const collapsed = mount({ ...categoryAxis({ side: 'end', collapsed: true, ...tickLabelStyle }) });
    // the label sits at the same offset into its background box whether or not the axis is collapsed
    expect(labelY(collapsed) - backgroundY(collapsed)).toBe(labelY(normal) - backgroundY(normal));
  });
});

describe('axis visibility and chrome', () => {
  it('renders no category axis when it is hidden', () => {
    expect(mount({ ...categoryAxis({ visible: false }) })
      .querySelector(getCssSelector('categoryAxis'))).toBeNull();
  });

  it('renders no value axis when it is hidden', () => {
    expect(mount({ valueAxes: [{ visible: false }] })
      .querySelector(getCssSelector('valueAxis'))).toBeNull();
  });

  it('omits tick marks when showTickMarks is off', () => {
    expect(mount({ ...categoryAxis({ tickMark: { visible: false } }) })
      .querySelector(getDescendantCssSelector('categoryAxis', 'axisTickMark'))).toBeNull();
  });

  it('omits the axis line when showAxisLine is off', () => {
    expect(mount({ ...categoryAxis({ axisLine: { visible: false } }) })
      .querySelector(getDescendantCssSelector('categoryAxis', 'axisLine'))).toBeNull();
  });

  it('drops a value axis whose series are all filtered when visibleWhenAllFiltered is off', () => {
    const container = mountContainer();
    trackHandle(createDefaultChart(container, {
      config: {
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        valueAxes: [{ id: 'VA0', visibleWhenAllFiltered: false }],
        series: [{ id: 'sales', property: 'sales', renderer: 'bar', axis: 'VA0' }]
      } as unknown as MochartInputConfig,
      data: rows, width: WIDTH, height: HEIGHT, filteredSeriesIds: { sales: true }
    } as DefaultChartProps));
    expect(container.querySelector(getCssSelector('valueAxis'))).toBeNull();
  });
});

describe('tick label anchoring and rotation', () => {
  for (const tickLabelAnchor of ['start', 'middle', 'end'] as const) {
    it(`anchors category tick labels at ${tickLabelAnchor}`, () => {
      expectAnchoredAt(mount({ ...categoryAxis({ tickLabel: { anchor: tickLabelAnchor } }) }), tickLabelAnchor);
    });

    it(`anchors tick labels at ${tickLabelAnchor} on a single-category chart`, () => {
      const container = mount({ ...categoryAxis({ tickLabel: { anchor: tickLabelAnchor } }) }, [rows[0]]);
      expectAnchoredAt(container, tickLabelAnchor);
      const visible = categoryTickLabelTexts(container)
        .filter(el => !(el.getAttribute('style') ?? '').includes('hidden'));
      expect(visible.map(el => el.textContent)).toEqual(['Jan']);
    });

    it(`anchors tick labels at ${tickLabelAnchor} on a linear axis`, () => {
      const container = mount({
        categoryAxis: { property: 'x', type: 'number', scale: 'linear', tickLabel: { anchor: tickLabelAnchor } },
        series: [{ property: 'sales', renderer: 'line' }]
      }, [{ x: 1, sales: 10 }, { x: 2, sales: 20 }]);
      expectAnchoredAt(container, tickLabelAnchor);
    });
  }

});

describe('explicit axis sizing', () => {
  // a measured size would be identical in both mounts, so the plot must shrink by exactly the difference
  it('uses an explicit tickLabelSize instead of measuring', () => {
    const at40 = plotClipHeight(mount({ ...categoryAxis({ tickLabel: { size: 40 } }) }));
    const at80 = plotClipHeight(mount({ ...categoryAxis({ tickLabel: { size: 80 } }) }));
    expect(at40 - at80).toBe(40);
  });

  it('uses an explicit titleSize instead of measuring', () => {
    const container = mount({ ...categoryAxis({ title: { text: 'Month', size: 30 } }) });
    expect(container.textContent).toContain('Month');
    const at60 = plotClipHeight(mount({ ...categoryAxis({ title: { text: 'Month', size: 60 } }) }));
    expect(plotClipHeight(container) - at60).toBe(30);
  });

  it('appends a tick label suffix', () => {
    const container = mount({ valueAxes: [{ tickLabel: { suffix: '%' } }] });
    const valueLabels = [...container.querySelectorAll(getDescendantCssSelector('valueAxis', 'axisTickLabel'))]
      .map(el => el.textContent ?? '');
    expect(valueLabels.length).toBeGreaterThan(0);
    expect(valueLabels.every(label => label.endsWith('%'))).toBe(true);
  });
});
