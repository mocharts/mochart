/**
 * Pie/donut rendering tests: chartConfig.type 'pie' mounts RadialPlot (slices,
 * no axes/crosshair), slices renormalize when a series is filtered, labels
 * respect label.minFraction, and animated value updates settle on a fake
 * clock (same technique as the golden suite).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { installFakeFrameClock, runFrames, mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import type { ChartFocus, DefaultChartProps } from '../../src/types/chart';
import type { DeepPartial, MochartInputConfig, PieConfig } from '../../src/types/config';
import type { PieItem, CreatePieOptions } from '../../src/data/Pie';
import { getCssClass, getIdCssClass, getCssSelector, getCssClassMatchSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;
const FRAME_MS = 16;

const ITEMS: PieItem[] = [
  { label: 'Chrome', value: 62 },
  { label: 'Safari', value: 20 },
  { label: 'Firefox', value: 18 }
];

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  installFakeFrameClock();
  mochart = await import('../../src');
});

function pieChartProps(items: PieItem[], options: CreatePieOptions = {}, configOverrides: Record<string, unknown> = {}): { config: MochartInputConfig; data: readonly unknown[] } {
  const pie = mochart.createPie(items, options);
  const config = {
    version: VERSION,
    animation: { enabled: false },
    chart: pie.chart,
    pie: pie.pie,
    categoryAxis: pie.categoryAxis,
    series: pie.series,
    ...configOverrides
  } as unknown as MochartInputConfig;
  return { config, data: pie.data };
}

function mountChart(config: MochartInputConfig, data: readonly unknown[], extraProps: Partial<DefaultChartProps> = {}) {
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config, data, width: WIDTH, height: HEIGHT, ...extraProps
  } as DefaultChartProps));
  return { container, handle };
}

function slicePaths(container: Element): Element[] {
  return Array.from(container.querySelectorAll(getCssSelector('seriesSlice')));
}

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

// Regression: axis layout reads only axisConfig.visible, so a pie with a visible axis reserved the
// gutter while RadialPlot drew no axis — and grew real axes through PlotEmpty when the data emptied
describe('axis visibility in pie mode', () => {
  function validation(visible: boolean) {
    const { config } = pieChartProps(ITEMS);
    return mochart.enhanceConfig({ ...config, categoryAxis: { ...(config.categoryAxis as object), visible } } as MochartInputConfig).validation;
  }

  it('rejects a visible category axis', () => {
    expect(validation(true).errors).toContain('categoryAxis - visible - should be equal to false when chart type is not xy: true');
  });

  it('rejects a visible value axis', () => {
    const { config } = pieChartProps(ITEMS);
    const withAxis = mochart.enhanceConfig({ ...config, valueAxes: [{ id: 'VA0', visible: true }] } as MochartInputConfig);
    expect(withAxis.validation.errors).toContain('valueAxes[0] - visible - should be equal to false when chart type is not xy: true');
  });

  it('accepts the hidden axes a pie config resolves to', () => {
    expect(validation(false).valid).toBe(true);
  });
});

// Regression: a pie series keeps the default renderer 'line', so the legend and tooltip icons read
// the stroke colour and stroke opacity while the slice itself is drawn from the fill members
describe('pie legend and tooltip icons follow the slice fill', () => {
  function legendIcon(container: Element, sliceId: string): Element {
    const item = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', sliceId)));
    expect(item, sliceId).not.toBeNull();
    const icon = item!.querySelector(getCssSelector('legendItemIcon') + ' rect,' + getCssSelector('legendItemIcon') + ' path');
    expect(icon, sliceId + ' icon').not.toBeNull();
    return icon!;
  }

  it('takes the icon colour from the slice fill, not the stroke', () => {
    const { config, data } = pieChartProps(ITEMS);
    (config.series as Array<Record<string, unknown>>)[0]!.shapeStyle = {
      normal: { fillColor: '#ff0000', strokeColor: '#00ff00' }
    };
    const { container } = mountChart(config, data);
    expect(slicePaths(container)[0]!.getAttribute('fill')).toBe('#ff0000');
    expect(legendIcon(container, 'slice0').getAttribute('fill')).toBe('#ff0000');
  });

  it('takes the icon opacity from the slice fill opacity', () => {
    const { config, data } = pieChartProps(ITEMS);
    (config.series as Array<Record<string, unknown>>)[0]!.shapeStyle = {
      normal: { fillOpacity: 0.25, strokeOpacity: 1 }
    };
    const { container } = mountChart(config, data);
    expect(legendIcon(container, 'slice0').getAttribute('fill-opacity')).toBe('0.25');
  });

  it('draws the icon as a swatch rather than a marker circle', () => {
    const { config, data } = pieChartProps(ITEMS);
    const { container } = mountChart(config, data);
    expect(legendIcon(container, 'slice0').tagName.toLowerCase()).toBe('rect');
  });
});

describe('pie chart rendering', () => {
  it('mounts a radial plot with one slice path per series and no axes or crosshair', () => {
    const { config, data } = pieChartProps(ITEMS);
    const { container } = mountChart(config, data);
    expect(container.querySelector(getCssSelector('radialPlot'))).not.toBeNull();
    expect(slicePaths(container)).toHaveLength(3);
    expect(container.querySelectorAll(getCssSelector('series'))).toHaveLength(3);
    expect(container.querySelector(getCssSelector('crosshair'))).toBeNull();
    expect(container.querySelector(getCssSelector('axisLine'))).toBeNull();
    expect(container.querySelector(getCssSelector('legend'))).not.toBeNull();
  });

  it('sets the pointer cursor on a slice series root only when configured', () => {
    const { config, data } = pieChartProps(ITEMS);
    (config.series as Array<Record<string, unknown>>)[0]!.showPointer = true;
    const { container } = mountChart(config, data);
    const roots = container.querySelectorAll(getCssSelector('series'));
    expect(roots).toHaveLength(3);
    expect(roots[0]!.getAttribute('cursor')).toBe('pointer');
    expect(roots[1]!.getAttribute('cursor')).toBeNull();
  });

  it('applies the shape style stroke dash array to a slice', () => {
    const { config, data } = pieChartProps(ITEMS);
    (config.series as Array<Record<string, unknown>>)[0]!.shapeStyle = { normal: { strokeDashArray: '4 2' } };
    const { container } = mountChart(config, data);
    const paths = slicePaths(container);
    expect(paths[0]!.getAttribute('stroke-dasharray')).toBe('4 2');
    expect(paths[1]!.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('renders a donut with a different arc path than a pie', () => {
    const pie = mountChart(...Object.values(pieChartProps(ITEMS)) as [MochartInputConfig, readonly unknown[]]);
    const { config, data } = pieChartProps(ITEMS, { donut: true });
    const donut = mountChart(config, data);
    const pieD = slicePaths(pie.container)[0]!.getAttribute('d');
    const donutD = slicePaths(donut.container)[0]!.getAttribute('d');
    expect(pieD).toBeTruthy();
    expect(donutD).toBeTruthy();
    expect(donutD).not.toBe(pieD);
  });

  it('shows labels when enabled and hides those under label.minFraction', () => {
    const items: PieItem[] = [
      { label: 'Big', value: 98 },
      { label: 'Tiny', value: 2 }
    ];
    const { config, data } = pieChartProps(items, {}, {
      pie: { label: { visible: true, type: 'percent', minFraction: 0.05 } } as Partial<PieConfig>
    });
    const { container } = mountChart(config, data);
    const labels = Array.from(container.querySelectorAll(getCssSelector('seriesSliceLabel')));
    expect(labels).toHaveLength(1);
    expect(labels[0]!.textContent).toBe('98%');
  });

  it('removes a filtered slice and renormalizes the remaining slices', () => {
    const { config, data } = pieChartProps(ITEMS);
    const unfiltered = mountChart(config, data);
    const filtered = mountChart(config, data, { filteredSeriesIds: { slice0: true } });
    expect(slicePaths(unfiltered.container)).toHaveLength(3);
    const remaining = slicePaths(filtered.container);
    expect(remaining).toHaveLength(2);
    // with slice0 (62) gone, safari (20) + firefox (18) split the full circle,
    // so their paths must differ from the unfiltered render
    const before = slicePaths(unfiltered.container).map((path) => path.getAttribute('d'));
    const after = remaining.map((path) => path.getAttribute('d'));
    expect(after[0]).not.toBe(before[1]);
  });

  it('filters a slice via a legend item click', () => {
    const { config, data } = pieChartProps(ITEMS);
    const { container } = mountChart(config, data);
    expect(slicePaths(container)).toHaveLength(3);
    const legendItem = container.querySelector(getCssClassMatchSelector(getIdCssClass('legendItem', 'slice0')));
    expect(legendItem).not.toBeNull();
    legendItem!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(slicePaths(container)).toHaveLength(2);
    legendItem!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    runFrames();
    expect(slicePaths(container)).toHaveLength(3);
  });

  it('opens a tooltip on click with one row per slice', () => {
    const { config, data } = pieChartProps(ITEMS);
    const { container } = mountChart(config, data);
    const root = container.querySelector(getChartRootCssSelector())!;
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
    mouse(root, 'mousemove', WIDTH / 2, HEIGHT / 2);
    mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
    const tooltip = container.querySelector(getCssSelector('tooltip'));
    expect(tooltip).not.toBeNull();
    expect(tooltip!.querySelectorAll(getCssClassMatchSelector(getCssClass('tooltipSeriesLine')))).toHaveLength(3);
    mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
    expect(container.querySelector(getCssSelector('tooltip'))).toBeNull();
  });

  describe('tooltip values (pieConfig.tooltip.valueType)', () => {
    function tooltipRows(items: PieItem[], options: CreatePieOptions, extraProps: Partial<DefaultChartProps> = {}): string[] {
      const { config, data } = pieChartProps(items, options);
      const { container } = mountChart(config, data, extraProps);
      const root = container.querySelector(getChartRootCssSelector())!;
      mouse(root, 'mousemove', WIDTH / 2, HEIGHT / 2);
      mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
      return Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getCssClass('tooltipSeriesLine'))))
        .map(line => line.textContent ?? '');
    }

    it('shows the slice values by default', () => {
      expect(tooltipRows(ITEMS, { valueFormat: ',.0f' })).toEqual(['Chrome: 62', 'Safari: 20', 'Firefox: 18']);
    });

    it('shows each slice\'s share for percent, and both parts for the combinations', () => {
      expect(tooltipRows(ITEMS, { tooltipValueType: 'percent' }))
        .toEqual(['Chrome: 62.0%', 'Safari: 20.0%', 'Firefox: 18.0%']);
      expect(tooltipRows(ITEMS, { tooltipValueType: 'valuePercent', valueFormat: ',.0f' }))
        .toEqual(['Chrome: 62 (62.0%)', 'Safari: 20 (20.0%)', 'Firefox: 18 (18.0%)']);
      expect(tooltipRows(ITEMS, { tooltipValueType: 'percentValue', valueFormat: ',.0f' }))
        .toEqual(['Chrome: 62.0% (62)', 'Safari: 20.0% (20)', 'Firefox: 18.0% (18)']);
    });

    // The inconsistency this option exists to remove: percent slice labels
    // renormalize when a slice is filtered, so the tooltip must too.
    it('renormalizes the percentages against the unfiltered slices, like the labels', () => {
      const rows = tooltipRows(ITEMS, { tooltipValueType: 'percent' }, { filteredSeriesIds: { slice0: true } });
      // Safari 20 and Firefox 18 now split the whole circle
      expect(rows[1]).toBe('Safari: 52.6%');
      expect(rows[2]).toBe('Firefox: 47.4%');
    });

    it('freezes the percentages at the full-total shares when adjustForFiltering is off', () => {
      const { config, data } = pieChartProps(ITEMS, { tooltipValueType: 'percent' },
        { tooltip: { adjustForFiltering: false } });
      const { container } = mountChart(config, data, { filteredSeriesIds: { slice0: true } });
      const root = container.querySelector(getChartRootCssSelector())!;
      mouse(root, 'mousemove', WIDTH / 2, HEIGHT / 2);
      mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
      const rows = Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getCssClass('tooltipSeriesLine'))))
        .map(line => line.textContent ?? '');
      expect(rows).toEqual(['Chrome: 62.0%', 'Safari: 20.0%', 'Firefox: 18.0%']);
    });

    it('masks a filtered slice\'s own row with the filtered placeholder', () => {
      const { config, data } = pieChartProps(ITEMS, { tooltipValueType: 'percent' },
        { tooltip: { filteredValueText: '--' } });
      const { container } = mountChart(config, data, { filteredSeriesIds: { slice0: true } });
      const root = container.querySelector(getChartRootCssSelector())!;
      mouse(root, 'mousemove', WIDTH / 2, HEIGHT / 2);
      mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
      const rows = Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getCssClass('tooltipSeriesLine'))))
        .map(line => line.textContent ?? '');
      expect(rows[0]).toBe('Chrome: --');
    });

    it('formats the percent part with tooltip.percentFormat and the value part per series', () => {
      const { config, data } = pieChartProps(ITEMS, { tooltipValueType: 'percentValue', valueFormat: ',.1f' });
      // merged, not replaced: the helper's fragment carries tooltip.valueType
      const piePartial = (config as { pie: DeepPartial<PieConfig> }).pie;
      (config as { pie: DeepPartial<PieConfig> }).pie = { ...piePartial, tooltip: { ...piePartial.tooltip, percentFormat: '.0%' } };
      const { container } = mountChart(config, data);
      const root = container.querySelector(getChartRootCssSelector())!;
      mouse(root, 'mousemove', WIDTH / 2, HEIGHT / 2);
      mouse(root, 'click', WIDTH / 2, HEIGHT / 2);
      const rows = Array.from(container.querySelectorAll(getCssSelector('tooltip') + ' ' + getCssClassMatchSelector(getCssClass('tooltipSeriesLine'))))
        .map(line => line.textContent ?? '');
      expect(rows[0]).toBe('Chrome: 62% (62.0)');
    });

    it('renders label combinations from the same shares', () => {
      const { config, data } = pieChartProps(ITEMS, {}, {
        pie: { label: { visible: true, type: 'titlePercent' } } as Partial<PieConfig>
      });
      const { container } = mountChart(config, data);
      const labels = Array.from(container.querySelectorAll(getCssSelector('seriesSliceLabel'))).map(label => label.textContent);
      expect(labels).toEqual(['Chrome: 62%', 'Safari: 20%', 'Firefox: 18%']);
    });

    // an untitled series is named the same way everywhere: legend, tooltip, aria label and slice label
    it('names an untitled series in the label like the legend does', () => {
      const { config, data } = pieChartProps(ITEMS, {}, {
        pie: { label: { visible: true, type: 'titlePercent' } } as Partial<PieConfig>
      });
      const untitled = { ...config, series: (config.series as { title?: string }[]).map(({ title: _title, ...rest }) => rest) } as MochartInputConfig;
      const { container } = mountChart(untitled, data);
      const labels = Array.from(container.querySelectorAll(getCssSelector('seriesSliceLabel'))).map(label => label.textContent);
      const legendItems = Array.from(container.querySelectorAll(getCssSelector('legendItemText'))).map(item => item.textContent);
      expect(legendItems).toHaveLength(3);
      expect(labels.map(label => label!.replace(/: \d+%$/, ''))).toEqual(legendItems);
    });
  });

  it('leaves the single category value out of the tooltip unless showCategory is set', () => {
    const hidden = pieChartProps(ITEMS, { categoryValue: 'all' });
    const hiddenChart = mountChart(hidden.config, hidden.data);
    const hiddenRoot = hiddenChart.container.querySelector(getChartRootCssSelector())!;
    mouse(hiddenRoot, 'mousemove', WIDTH / 2, HEIGHT / 2);
    mouse(hiddenRoot, 'click', WIDTH / 2, HEIGHT / 2);
    const hiddenTooltip = hiddenChart.container.querySelector(getCssSelector('tooltip'))!;
    expect(hiddenTooltip.querySelector(getCssSelector('tooltipCategoryLine'))).toBeNull();
    expect(hiddenTooltip.textContent).not.toContain('all');

    const shown = pieChartProps(ITEMS, { categoryValue: 'all' }, { tooltip: { showCategory: true } });
    const shownChart = mountChart(shown.config, shown.data);
    const shownRoot = shownChart.container.querySelector(getChartRootCssSelector())!;
    mouse(shownRoot, 'mousemove', WIDTH / 2, HEIGHT / 2);
    mouse(shownRoot, 'click', WIDTH / 2, HEIGHT / 2);
    const shownTooltip = shownChart.container.querySelector(getCssSelector('tooltip'))!;
    expect(shownTooltip.querySelector(getCssSelector('tooltipCategoryLine'))!.textContent).toBe('all');
  });

  it('renders a partial span for gauge configs', () => {
    const full = mountChart(...Object.values(pieChartProps(ITEMS)) as [MochartInputConfig, readonly unknown[]]);
    const { config, data } = pieChartProps(ITEMS, {}, {
      pie: { startAngle: -90, endAngle: 90 } as Partial<PieConfig>
    });
    const gauge = mountChart(config, data);
    const fullD = slicePaths(full.container)[0]!.getAttribute('d');
    const gaugeD = slicePaths(gauge.container)[0]!.getAttribute('d');
    expect(gaugeD).toBeTruthy();
    expect(gaugeD).not.toBe(fullD);
  });

  it('explodes the focused slice by focusOffsetFraction', () => {
    const { config, data } = pieChartProps(ITEMS, {}, {
      pie: { focusOffsetFraction: 0.1 } as Partial<PieConfig>
    });
    const plain = mountChart(config, data);
    const focused = mountChart(config, data, { focusedSeriesId: 'slice0' });
    const transformOf = (container: Element) =>
      container.querySelector(getCssClassMatchSelector(getIdCssClass('series', 'slice0')))!.getAttribute('transform');
    expect(transformOf(focused.container)).not.toBe(transformOf(plain.container));
    // unfocused slices keep the centered transform
    const otherTransform = (container: Element) =>
      container.querySelector(getCssClassMatchSelector(getIdCssClass('series', 'slice1')))!.getAttribute('transform');
    expect(otherTransform(focused.container)).toBe(otherTransform(plain.container));
  });

  it('renders the center label and a filtering-aware total', () => {
    const { config, data } = pieChartProps(ITEMS, { donut: true }, {
      pie: { innerRadiusFraction: 0.6, centerLabel: { text: 'Total' }, centerTotal: { visible: true, format: ',.0f' } } as Partial<PieConfig>
    });
    const { container } = mountChart(config, data);
    expect(container.querySelector(getCssSelector('pieCenterLabel'))!.textContent).toBe('Total');
    expect(container.querySelector(getCssSelector('pieCenterTotal'))!.textContent).toBe('100');

    const filtered = mountChart(config, data, { filteredSeriesIds: { slice0: true } });
    expect(filtered.container.querySelector(getCssSelector('pieCenterTotal'))!.textContent).toBe('38');
  });

  it('keeps percent labels on the full total when label.adjustForFiltering is off', () => {
    const labelConfig = (adjust: boolean) => pieChartProps(ITEMS, {}, {
      pie: { label: { visible: true, type: 'percent', minFraction: 0, adjustForFiltering: adjust } } as Partial<PieConfig>
    });
    const filtered = { filteredSeriesIds: { slice2: true } };

    const adjusted = mountChart(labelConfig(true).config, labelConfig(true).data, filtered);
    const adjustedLabels = Array.from(adjusted.container.querySelectorAll(getCssSelector('seriesSliceLabel'))).map((label) => label.textContent);
    expect(adjustedLabels).toEqual(['76%', '24%']); // renormalized against 62 + 20

    const unadjusted = mountChart(labelConfig(false).config, labelConfig(false).data, filtered);
    const unadjustedLabels = Array.from(unadjusted.container.querySelectorAll(getCssSelector('seriesSliceLabel'))).map((label) => label.textContent);
    expect(unadjustedLabels).toEqual(['62%', '20%']); // shares of the full total
  });

  it('keeps the center total on the full total when centerTotal.adjustForFiltering is off', () => {
    const totalConfig = (adjust: boolean) => pieChartProps(ITEMS, {}, {
      pie: { centerTotal: { visible: true, format: ',.0f', adjustForFiltering: adjust } } as Partial<PieConfig>
    });
    const filtered = { filteredSeriesIds: { slice0: true } };

    const adjusted = mountChart(totalConfig(true).config, totalConfig(true).data, filtered);
    expect(adjusted.container.querySelector(getCssSelector('pieCenterTotal'))!.textContent).toBe('38');

    const unadjusted = mountChart(totalConfig(false).config, totalConfig(false).data, filtered);
    expect(unadjusted.container.querySelector(getCssSelector('pieCenterTotal'))!.textContent).toBe('100');
  });

  it('sweeps in on the initial animation, revealing labels only once settled', () => {
    const pie = mochart.createPie(ITEMS);
    const config = {
      version: VERSION,
      animation: { enabled: true },
      chart: pie.chart,
      pie: { label: { visible: true, minFraction: 0 } },
      categoryAxis: pie.categoryAxis,
      series: pie.series
    } as unknown as MochartInputConfig;
    const { container } = mountChart(config, pie.data);
    // a few frames into the initial sweep: slices exist, labels stay hidden
    for (let frame = 0; frame < 4 && vi.getTimerCount() > 0; frame++) {
      vi.advanceTimersByTime(FRAME_MS);
    }
    expect(slicePaths(container).length).toBeGreaterThan(0);
    const midSweepD = slicePaths(container).map((path) => path.getAttribute('d'));
    expect(container.querySelectorAll(getCssSelector('seriesSliceLabel'))).toHaveLength(0);

    runFrames();
    expect(container.querySelectorAll(getCssSelector('seriesSliceLabel'))).toHaveLength(3);
    const settledD = slicePaths(container).map((path) => path.getAttribute('d'));
    expect(settledD).not.toEqual(midSweepD);
  });

  it('settles animated value updates into new slice angles', () => {
    const pie = mochart.createPie(ITEMS);
    const config = {
      version: VERSION,
      animation: { enabled: true },
      chart: pie.chart,
      pie: pie.pie,
      categoryAxis: pie.categoryAxis,
      series: pie.series
    } as unknown as MochartInputConfig;
    const { container, handle } = mountChart(config, pie.data);
    runFrames();
    expect(slicePaths(container)).toHaveLength(3);
    const initial = slicePaths(container).map((path) => path.getAttribute('d'));

    const updated = mochart.createPie([
      { label: 'Chrome', value: 20 },
      { label: 'Safari', value: 60 },
      { label: 'Firefox', value: 20 }
    ]);
    handle.update({ data: updated.data } as Partial<DefaultChartProps>);
    runFrames();
    const settled = slicePaths(container).map((path) => path.getAttribute('d'));
    expect(settled).toHaveLength(3);
    expect(settled[0]).not.toBe(initial[0]);
    expect(settled[1]).not.toBe(initial[1]);
  });
});

describe('pie slice hover focus', () => {
  function slice(container: Element, index: number): Element {
    const slices = container.querySelectorAll(getCssSelector('seriesSlice'));
    expect(slices.length).toBeGreaterThan(index);
    return slices[index];
  }

  it('focuses and unfocuses the slice series when focusOnHover is set', () => {
    const focuses: ChartFocus[] = [];
    const { config, data } = pieChartProps(ITEMS, {}, { seriesDefaults: { focusOnHover: true } });
    const { container } = mountChart(config, data, { onFocus: focus => { focuses.push(focus); } });

    // focusing moves the slice to the end of the DOM, so keep the node rather than re-querying by index
    const hovered = slice(container, 1);
    hovered.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: 'slice1' });

    hovered.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    expect(focuses[focuses.length - 1]).toMatchObject({ focusedSeriesId: null });
  });

  it('reports nothing from a slice with no focus config and no slice click handler', () => {
    const focuses: ChartFocus[] = [];
    const { config, data } = pieChartProps(ITEMS);
    const { container } = mountChart(config, data, { onFocus: focus => { focuses.push(focus); } });

    slice(container, 0).dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
    slice(container, 0).dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    slice(container, 0).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(focuses).toEqual([]);
  });
});
