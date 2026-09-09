// legend.position can put the legend above the plot, moving the plot down by the legend's height and reordering the title/legend/plot bands; both branches of that ChartLayout arithmetic were dead — nothing had ever put a legend at the top
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { mountContainer, trackHandle } from '../components/helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 },
  { month: 'Mar', sales: 30, costs: 13 }
];

function mountChart(legendOverrides: Record<string, unknown>, titleOverrides: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }, { property: 'costs' }],
    title: { text: 'Trading', ...titleOverrides },
    legend: { visible: true, ...legendOverrides }
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

/** The y of a group's translate transform. */
function groupY(container: Element, key: 'legend' | 'title'): number {
  const group = container.querySelector(getCssSelector(key));
  expect(group).not.toBeNull();
  const transform = group!.getAttribute('transform') ?? '';
  const match = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(transform);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

/** The x of a group's translate transform. */
function groupX(container: Element, key: 'legend' | 'title'): number {
  const transform = container.querySelector(getCssSelector(key))!.getAttribute('transform') ?? '';
  const match = /translate\(\s*([-\d.]+)\s*,/.exec(transform);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

/** The plot's own band, taken from the plot background rect. */
function plotBand(container: Element): { top: number; bottom: number } {
  const rect = container.querySelector(getCssSelector('plotBackground') + ' rect');
  expect(rect).not.toBeNull();
  const top = Number(rect!.getAttribute('y'));
  return { top, bottom: top + Number(rect!.getAttribute('height')) };
}

beforeAll(() => {
  installSvgMeasurementShims();
});

// Regression: a legend not aligned to the axes was laid out from x = 0 over the content width, so it sat in the
// chart margin/padding on the left and stopped short of the content edge on the right
describe('legend horizontal frame when not aligned to axes', () => {
  const chart = { padding: { left: 100, right: 20 } };

  it('starts a left-aligned legend at the content edge, where the title starts', () => {
    const container = mountChart({ alignedToAxes: false, align: 'left' }, { alignedToAxes: false, align: 'left' });
    expect(groupX(container, 'legend')).toBe(groupX(container, 'title'));
  });

  it('shares the content frame with the title under a chart padding', () => {
    for (const align of ['left', 'right', 'center'] as const) {
      const container = mountContainer();
      const config = {
        version: VERSION, chart,
        animation: { enabled: false },
        categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
        series: [{ property: 'sales' }, { property: 'costs' }],
        title: { text: 'Trading', alignedToAxes: false, align },
        legend: { visible: true, alignedToAxes: false, align }
      } as unknown as MochartInputConfig;
      trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
      const legendRect = container.querySelector(getCssSelector('legendBackground') + ' rect')!;
      const titleRect = container.querySelector(getCssSelector('titleBackground') + ' rect')!;
      const legendLeft = groupX(container, 'legend') + Number(legendRect.getAttribute('x'));
      const legendRight = legendLeft + Number(legendRect.getAttribute('width'));
      const titleLeft = groupX(container, 'title') + Number(titleRect.getAttribute('x'));
      const titleRight = titleLeft + Number(titleRect.getAttribute('width'));
      if (align === 'left') {
        expect(legendLeft, align).toBe(titleLeft);
      }
      else if (align === 'right') {
        expect(legendRight, align).toBe(titleRight);
      }
      else {
        expect((legendLeft + legendRight) / 2, align).toBeCloseTo((titleLeft + titleRight) / 2, 5);
      }
    }
  });
});

describe('legend position', () => {
  it('puts a top legend above the plot and a bottom legend below it', () => {
    const top = mountChart({ position: 'top' });
    const bottom = mountChart({ position: 'bottom' });

    expect(groupY(top, 'legend')).toBeLessThan(plotBand(top).top);
    expect(groupY(bottom, 'legend')).toBeGreaterThanOrEqual(plotBand(bottom).bottom);
  });

  it('gives the plot the same height either way and moves it down by the legend band', () => {
    const top = mountChart({ position: 'top' });
    const bottom = mountChart({ position: 'bottom' });
    const topBand = plotBand(top);
    const bottomBand = plotBand(bottom);

    // the legend claims the same height on either side, so only the plot's offset changes
    expect(topBand.bottom - topBand.top).toBeCloseTo(bottomBand.bottom - bottomBand.top);
    // a bottom legend starts exactly where the plot ends; a top legend starts where the plot used to
    expect(groupY(bottom, 'legend')).toBeCloseTo(bottomBand.bottom);
    expect(groupY(top, 'legend')).toBeCloseTo(bottomBand.top);
    // and the band it takes there is exactly what the plot gives up at the top
    const legendHeight = topBand.top - groupY(top, 'legend');
    expect(legendHeight).toBeGreaterThan(0);
    expect(topBand.top - bottomBand.top).toBeCloseTo(legendHeight);
  });

  it('stacks a top title above a top legend above the plot', () => {
    const container = mountChart({ position: 'top' }, { position: 'top' });

    expect(groupY(container, 'title')).toBeLessThan(groupY(container, 'legend'));
    expect(groupY(container, 'legend')).toBeLessThan(plotBand(container).top);
  });

  it('keeps a bottom title below the plot when the legend is at the top', () => {
    const container = mountChart({ position: 'top' }, { position: 'bottom' });
    const band = plotBand(container);

    expect(groupY(container, 'legend')).toBeLessThan(band.top);
    expect(groupY(container, 'title')).toBeGreaterThanOrEqual(band.bottom);
  });

  it('stacks a bottom title above a bottom legend when both share the bottom', () => {
    const container = mountChart({ position: 'bottom' }, { position: 'bottom' });

    expect(groupY(container, 'title')).toBeGreaterThanOrEqual(plotBand(container).bottom);
    expect(groupY(container, 'title')).toBeLessThan(groupY(container, 'legend'));
  });
});
