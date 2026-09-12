/**
 * A configured font is written as an inline style on each text element, resolved per member from the
 * part's own font and then chart.font, and the hidden measuring twins carry it so the layout sizes
 * to it. Uses the golden text metrics, which read each element's own inline font size.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mountContainer, trackHandle, mockBoundingClientRect } from './helpers';
import { installTextMetrics } from '../golden/textMetrics';
import { createDefaultChart } from '../../src/createChart';
import { getCssSelector, getDescendantCssSelector, getIdCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 15, costs: 6 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    title: { text: 'Revenue', prefix: { text: 'Q1' } },
    legend: { visible: true },
    tooltip: { followPointer: true },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Month' } },
    valueAxes: [{ id: 'VA0', title: { text: 'Amount' }, thresholds: [{ value: 12, title: { text: 'Target' } }] }],
    series: [
      { id: 'S0', property: 'sales', title: 'Sales', renderer: 'bar', labelProperty: 'sales' },
      { id: 'S1', property: 'costs', title: 'Costs', renderer: 'bar' }
    ],
    ...overrides
  } as unknown as MochartInputConfig;
}

function mountChart(config: MochartInputConfig): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

function element(container: Element, selector: string): SVGElement | HTMLElement {
  const found = container.querySelector<SVGElement | HTMLElement>(selector);
  expect(found, selector).not.toBeNull();
  return found!;
}

function openTooltip(container: Element): HTMLElement {
  const root = element(container, getChartRootCssSelector());
  root.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
  return element(container, getCssSelector('tooltip')) as HTMLElement;
}

const titleText = getCssSelector('titleText');
const titleTextRaw = getCssSelector('titleTextRaw');
const titlePrefix = getCssSelector('titlePrefix');
const legendItemText = getCssSelector('legendItemText') + ' text';
const legendItemTextRaw = getCssSelector('legendItemTextRaw') + ' text';
const categoryTickLabel = getDescendantCssSelector('categoryAxis', 'axisTickLabel') + ' text';
const categorySizeTickLabel = getDescendantCssSelector('categoryAxis', 'axisSizeTickLabel') + ' text';
const categoryAxisTitle = getDescendantCssSelector('categoryAxis', 'axisTitle') + ' text';
const valueTickLabel = getIdCssSelector('valueAxis', 'VA0') + ' ' + getCssSelector('axisTickLabels') + ' text';
const thresholdTitle = getIdCssSelector('valueAxisThreshold', 'VA0') + ' ' + getCssSelector('axisThresholdTitle') + ' text';
const seriesLabel = getCssSelector('seriesLabels') + ' text';

function plotClipRect(container: Element): Element {
  return element(container, 'clipPath[id^="series__clippath__"] rect');
}

beforeAll(() => {
  installTextMetrics();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe('font resolution', () => {
  it('writes nothing when neither the part nor chart.font sets a member', () => {
    const container = mountChart(makeConfig());
    for (const selector of [titleText, titleTextRaw, titlePrefix, legendItemText, categoryAxisTitle, thresholdTitle, seriesLabel]) {
      expect(element(container, selector).hasAttribute('style'), selector).toBe(false);
    }
    // tick labels carry their anchor as a style, but no font member
    expect(element(container, valueTickLabel).getAttribute('style') ?? '').not.toContain('font');
    expect(openTooltip(container).style.fontFamily).toBe('');
  });

  it('applies chart.font where the part leaves a member null', () => {
    const container = mountChart(makeConfig({ chart: { font: { family: 'Georgia', size: 18, weight: 700, style: 'italic' } } }));
    for (const selector of [titleText, titlePrefix, legendItemText, categoryTickLabel, valueTickLabel, categoryAxisTitle, thresholdTitle, seriesLabel]) {
      const { style } = element(container, selector);
      expect(style.fontFamily, selector).toBe('Georgia');
      expect(style.fontSize, selector).toBe('18px');
      expect(style.fontWeight, selector).toBe('700');
      expect(style.fontStyle, selector).toBe('italic');
    }
  });

  it('lets a part\'s own member win over chart.font, member by member', () => {
    const container = mountChart(makeConfig({
      chart: { font: { family: 'Georgia', size: 18 } },
      title: { text: 'Revenue', font: { size: 24, weight: 'bold' } }
    }));
    const { style } = element(container, titleText);
    expect(style.fontFamily).toBe('Georgia');
    expect(style.fontSize).toBe('24px');
    expect(style.fontWeight).toBe('bold');
    expect(style.fontStyle).toBe('');
    // the legend keeps the chart-wide values
    expect(element(container, legendItemText).style.fontSize).toBe('18px');
  });

  it('writes each member as its own css property', () => {
    const container = mountChart(makeConfig({ legend: { visible: true, item: { font: { family: '"Fira Sans", sans-serif', size: 13, weight: 'lighter', style: 'oblique' } } } }));
    const { style } = element(container, legendItemText);
    expect(style.getPropertyValue('font-family')).toBe('"Fira Sans", sans-serif');
    expect(style.getPropertyValue('font-size')).toBe('13px');
    expect(style.getPropertyValue('font-weight')).toBe('lighter');
    expect(style.getPropertyValue('font-style')).toBe('oblique');
  });

  it('styles the tooltip div the same way', () => {
    const container = mountChart(makeConfig({
      chart: { font: { family: 'Georgia' } },
      tooltip: { followPointer: true, font: { size: 15, weight: 600 } }
    }));
    const { style } = openTooltip(container);
    expect(style.fontFamily).toBe('Georgia');
    expect(style.fontSize).toBe('15px');
    expect(style.fontWeight).toBe('600');
    expect(style.fontStyle).toBe('');
  });

  it('removes the style again when a config update clears the font', () => {
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config: makeConfig({ title: { text: 'Revenue', font: { size: 24 } } }), data: rows, width: WIDTH, height: HEIGHT
    } as DefaultChartProps));
    expect(element(container, titleText).style.fontSize).toBe('24px');
    handle.update({ config: makeConfig() } as Partial<DefaultChartProps>);
    expect(element(container, titleText).hasAttribute('style')).toBe(false);
  });
});

describe('font measurement', () => {
  it('reserves more axis space for a larger tick label font', () => {
    const withTickFont = (size: number | null) => makeConfig({
      valueAxes: [{ id: 'VA0', title: { text: 'Amount' }, tickLabel: { font: { size } } }],
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', title: { text: 'Month' }, tickLabel: { font: { size } } }
    });
    const plain = plotClipRect(mountChart(withTickFont(null)));
    const larger = plotClipRect(mountChart(withTickFont(32)));
    // wider value tick labels narrow the plot; taller category tick labels shorten it
    expect(Number(larger.getAttribute('width'))).toBeLessThan(Number(plain.getAttribute('width')));
    expect(Number(larger.getAttribute('height'))).toBeLessThan(Number(plain.getAttribute('height')));
  });

  it('gives every hidden measuring twin the font of the element it measures for', () => {
    const container = mountChart(makeConfig({
      chart: { font: { family: 'Georgia', size: 18 } },
      title: { text: 'Revenue', font: { size: 24 } },
      legend: { visible: true, truncation: { enabled: true }, item: { font: { weight: 'bold' } } },
      tooltip: { followPointer: true, font: { size: 15 } },
      categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', tickLabel: { truncation: { enabled: true }, font: { style: 'italic' } } }
    }));
    expect(element(container, titleTextRaw).getAttribute('style')).toBe(element(container, titleText).getAttribute('style'));
    expect(element(container, legendItemTextRaw).getAttribute('style')).toBe(element(container, legendItemText).getAttribute('style'));
    expect(element(container, categorySizeTickLabel).style.fontStyle).toBe(element(container, categoryTickLabel).style.fontStyle);
    expect(element(container, categorySizeTickLabel).style.fontSize).toBe('18px');
    const tooltip = openTooltip(container);
    const sizer = element(container, getCssSelector('tooltipSizer')) as HTMLElement;
    expect(sizer.style.fontFamily).toBe(tooltip.style.fontFamily);
    expect(sizer.style.fontSize).toBe(tooltip.style.fontSize);
    expect(sizer.style.fontSize).toBe('15px');
  });
});
