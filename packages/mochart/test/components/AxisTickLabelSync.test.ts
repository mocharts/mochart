/**
 * Axis tick-label hot path: focus updates re-sync the labels every frame, so the label strings and
 * text styles keep their identity across syncs and are rebuilt only when the ticks or anchor change.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import AxisTickLabels from '../../src/components/AxisTickLabels';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getDescendantCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

const renamedRows = [
  { month: 'April', sales: 10 },
  { month: 'May', sales: 20 },
  { month: 'June', sales: 30 }
];

function makeConfig(categoryAxis: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...categoryAxis },
    valueAxes: [{ min: 0, max: 40 }],
    series: [{ id: 'S0', property: 'sales', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
}

const syncSpy = vi.spyOn(AxisTickLabels.prototype, 'sync');

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

/** mounts a chart and returns both axes' tick-label renderers (the category one is labelled with the month names) */
function mountChart(config: MochartInputConfig = makeConfig()) {
  syncSpy.mockClear();
  const container = mountContainer();
  const handle = trackHandle(createDefaultChart(container, {
    config, data: rows, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  const instances = [...new Set(syncSpy.mock.contexts as AxisTickLabels[])];
  const categoryLabels = instances.find(instance => instance.tickLabelStrings.includes('Jan'));
  const valueLabels = instances.find(instance => instance !== categoryLabels);
  expect(categoryLabels).toBeDefined();
  expect(valueLabels).toBeDefined();
  return { container, handle, categoryLabels: categoryLabels!, valueLabels: valueLabels! };
}

function labelTexts(container: Element, axis: 'categoryAxis' | 'valueAxis' = 'categoryAxis'): string[] {
  return [...container.querySelectorAll(getDescendantCssSelector(axis, 'axisTickLabel') + ' text')]
    .map(label => label.textContent ?? '');
}

function labelAnchors(container: Element): string[] {
  return [...container.querySelectorAll<SVGTextElement>(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')]
    .map(label => label.style.textAnchor);
}

describe('axis tick label sync', () => {
  it('keeps the label strings and text styles across focus updates', () => {
    const { container, handle, valueLabels } = mountChart();
    const strings = valueLabels.tickLabelStrings;
    const style = valueLabels.tickTextStyle;
    const hiddenStyle = valueLabels.hiddenTickTextStyle;
    expect(strings.length).toBeGreaterThan(0);
    expect(style).toEqual({ textAnchor: 'end' });
    expect(hiddenStyle).toEqual({ textAnchor: 'end', visibility: 'hidden' });
    const rendered = labelTexts(container, 'valueAxis');
    expect(rendered).toEqual(strings);

    // series focus tweens the value axis's focus props, re-syncing its labels
    syncSpy.mockClear();
    for (let i = 0; i < 4; i++) {
      handle.update({ focusedSeriesId: i % 2 === 0 ? 'S0' : null } as Partial<DefaultChartProps>);
    }
    // the focus updates did reach the labels' sync...
    expect(syncSpy.mock.contexts.includes(valueLabels)).toBe(true);
    // ...and left every cached input untouched
    expect(valueLabels.tickLabelStrings).toBe(strings);
    expect(valueLabels.tickTextStyle).toBe(style);
    expect(valueLabels.hiddenTickTextStyle).toBe(hiddenStyle);
    expect(labelTexts(container, 'valueAxis')).toEqual(rendered);
  });

  it('rebuilds the label strings when the ticks change', () => {
    const { container, handle, categoryLabels } = mountChart();
    const strings = categoryLabels.tickLabelStrings;
    expect(strings).toEqual(['Jan', 'Feb', 'Mar']);

    handle.update({ data: renamedRows } as Partial<DefaultChartProps>);
    expect(categoryLabels.tickLabelStrings).not.toBe(strings);
    expect(categoryLabels.tickLabelStrings).toEqual(['April', 'May', 'June']);
    expect(labelTexts(container)).toEqual(['April', 'May', 'June']);
  });

  it('rebuilds the text styles when the anchor changes', () => {
    const { container, handle, categoryLabels } = mountChart();
    const style = categoryLabels.tickTextStyle;
    expect(style).toEqual({ textAnchor: 'middle' });
    expect(labelAnchors(container)).toEqual(['middle', 'middle', 'middle']);

    handle.update({ config: makeConfig({ tickLabel: { anchor: 'start' } }) } as Partial<DefaultChartProps>);
    expect(categoryLabels.tickTextStyle).not.toBe(style);
    expect(categoryLabels.tickTextStyle).toEqual({ textAnchor: 'start' });
    expect(categoryLabels.hiddenTickTextStyle).toEqual({ textAnchor: 'start', visibility: 'hidden' });
    expect(labelAnchors(container)).toEqual(['start', 'start', 'start']);
  });
});
