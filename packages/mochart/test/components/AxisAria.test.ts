// What a screen reader reads inside the plot: tick labels are exposed in named axis groups, noise text stays aria-hidden
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { getRenderedText } from '../golden/textMetrics';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector, getIdCssSelector } from '../../src/utils/ChartDom';

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    legend: { visible: true },
    title: { text: 'Monthly sales' },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [
      { id: 'S0', property: 'sales' },
      { id: 'S1', property: 'costs' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig, props: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: 800, height: 600, ...props }));
  return container;
}

function ariaHiddenAncestor(element: Element): Element | null {
  let current: Element | null = element;
  while (current !== null) {
    if (current.getAttribute('aria-hidden') === 'true') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function exposedTexts(container: Element): string[] {
  return [...container.querySelectorAll('text')]
    .filter(text => ariaHiddenAncestor(text) === null)
    .map(text => text.textContent ?? '');
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('axis text in the accessibility tree', () => {
  it('reads the axis tick labels instead of hiding them with the plot geometry', () => {
    const container = mountChart(makeConfig());
    for (const selector of [getCssSelector('plotBack'), getCssSelector('plotFront')]) {
      expect(container.querySelector(selector)!.getAttribute('aria-hidden'), selector).toBeNull();
    }
    const texts = exposedTexts(container);
    expect(texts).toContain('Jan');
    expect(texts).toContain('Feb');
    expect(texts).toContain('10');
  });

  it('leaves only the unreadable text nodes hidden', () => {
    const container = mountChart(makeConfig());
    const texts = [...container.querySelectorAll('text')];
    const hidden = texts.filter(text => ariaHiddenAncestor(text) !== null);
    expect(texts.length).toBe(19);
    // the ordinal width probe, the two overlap-suppressed end ticks, and the drawn chart title the svg is named from
    expect(hidden.length).toBe(4);
    expect(hidden.filter(text => (text.getAttribute('style') ?? '').includes('hidden')).length).toBe(3);
  });

  it('names each axis group from the accessibility labels so the ticks read as a scale', () => {
    const container = mountChart(makeConfig());
    const categoryAxis = container.querySelector(getDescendantCssSelector('plotBack', 'categoryAxis'))!;
    expect(categoryAxis.getAttribute('role')).toBe('group');
    expect(categoryAxis.getAttribute('aria-label')).toBe('Category axis');
    const valueAxis = container.querySelector(getDescendantCssSelector('plotBack', 'valueAxis'))!;
    expect(valueAxis.getAttribute('role')).toBe('group');
    expect(valueAxis.getAttribute('aria-label')).toBe('Value axis');
  });

  it('localizes the axis group names', () => {
    const container = mountChart(makeConfig({ accessibility: { categoryAxisLabel: 'Monatsachse', valueAxisLabel: 'Werteachse' } }));
    expect(container.querySelector(getDescendantCssSelector('plotBack', 'categoryAxis'))!.getAttribute('aria-label')).toBe('Monatsachse');
    expect(container.querySelector(getDescendantCssSelector('plotBack', 'valueAxis'))!.getAttribute('aria-label')).toBe('Werteachse');
  });

  it('prefers the axis title as the group name and stops the drawn title repeating it', () => {
    const container = mountChart(makeConfig({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Months' } } }));
    const categoryAxis = container.querySelector(getDescendantCssSelector('plotBack', 'categoryAxis'))!;
    expect(categoryAxis.getAttribute('aria-label')).toBe('Months');
    const axisTitle = container.querySelector(getDescendantCssSelector('categoryAxis', 'axisTitle'))!;
    expect(axisTitle.getAttribute('aria-hidden')).toBe('true');
    expect(exposedTexts(container)).not.toContain('Months');
  });

  it('stops the drawn title repeating the group name when it draws in the other half', () => {
    const container = mountChart(makeConfig({ categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Months', front: true } } }));
    const backCategoryAxis = container.querySelector(getDescendantCssSelector('plotBack', 'categoryAxis'))!;
    expect(backCategoryAxis.getAttribute('aria-label')).toBe('Months');
    const axisTitle = container.querySelector(getDescendantCssSelector('plotFront', 'axisTitle'))!;
    expect(axisTitle.getAttribute('aria-hidden')).toBe('true');
    expect(exposedTexts(container)).not.toContain('Months');
  });

  it('groups only the axis half that draws the tick labels', () => {
    const container = mountChart(makeConfig());
    const frontCategoryAxis = container.querySelector(getDescendantCssSelector('plotFront', 'categoryAxis'))!;
    expect(frontCategoryAxis.getAttribute('role')).toBeNull();
    expect(frontCategoryAxis.getAttribute('aria-label')).toBeNull();
  });

  it('keeps the overlap-suppressed tick labels out of the reading order', () => {
    const container = mountChart(makeConfig());
    const tickTexts = [...container.querySelectorAll(getDescendantCssSelector('plotBack', 'axisTickLabel') + ' text')];
    const suppressed = tickTexts.filter(text => (text.getAttribute('style') ?? '').includes('hidden'));
    expect(suppressed.length).toBeGreaterThan(0);
    for (const text of suppressed) {
      expect(text.getAttribute('aria-hidden'), text.textContent ?? '').toBe('true');
    }
    for (const text of tickTexts.filter(text => !suppressed.includes(text))) {
      expect(text.getAttribute('aria-hidden'), text.textContent ?? '').toBeNull();
    }
  });

  it('keeps the ordinal width probe out of the reading order', () => {
    const container = mountChart(makeConfig());
    const probe = container.querySelector(getCssSelector('axisSizeTickLabel'))!;
    expect(probe).not.toBeNull();
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    expect(exposedTexts(container).some(text => text.includes('W'))).toBe(false);
  });

  it('keeps the series data labels out of the reading order', () => {
    const container = mountChart(makeConfig({
      series: [{ id: 'S0', property: 'sales', labelProperty: 'sales' }]
    }));
    const labels = container.querySelector(getCssSelector('seriesLabels'))!;
    expect(labels).not.toBeNull();
    expect(labels.querySelectorAll('text').length).toBeGreaterThan(0);
    expect(labels.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the threshold annotations out of the reading order', () => {
    const container = mountChart(makeConfig({
      valueAxes: [{ id: 'VA0', thresholds: [{ value: 15, title: { text: 'Target' } }] }]
    }));
    const thresholdTitle = container.querySelector(getCssSelector('axisThresholdTitle'))!;
    expect(thresholdTitle).not.toBeNull();
    expect(ariaHiddenAncestor(thresholdTitle)!.matches(getCssSelector('axisThresholdContainer'))).toBe(true);
    expect(exposedTexts(container)).not.toContain('Target');
  });

  it('adds no axis roles, names or hidden markers when accessibility is disabled', () => {
    const container = mountChart(makeConfig({ accessibility: { enabled: false } }));
    const plot = container.querySelector(getCssSelector('plot'))!;
    expect(plot.querySelectorAll('[role]').length).toBe(0);
    expect(plot.querySelectorAll('[aria-label]').length).toBe(0);
    expect(plot.querySelectorAll('[aria-hidden]').length).toBe(0);
  });
});

describe('truncated tick labels', () => {
  const longRows = [
    { month: 'an-extremely-long-january-label-that-cannot-fit', sales: 10 },
    { month: 'an-extremely-long-february-label-that-cannot-fit', sales: 20 },
    { month: 'an-extremely-long-march-label-that-cannot-fit', sales: 30 }
  ];

  beforeAll(() => {
    // character-proportional measurements so truncation actually engages in jsdom
    const svgProto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
    svgProto.getComputedTextLength = function (this: SVGTextContentElement) {
      return getRenderedText(this).length * 9.7;
    };
    svgProto.getSubStringLength = (_start: number, count: number) => count * 9.7;
    svgProto.getBBox = function (this: SVGGraphicsElement) {
      return { x: 0, y: 0, width: getRenderedText(this).length * 9.7, height: 12 };
    };
  });

  it('names an ellipsised tick label with its full string', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig({ series: [{ id: 'S0', property: 'sales' }] }),
      data: longRows, width: 500, height: 400
    } as DefaultChartProps));
    // truncation is only rechecked after an update; the mount frame renders untruncated
    handle.update({ focusedCategoryIndex: 0 } as Partial<DefaultChartProps>);

    const tickTexts = [...container.querySelectorAll(getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text')];
    expect(tickTexts.length).toBe(longRows.length);
    expect(tickTexts.every(text => (text.textContent ?? '').includes('…'))).toBe(true);
    expect(tickTexts.map(text => text.getAttribute('aria-label'))).toEqual(longRows.map(row => row.month));
  });

  it('leaves an untruncated tick label unnamed so its own text reads', () => {
    const container = mountChart(makeConfig());
    for (const text of container.querySelectorAll(getIdCssSelector('valueAxis', 'VA0') + ' ' + getCssSelector('axisTickLabel') + ' text')) {
      expect(text.getAttribute('aria-label'), text.textContent ?? '').toBeNull();
    }
  });
});
