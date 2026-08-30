// maxTickCount and minTickSpacing, the two halves of the automatic tick budget, and tickCount overriding both
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getIdCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rows = months.map((month, index) => ({ month, index, sales: 10 + index * 5 }));

function mountChart(categoryOverrides: Record<string, unknown>, valueOverrides: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', ...categoryOverrides },
    valueAxes: [{ id: 'VA0', min: 0, max: 100, ...valueOverrides }],
    series: [{ axis: 'VA0', property: 'sales', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

// a tick the budget thinned out keeps its element and is hidden, so only visible text counts
function visibleLabels(container: Element, selector: string): string[] {
  return [...container.querySelectorAll<SVGElement>(selector + ' text')]
    .filter(text => text.style.visibility !== 'hidden')
    .map(text => text.textContent ?? '');
}

function categoryTickLabels(container: Element): string[] {
  return visibleLabels(container, getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel'));
}

function valueTickCount(container: Element): number {
  return visibleLabels(container, getIdCssSelector('valueAxis', 'VA0') + ' ' + getCssSelector('axisTickLabel')).length;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('ordinal category axis tick budget', () => {
  // ordinal axes default maxTickCount to 0 (no cap), so every category is labelled
  it('labels every category when the cap is off', () => {
    expect(categoryTickLabels(mountChart({}))).toEqual(months);
  });

  it('thins the labels to an even interval that fits the cap', () => {
    // 12 categories capped at 4 is an interval of 3: Jan, Apr, Jul, Oct
    expect(categoryTickLabels(mountChart({ maxTickCount: 4 }))).toEqual(['Jan', 'Apr', 'Jul', 'Oct']);
    // capped at 6 the interval halves
    expect(categoryTickLabels(mountChart({ maxTickCount: 6 }))).toEqual(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
  });

  it('never labels more categories than the cap allows', () => {
    for (const maxTickCount of [1, 2, 3, 5, 12, 20]) {
      expect(categoryTickLabels(mountChart({ maxTickCount })).length).toBeLessThanOrEqual(Math.min(maxTickCount, months.length));
    }
  });

  it('lets minTickSpacing thin the labels on its own', () => {
    const roomy = categoryTickLabels(mountChart({ minTickSpacing: 4 })).length;
    const cramped = categoryTickLabels(mountChart({ minTickSpacing: 400 })).length;

    expect(cramped).toBeLessThan(roomy);
    expect(cramped).toBeGreaterThan(0);
  });
});

describe('value axis tick budget', () => {
  it('produces fewer ticks as the cap tightens', () => {
    const uncapped = valueTickCount(mountChart({}, { maxTickCount: 0 }));
    const capped = valueTickCount(mountChart({}, { maxTickCount: 3 }));
    const tighter = valueTickCount(mountChart({}, { maxTickCount: 2 }));

    expect(capped).toBeLessThan(uncapped);
    expect(tighter).toBeLessThanOrEqual(capped);
  });

  it('produces fewer ticks as the minimum spacing grows', () => {
    // the cap is off so only the spacing formula decides the count
    const roomy = valueTickCount(mountChart({}, { maxTickCount: 0, minTickSpacing: 12 }));
    const cramped = valueTickCount(mountChart({}, { maxTickCount: 0, minTickSpacing: 300 }));

    expect(cramped).toBeLessThan(roomy);
    expect(cramped).toBeGreaterThan(0);
  });

  it('ignores both once tickCount asks for an exact number', () => {
    const exact = valueTickCount(mountChart({}, { tickCount: 6 }));

    expect(valueTickCount(mountChart({}, { tickCount: 6, maxTickCount: 2 }))).toBe(exact);
    expect(valueTickCount(mountChart({}, { tickCount: 6, minTickSpacing: 300 }))).toBe(exact);
  });

  // Regression: an invisible axis has no label width, so with minTickSpacing 0 the auto count divided by zero and
  // with maxTickCount 0 nothing clamped it, so d3 was asked for Infinity ticks and the chart never mounted
  it('mounts an invisible axis with minTickSpacing 0 and no tick cap', () => {
    const container = mountChart({}, { visible: false, maxTickCount: 0, minTickSpacing: 0, min: 1, max: 5 });
    expect(valueTickCount(container)).toBe(0);
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(1);
  });
});
