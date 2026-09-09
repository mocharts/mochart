// Legend/tooltip icon config that had never been set anywhere: icon.showColors, icon.showPlaceholders, icon.unfilteredColor, the border/spacer numbers, and the legend/tooltip icon gradient paths.
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 }
];

function mountChart(overrides: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 'S0', property: 'sales', renderer: 'bar' }, { id: 'S1', property: 'costs', renderer: 'bar' }],
    legend: { visible: true, filterOnClick: true },
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

/** The shapes the legend draws inside its icon groups. */
function legendIcons(container: Element): SVGElement[] {
  return [...container.querySelectorAll<SVGElement>(getCssSelector('legendItemIcon') + ' > *')];
}

/** The shapes the open tooltip draws for its row icons; the class sits on the html wrapper. */
function tooltipIcons(container: Element): SVGElement[] {
  const inside = getDescendantCssSelector('tooltip', 'tooltipLineIcon') + ' svg > ';
  return [...container.querySelectorAll<SVGElement>(inside + 'rect, ' + inside + 'path')];
}

/** The [offset, color] stops of a linearGradient. */
function stopsOf(gradient: Element): [string | null, string | null][] {
  return [...gradient.querySelectorAll('stop')].map((stop) => [stop.getAttribute('offset'), stop.getAttribute('stop-color')]);
}

/** The [offset, color] stops of the open tooltip's icon gradient. */
function gradientStops(container: Element): [string | null, string | null][] {
  const gradient = container.querySelector(getCssSelector('tooltip') + ' defs linearGradient');
  expect(gradient).not.toBeNull();
  return stopsOf(gradient!);
}

/** The series-color gradients the chart defines once in its top-level <defs> for the legend swatches. */
function chartGradients(container: Element): SVGLinearGradientElement[] {
  return [...container.querySelectorAll<SVGLinearGradientElement>(getCssSelector('chart') + ' > svg > defs > linearGradient')];
}

function openTooltip(container: Element): void {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect');
  expect(rect).not.toBeNull();
  rect!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

function filterSeries(container: Element, seriesId: string): void {
  container.querySelector(getIdCssSelector('legendItem', seriesId))!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeAll(() => {
  installSvgMeasurementShims();
  // jsdom lacks focus() on SVG elements; route it through the shared focus bookkeeping
  const svgProto = SVGElement.prototype as unknown as { focus?: () => void };
  if (typeof svgProto.focus !== 'function') {
    svgProto.focus = HTMLElement.prototype.focus;
  }
});

describe('legend icon switches', () => {
  it('fills the icon with the series color by default', () => {
    const icons = legendIcons(mountChart());

    expect(icons.length).toBe(2);
    expect(icons[0].getAttribute('fill')).not.toBe(icons[1].getAttribute('fill'));
  });

  it('falls back to the unfiltered placeholder color when icon.showColors is off', () => {
    const icons = legendIcons(mountChart({ legend: { visible: true, icon: { showColors: false, unfilteredColor: 'rgb(4,5,6)' } } }));

    // both icons stop carrying their series color and become identical placeholders
    expect(icons.length).toBe(2);
    expect(icons.map(icon => icon.getAttribute('fill'))).toEqual(['rgb(4,5,6)', 'rgb(4,5,6)']);
  });

  it('draws no icon at all when neither colors nor placeholders are wanted', () => {
    expect(legendIcons(mountChart({ legend: { visible: true, icon: { showColors: false, showPlaceholders: false } } }))).toHaveLength(0);
    // a series that opts out of its color still gets a placeholder while placeholders are on
    expect(legendIcons(mountChart({
      series: [{ id: 'S0', property: 'sales', renderer: 'bar', showColorInLegend: false }],
      legend: { visible: true, icon: { showPlaceholders: true } }
    }))).toHaveLength(1);
    expect(legendIcons(mountChart({
      series: [{ id: 'S0', property: 'sales', renderer: 'bar', showColorInLegend: false }],
      legend: { visible: true, icon: { showPlaceholders: false } }
    }))).toHaveLength(0);
  });

  it('writes the icon border color, opacity and size onto the shape', () => {
    const icons = legendIcons(mountChart({
      legend: { visible: true, icon: { borderStyle: { strokeColor: 'rgb(9,9,9)', strokeOpacity: 0.11, strokeWidth: 2 } } }
    }));

    expect(icons[0].getAttribute('stroke')).toBe('rgb(9,9,9)');
    expect(icons[0].getAttribute('stroke-opacity')).toBe('0.11');
    expect(icons[0].getAttribute('stroke-width')).toBe('2');
  });

  it('widens the icon slot by the icon spacer size', () => {
    // the item text carries the translate; its x is the icon width plus the spacer
    const textX = (container: Element) => {
      const transform = container.querySelector(getDescendantCssSelector('legendItemText') + ' text')!.getAttribute('transform') ?? '';
      return Number(/translate\(\s*([-\d.]+)/.exec(transform)![1]);
    };
    const narrow = mountChart({ legend: { visible: true, icon: { size: 10, spacing: 2 } } });
    const wide = mountChart({ legend: { visible: true, icon: { size: 10, spacing: 22 } } });

    // the item text starts after the icon plus its spacer, so 20 more spacer is 20 more offset
    expect(textX(wide) - textX(narrow)).toBeCloseTo(20);
  });
});

describe('legend icon color-scale gradients', () => {
  const rampSeries = { id: 'S0', property: 'sales', renderer: 'bar', colorProperty: 'sales', colorScale: { min: '#eee', max: '#036' } };
  const splitSeries = { id: 'S0', property: 'sales', renderer: 'bar', colorProperty: 'sales', colorScale: {
    base: { value: 15, belowMin: '#a00', belowMax: '#f00', aboveMin: '#0f0', aboveMax: '#0a0' }
  } };
  const plainSeries = { id: 'S1', property: 'costs', renderer: 'bar' };

  it('defines no series-color gradient for series without a color scale', () => {
    const container = mountChart();

    expect(chartGradients(container)).toHaveLength(0);
    // and the swatches stay flat colors
    expect(legendIcons(container).map(icon => icon.getAttribute('fill'))).not.toContainEqual(expect.stringMatching(/^url\(/));
  });

  it('points the swatch at one chart-level min/max ramp, drawn bottom to top', () => {
    const container = mountChart({ series: [rampSeries, plainSeries] });
    const gradients = chartGradients(container);
    const icons = legendIcons(container);

    // one gradient per color-scale series, shared by every swatch that shows it
    expect(gradients).toHaveLength(1);
    expect(icons[0].getAttribute('fill')).toBe('url(#' + gradients[0].getAttribute('id') + ')');
    expect(icons[1].getAttribute('fill')).not.toMatch(/^url\(/);
    // min at the bottom, max at the top, matching a value axis that grows upward
    expect(gradients[0].getAttribute('x1')).toBe('0');
    expect(gradients[0].getAttribute('x2')).toBe('0');
    expect(gradients[0].getAttribute('y1')).toBe('1');
    expect(gradients[0].getAttribute('y2')).toBe('0');
    expect(stopsOf(gradients[0])).toEqual([['0%', '#eee'], ['100%', '#036']]);
    expect([...gradients[0].querySelectorAll('stop')].map(stop => stop.getAttribute('stop-opacity'))).toEqual(['1', '1']);
  });

  it('splits a base-value swatch at the midline with a hard break', () => {
    const container = mountChart({ series: [splitSeries] });
    const gradients = chartGradients(container);

    expect(gradients).toHaveLength(1);
    expect(legendIcons(container)[0].getAttribute('fill')).toBe('url(#' + gradients[0].getAttribute('id') + ')');
    expect(stopsOf(gradients[0])).toEqual([['0%', '#a00'], ['50%', '#f00'], ['50%', '#0f0'], ['100%', '#0a0']]);
  });

  it('gives each color-scale series its own gradient id', () => {
    const container = mountChart({ series: [rampSeries, { ...splitSeries, id: 'S1', property: 'costs', colorProperty: 'costs' }] });
    const gradients = chartGradients(container);
    const icons = legendIcons(container);

    expect(gradients).toHaveLength(2);
    expect(gradients[0].getAttribute('id')).not.toBe(gradients[1].getAttribute('id'));
    expect(icons.map(icon => icon.getAttribute('fill'))).toEqual(gradients.map(gradient => 'url(#' + gradient.getAttribute('id') + ')'));
    expect(stopsOf(gradients[0])).toHaveLength(2);
    expect(stopsOf(gradients[1])).toHaveLength(4);
  });

  it('skips the gradient when the scale switches off one of its colors', () => {
    // omitted colors get defaults, so a ramp without its max and a split without one of its four colors take an explicit null
    const halfRamp = { ...rampSeries, colorScale: { min: '#eee', max: null } };
    const halfSplit = { ...splitSeries, colorScale: { base: { value: 15, belowMin: '#a00', belowMax: '#f00', aboveMin: '#0f0', aboveMax: null } } };
    const container = mountChart({ series: [halfRamp, { ...halfSplit, id: 'S1', property: 'costs', colorProperty: 'costs' }] });

    expect(chartGradients(container)).toHaveLength(0);
    expect(legendIcons(container).map(icon => icon.getAttribute('fill'))).not.toContainEqual(expect.stringMatching(/^url\(/));
  });

  it('rewrites the stops in place when the scale colors change', () => {
    const container = mountChart({ series: [rampSeries] });
    const before = chartGradients(container)[0];

    lastHandle().update({ config: {
      version: VERSION, animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ ...rampSeries, colorScale: { min: '#111', max: '#999' } }],
      legend: { visible: true }
    } } as unknown as Partial<DefaultChartProps>);
    const after = chartGradients(container);

    // same element, same id, new colors: the swatch's url(#...) reference keeps working
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(before);
    expect(stopsOf(after[0])).toEqual([['0%', '#111'], ['100%', '#999']]);
    expect(legendIcons(container)[0].getAttribute('fill')).toBe('url(#' + before.getAttribute('id') + ')');
  });

  it('switches between the ramp and the split shape when the scale kind changes', () => {
    const container = mountChart({ series: [rampSeries] });
    const gradient = chartGradients(container)[0];

    lastHandle().update({ config: {
      version: VERSION, animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [splitSeries],
      legend: { visible: true }
    } } as unknown as Partial<DefaultChartProps>);

    expect(chartGradients(container)[0]).toBe(gradient);
    expect(stopsOf(gradient)).toEqual([['0%', '#a00'], ['50%', '#f00'], ['50%', '#0f0'], ['100%', '#0a0']]);

    lastHandle().update({ config: {
      version: VERSION, animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [rampSeries],
      legend: { visible: true }
    } } as unknown as Partial<DefaultChartProps>);

    // the two extra stops are removed, not left dangling
    expect(stopsOf(gradient)).toEqual([['0%', '#eee'], ['100%', '#036']]);
  });

  it('drops the gradient and returns the swatch to a flat color when the scale is removed', () => {
    const container = mountChart({ series: [rampSeries] });
    expect(chartGradients(container)).toHaveLength(1);

    lastHandle().update({ config: {
      version: VERSION, animation: { enabled: false },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
      series: [{ id: 'S0', property: 'sales', renderer: 'bar' }],
      legend: { visible: true }
    } } as unknown as Partial<DefaultChartProps>);

    expect(chartGradients(container)).toHaveLength(0);
    expect(legendIcons(container)[0].getAttribute('fill')).not.toMatch(/^url\(/);
  });
});

describe('tooltip icon switches', () => {
  it('draws a colored icon per row by default', () => {
    const container = mountChart();
    openTooltip(container);

    expect(tooltipIcons(container).length).toBe(2);
  });

  it('drops the tooltip icons when neither colors nor placeholders are wanted', () => {
    const container = mountChart({ tooltip: { icon: { showColors: false, showPlaceholders: false } } });
    openTooltip(container);

    expect(tooltipIcons(container)).toHaveLength(0);
  });

  it('keeps placeholder icons when only the colors are switched off', () => {
    const container = mountChart({ tooltip: { icon: { showColors: false, showPlaceholders: true, unfilteredColor: 'rgb(4,5,6)' } } });
    openTooltip(container);
    const icons = tooltipIcons(container);

    expect(icons.length).toBe(2);
    expect(icons.map(icon => icon.getAttribute('fill'))).toEqual(['rgb(4,5,6)', 'rgb(4,5,6)']);
  });

  it('takes the filtered color once its series is filtered', () => {
    const container = mountChart({ tooltip: { icon: { filteredColor: 'rgb(7,7,7)' } } });
    filterSeries(container, 'S0');
    openTooltip(container);
    const icons = tooltipIcons(container);

    expect(icons[0].getAttribute('fill')).toBe('rgb(7,7,7)');
    expect(icons[1].getAttribute('fill')).not.toBe('rgb(7,7,7)');
  });
});

describe('tooltip icon gradients', () => {
  const gradientConfig = {
    linearGradients: [{
      id: 'fade', x1: 0, y1: 0, x2: 0, y2: 1,
      stops: [{ offset: 0, color: '#1f77b4', opacity: 0.9 }, { offset: 1, color: '#1f77b4', opacity: 0.05 }]
    }],
    series: [{ id: 'S0', property: 'sales', renderer: 'area', gradient: 'fade' }]
  };

  it('gives a gradient-filled series its own gradient definition in the tooltip icon', () => {
    const container = mountChart(gradientConfig);
    openTooltip(container);
    const icons = tooltipIcons(container);

    expect(icons.length).toBe(1);
    // the swatch points at a gradient the icon defines for itself, not a flat color
    const fill = icons[0].getAttribute('fill') ?? '';
    expect(fill).toMatch(/^url\(#.+\)$/);
    const defs = container.querySelector(getCssSelector('tooltip') + ' defs linearGradient');
    expect(defs).not.toBeNull();
    expect(fill).toBe('url(#' + defs!.getAttribute('id') + ')');
  });

  it('does the same for a radial gradient', () => {
    const container = mountChart({
      radialGradients: [{
        id: 'glow', cx: 0.5, cy: 0.5, r: 0.5,
        stops: [{ offset: 0, color: '#fff', opacity: 1 }, { offset: 1, color: '#1f77b4', opacity: 1 }]
      }],
      series: [{ id: 'S0', property: 'sales', renderer: 'area', gradient: 'glow' }]
    });
    openTooltip(container);

    expect(container.querySelector(getCssSelector('tooltip') + ' defs radialGradient')).not.toBeNull();
  });

  it('builds a value-ramp gradient for a colorScale series', () => {
    const container = mountChart({
      series: [{ id: 'S0', property: 'sales', renderer: 'bar', colorProperty: 'sales', colorScale: { min: '#eee', max: '#036' } }]
    });
    openTooltip(container);
    const icons = tooltipIcons(container);

    expect(icons[0].getAttribute('fill')).toMatch(/^url\(#.+\)$/);
    expect(gradientStops(container)).toEqual([['0%', '#eee'], ['100%', '#036']]);
  });

  it('splits a base-value gradient at the midline', () => {
    const container = mountChart({
      series: [{ id: 'S0', property: 'sales', renderer: 'bar', colorProperty: 'sales', colorScale: {
        base: { value: 15, belowMin: '#a00', belowMax: '#f00', aboveMin: '#0f0', aboveMax: '#0a0' }
      } }]
    });
    openTooltip(container);

    expect(gradientStops(container)).toEqual([['0%', '#a00'], ['50%', '#f00'], ['50%', '#0f0'], ['100%', '#0a0']]);
  });
});
