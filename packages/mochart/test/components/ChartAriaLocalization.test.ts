// The chartLabel, chartRoleDescription, plotLabel and legendLabel accessibility overrides must reach the DOM
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 }
];

const german = {
  chartLabel: 'Diagramm',
  chartRoleDescription: 'Balkendiagramm',
  plotLabel: 'Diagrammwerte',
  legendLabel: 'Legende'
};

function mountChart(overrides: Record<string, unknown> = {}): Element {
  const container = mountContainer();
  const config = {
    version: VERSION,
    animation: { enabled: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales', renderer: 'bar' }],
    // filterOnClick is what makes the legend a keyboard group with a label of its own
    legend: { visible: true, filterOnClick: true },
    ...overrides
  } as unknown as MochartInputConfig;
  trackHandle(createDefaultChart(container, { config, data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
  return container;
}

function svgRoot(container: Element): Element {
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  return svg!;
}

function plotRect(container: Element): Element {
  const rect = container.querySelector(getCssSelector('seriesBackground') + ' rect');
  expect(rect).not.toBeNull();
  return rect!;
}

function legend(container: Element): Element {
  const group = container.querySelector(getCssSelector('legend'));
  expect(group).not.toBeNull();
  return group!;
}

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('accessibility label defaults', () => {
  it('names the chart, its role, the plot and the legend in English', () => {
    const container = mountChart();

    expect(svgRoot(container).getAttribute('aria-label')).toBe('Chart');
    expect(svgRoot(container).getAttribute('aria-roledescription')).toBe('chart');
    expect(plotRect(container).getAttribute('aria-label')).toBe('Chart values');
    expect(legend(container).getAttribute('aria-label')).toBe('Legend');
  });
});

describe('accessibility label overrides', () => {
  it('speaks an overridden chart role description', () => {
    const container = mountChart({ accessibility: { chartRoleDescription: german.chartRoleDescription } });

    expect(svgRoot(container).getAttribute('aria-roledescription')).toBe(german.chartRoleDescription);
  });

  it('speaks an overridden chart label when there is no title to name the chart', () => {
    const container = mountChart({ accessibility: { chartLabel: german.chartLabel } });

    expect(svgRoot(container).getAttribute('aria-label')).toBe(german.chartLabel);
  });

  // the title wins over both the default and an override — it names the chart better than either
  it('lets the title outrank the chart label', () => {
    const container = mountChart({ title: { text: 'Umsatz' }, accessibility: { chartLabel: german.chartLabel } });

    expect(svgRoot(container).getAttribute('aria-label')).toBe('Umsatz');
  });

  it('speaks an overridden plot label on the keyboard tab stop', () => {
    const container = mountChart({ accessibility: { plotLabel: german.plotLabel } });

    expect(plotRect(container).getAttribute('aria-label')).toBe(german.plotLabel);
  });

  it('speaks an overridden legend label', () => {
    const container = mountChart({ accessibility: { legendLabel: german.legendLabel } });

    expect(legend(container).getAttribute('aria-label')).toBe(german.legendLabel);
  });

  it('carries all four overrides at once', () => {
    const container = mountChart({ accessibility: { ...german } });

    expect(svgRoot(container).getAttribute('aria-label')).toBe(german.chartLabel);
    expect(svgRoot(container).getAttribute('aria-roledescription')).toBe(german.chartRoleDescription);
    expect(plotRect(container).getAttribute('aria-label')).toBe(german.plotLabel);
    expect(legend(container).getAttribute('aria-label')).toBe(german.legendLabel);
  });

  // with accessibility off the chart is not in the accessibility tree at all, override or not
  it('writes no chart labels when accessibility is disabled', () => {
    const container = mountChart({ accessibility: { enabled: false, ...german } });

    expect(svgRoot(container).getAttribute('aria-label')).toBeNull();
    expect(svgRoot(container).getAttribute('aria-roledescription')).toBeNull();
  });
});
