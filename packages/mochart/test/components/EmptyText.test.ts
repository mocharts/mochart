/**
 * Regression: an empty string counted as text present in the layout, measurement and truncation while
 * the parts never rendered an element for it, so title.text '' reserved a title row and drew
 * "undefined..." under truncation, an empty prefix reserved its default width, categoryAxis.valueLabel
 * '' printed ": " before the category, and pie.centerLabel.text '' pushed the total below the centre.
 * Now '' means none, like null, for every text setting that takes null for none.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getDescendantCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 400;
const HEIGHT = 300;
const rows = [{ m: 'Jan', a: 1 }, { m: 'Feb', a: 2 }];

function mountChart(overrides: Record<string, unknown>): Element {
  const container = mountContainer();
  trackHandle(createDefaultChart(container, {
    config: { version: '1.0.0', animation: { enabled: false }, categoryAxis: { property: 'm' }, series: [{ property: 'a' }], ...overrides } as unknown as MochartInputConfig,
    data: rows, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return container;
}

/** The plot rect's placement: where the chart puts its plot after reserving room for the parts around it. */
function plotRect(container: Element): string {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;
  return [rect.getAttribute('x'), rect.getAttribute('y'), rect.getAttribute('width'), rect.getAttribute('height')].join(',');
}

function texts(container: Element): string[] {
  return Array.from(container.querySelectorAll('text')).map(text => text.textContent ?? '');
}

beforeAll(() => {
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
});

describe("an empty string means none, like null", () => {
  it('reserves no title row and draws no title text for title.text \'\'', () => {
    const empty = mountChart({ title: { text: '' } });
    const none = mountChart({ title: { text: null } });
    expect(plotRect(empty)).toBe(plotRect(none));
    expect(empty.querySelector(getCssSelector('titleText'))).toBeNull();
    expect(texts(empty).some(text => text.includes('undefined'))).toBe(false);
  });

  it('reserves nothing for an empty prefix or suffix beside a real title', () => {
    const empty = mountChart({ title: { text: 'Sales', prefix: { text: '' }, suffix: { text: '' } } });
    const none = mountChart({ title: { text: 'Sales', prefix: { text: null }, suffix: { text: null } } });
    expect(plotRect(empty)).toBe(plotRect(none));
    expect(empty.querySelector(getCssSelector('titlePrefix'))).toBeNull();
    expect(empty.querySelector(getCssSelector('titleSuffix'))).toBeNull();
    const titleX = (container: Element) => container.querySelector(getCssSelector('titleText') + ' text, ' + getCssSelector('titleText'))!.getAttribute('transform');
    expect(titleX(empty)).toBe(titleX(none));
  });

  it('reserves no axis title room for an axis title of \'\'', () => {
    const empty = mountChart({ categoryAxis: { property: 'm', title: { text: '' } }, valueAxes: [{ title: { text: '' } }] });
    const none = mountChart({ categoryAxis: { property: 'm', title: { text: null } }, valueAxes: [{ title: { text: null } }] });
    expect(plotRect(empty)).toBe(plotRect(none));
  });

  it('prints no label separator in the tooltip for categoryAxis.valueLabel \'\'', () => {
    const container = mountChart({ categoryAxis: { property: 'm', valueLabel: '' } });
    const root = container.querySelector(getChartRootCssSelector())!;
    root.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
    root.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    const categoryLine = container.querySelector(getDescendantCssSelector('tooltip', 'tooltipCategoryLine'))!;
    expect(categoryLine.textContent!.trim().startsWith(':')).toBe(false);
    expect(categoryLine.textContent).toContain('Jan');
  });

  it('centres the pie total for centerLabel.text \'\' as it does for null', () => {
    const pie = (text: string | null) => mountChart({
      chart: { type: 'pie' }, pie: { centerLabel: { text }, centerTotal: { visible: true } },
      categoryAxis: { property: 'm' }, series: [{ property: 'a' }]
    });
    const totalDy = (container: Element) => container.querySelector(getCssSelector('pieCenterTotal'))!.getAttribute('dy');
    expect(mountChart({ chart: { type: 'pie' }, pie: { centerLabel: { text: '' }, centerTotal: { visible: true } } }).querySelector(getCssSelector('pieCenterLabel'))).toBeNull();
    expect(totalDy(pie(''))).toBe(totalDy(pie(null)));
  });

  it('gives a series with title \'\' its default legend title', () => {
    const container = mountChart({ series: [{ id: 'S0', property: 'a', title: '' }], legend: { visible: true } });
    expect(texts(container)).toContain('Series S0');
  });
});
