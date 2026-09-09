import { beforeAll, describe, expect, it } from 'vitest';
import { createDefaultChart } from '../../src/createChart';
import { createPie } from '../../src/data/Pie';
import { getCssSelector, getCssClassMatchSelector, getDescendantCssSelector, getIdCssClass } from '../../src/utils/ChartDom';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle, lastHandle } from './helpers';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const rows = [
  { c: 'A', a: 10, b: 15, color: 0 },
  { c: 'B', a: 20, b: 5, color: 1 }
];

function mount(config: MochartInputConfig, data: readonly unknown[] = rows): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data, width: 600, height: 400 } as DefaultChartProps));
  return container;
}

function base(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'c' },
    series: [{ id: 'A', property: 'a', renderer: 'bar' }],
    ...overrides
  } as unknown as MochartInputConfig;
}

function openTooltip(container: Element): void {
  container.querySelector(getCssSelector('seriesBackground') + ' rect')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

beforeAll(() => installSvgMeasurementShims());

describe('built-in SVG patterns', () => {
  it('renders lines, crosshatch, and dots in screen-space pattern definitions', () => {
    const container = mount(base({
      patterns: [
        { id: 'lines', type: 'lines', spacing: 9, rotation: -30, lineWidth: 3 },
        { id: 'cross', type: 'crosshatch', foregroundColor: 'currentColor', backgroundColor: '#fff' },
        { id: 'dots', type: 'dots', radius: 1.5 }
      ],
      series: [
        { id: 'A', property: 'a', renderer: 'bar', pattern: 'lines' },
        { id: 'B', property: 'b', renderer: 'bar', pattern: 'cross' },
        { id: 'C', property: 'color', renderer: 'bar', pattern: 'dots' }
      ]
    }));

    const patterns = [...container.querySelectorAll('svg > defs > pattern')];
    expect(patterns).toHaveLength(3);
    expect(patterns.map(pattern => pattern.getAttribute('patternUnits'))).toEqual([
      'userSpaceOnUse', 'userSpaceOnUse', 'userSpaceOnUse'
    ]);

    expect(patterns[0].getAttribute('width')).toBe('9');
    expect(patterns[0].getAttribute('patternTransform')).toBe('rotate(-30)');
    expect(patterns[0].querySelectorAll('line')).toHaveLength(1);
    expect(patterns[0].querySelector('line')!.getAttribute('stroke-width')).toBe('3');
    // centred in the tile, so the whole stroke width shows (an edge line loses half to the tile clip)
    expect(patterns[0].querySelector('line')!.getAttribute('x1')).toBe('4.5');
    expect(patterns[0].querySelector('line')!.getAttribute('x2')).toBe('4.5');

    expect(patterns[1].querySelectorAll('line')).toHaveLength(2);
    expect(patterns[1].querySelector('line')!.getAttribute('stroke')).toBe('currentColor');
    expect(patterns[1].querySelector('rect')!.getAttribute('fill')).toBe('#fff');

    expect(patterns[2].getAttribute('patternTransform')).toBeNull();
    expect(patterns[2].querySelector('circle')!.getAttribute('r')).toBe('1.5');
  });

  it('resolves series colors per series and uses the pattern as the bar fill', () => {
    const container = mount(base({
      patterns: [{ id: 'hatch', type: 'lines' }],
      series: [
        { id: 'A', property: 'a', renderer: 'bar', pattern: 'hatch' },
        { id: 'B', property: 'b', renderer: 'bar', pattern: 'hatch' }
      ]
    }));

    const patterns = [...container.querySelectorAll('svg > defs > pattern')];
    expect(patterns).toHaveLength(2);
    expect(patterns[0].querySelector('line')!.getAttribute('stroke'))
      .not.toBe(patterns[1].querySelector('line')!.getAttribute('stroke'));

    const patternIds = patterns.map(pattern => pattern.id);
    const fills = [...container.querySelectorAll(getCssSelector('seriesBar'))]
      .map(bar => bar.getAttribute('fill'));
    expect(new Set(fills)).toEqual(new Set(patternIds.map(id => `url(#${id})`)));
  });

  it('keeps a pattern fill when per-datum colors change the bar stroke', () => {
    const container = mount(base({
      patterns: [{ type: 'dots' }],
      series: [{ id: 'A', property: 'a', renderer: 'bar', colorProperty: 'color',
        colorScale: { min: '#ff0000', max: '#0000ff' } }]
    }));
    const bars = [...container.querySelectorAll(getCssSelector('seriesBar'))];
    expect(bars[0].getAttribute('fill')).toMatch(/^url\(#series__pattern__/);
    expect(bars[1].getAttribute('fill')).toBe(bars[0].getAttribute('fill'));
    expect(bars[1].getAttribute('stroke')).not.toBe(bars[0].getAttribute('stroke'));
  });

  it('uses patterns for areas but leaves plot markers solid', () => {
    const area = mount(base({
      patterns: [{ type: 'lines' }],
      series: [{ id: 'A', property: 'a', renderer: 'area', marker: { shape: 'circle' } }]
    }));
    expect(area.querySelector(getCssSelector('seriesArea'))!.getAttribute('fill')).toMatch(/^url\(#series__pattern__/);
    expect(area.querySelector(getCssSelector('seriesMarker'))!.getAttribute('fill')).not.toMatch(/^url\(/);
  });

  it('uses patterns and both gradient types on pie slices with their default line renderer', () => {
    const pie = createPie([{ label: 'A', value: 3 }, { label: 'B', value: 2 }]);
    const common = {
      version: '1.0.0', animation: { enabled: false }, chart: pie.chart, pie: pie.pie,
      categoryAxis: pie.categoryAxis, series: pie.series
    };

    const patternContainer = mount({ ...common, patterns: [{ type: 'crosshatch' }] }, pie.data);
    const patternSlices = [...patternContainer.querySelectorAll(getCssSelector('seriesSlice'))];
    expect(patternSlices).toHaveLength(2);
    expect(patternSlices.every(slice => /^url\(#series__pattern__/.test(slice.getAttribute('fill') ?? ''))).toBe(true);

    const gradientContainer = mount({ ...common, linearGradients: [{
      stops: [
        { offset: 0, color: '#000', opacity: 1 },
        { offset: 1, color: '#fff', opacity: 1 }
      ]
    }] }, pie.data);
    const gradientSlices = [...gradientContainer.querySelectorAll(getCssSelector('seriesSlice'))];
    expect(gradientSlices).toHaveLength(2);
    expect(gradientSlices.every(slice => /^url\(#linear__gradient__/.test(slice.getAttribute('fill') ?? ''))).toBe(true);

    const radialGradientContainer = mount({ ...common, radialGradients: [{
      stops: [
        { offset: 0, color: '#fff', opacity: 1 },
        { offset: 1, color: '#000', opacity: 1 }
      ]
    }] }, pie.data);
    const radialGradientSlices = [...radialGradientContainer.querySelectorAll(getCssSelector('seriesSlice'))];
    expect(radialGradientSlices).toHaveLength(2);
    expect(radialGradientSlices.every(slice => /^url\(#radial__gradient__/.test(slice.getAttribute('fill') ?? ''))).toBe(true);
  });

  it('updates pattern definitions and series references in place', () => {
    const container = mount(base({
      patterns: [{ id: 'p', type: 'dots', radius: 1.5 }],
      series: [{ id: 'A', property: 'a', renderer: 'bar', pattern: 'p' }]
    }));
    const handle = lastHandle();

    let pattern = container.querySelector('svg > defs > pattern')!;
    expect(pattern.querySelector('circle')).not.toBeNull();
    expect(pattern.querySelector('line')).toBeNull();
    expect(pattern.querySelector('rect')).toBeNull();

    handle.update({ config: base({
      patterns: [{ id: 'p', type: 'lines', rotation: 30, lineWidth: 4, backgroundColor: '#123456' }],
      series: [{ id: 'A', property: 'a', renderer: 'bar', pattern: 'p' }]
    }) } as Partial<DefaultChartProps>);

    pattern = container.querySelector('svg > defs > pattern')!;
    expect(pattern.getAttribute('patternTransform')).toBe('rotate(30)');
    expect(pattern.querySelector('circle')).toBeNull();
    expect(pattern.querySelector('line')!.getAttribute('stroke-width')).toBe('4');
    // the background added after mount must paint under the marks group
    expect([...pattern.children].map(child => child.tagName)).toEqual(['rect', 'g']);
    expect(pattern.children[0].getAttribute('fill')).toBe('#123456');

    handle.update({ config: base({
      patterns: [{ id: 'p', type: 'lines', rotation: 30, lineWidth: 4 }],
      series: [{ id: 'A', property: 'a', renderer: 'bar', pattern: null }]
    }) } as Partial<DefaultChartProps>);

    expect(container.querySelector('svg > defs > pattern')).toBeNull();
    expect(container.querySelector(getCssSelector('seriesBar'))!.getAttribute('fill')).not.toMatch(/^url\(/);
  });

  it('keeps the pattern fill on focused and defocused bars and dims via opacity', () => {
    const container = mount(base({
      patterns: [{ id: 'p', type: 'lines' }],
      series: [
        { id: 'A', property: 'a', renderer: 'bar', pattern: 'p' },
        { id: 'B', property: 'b', renderer: 'bar' }
      ]
    }));
    const handle = lastHandle();
    const bar = (seriesId: string) =>
      container.querySelector(getCssClassMatchSelector(getIdCssClass('series', seriesId)) + ' ' + getCssSelector('seriesBar'))!;

    const normalFill = bar('A').getAttribute('fill');
    const normalOpacity = Number(bar('A').getAttribute('fill-opacity') ?? '1');
    expect(normalFill).toMatch(/^url\(#series__pattern__/);

    handle.update({ focusedSeriesId: 'B' } as Partial<DefaultChartProps>);
    expect(bar('A').getAttribute('fill')).toBe(normalFill);
    expect(Number(bar('A').getAttribute('fill-opacity') ?? '1')).toBeLessThan(normalOpacity);

    handle.update({ focusedSeriesId: 'A' } as Partial<DefaultChartProps>);
    expect(bar('A').getAttribute('fill')).toBe(normalFill);
    expect(Number(bar('A').getAttribute('fill-opacity') ?? '1')).toBeGreaterThanOrEqual(normalOpacity);

    handle.update({ focusedSeriesId: null } as Partial<DefaultChartProps>);
    expect(bar('A').getAttribute('fill')).toBe(normalFill);
    expect(Number(bar('A').getAttribute('fill-opacity') ?? '1')).toBe(normalOpacity);
  });

  it('recreates the pattern in tooltip icons and uses rectangular pattern swatches', () => {
    const container = mount(base({
      patterns: [{ type: 'dots' }],
      legend: { visible: true },
      series: [{ id: 'A', property: 'a', renderer: 'area', marker: { shape: 'circle' } }]
    }));

    const legendIcon = container.querySelector(getCssSelector('legendItemIcon') + ' > rect');
    expect(legendIcon).not.toBeNull();
    expect(legendIcon!.getAttribute('fill')).toMatch(/^url\(#series__pattern__/);

    openTooltip(container);

    const tooltip = container.querySelector(getCssSelector('tooltip'))!;
    const pattern = tooltip.querySelector('defs pattern');
    expect(pattern).not.toBeNull();
    const iconSelector = getDescendantCssSelector('tooltip', 'tooltipLineIcon') + ' svg > rect';
    const icon = container.querySelector(iconSelector);
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('fill')).toBe(`url(#${pattern!.id})`);
  });
});
