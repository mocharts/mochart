/**
 * Screen-reader semantics of the chart root: the svg is a labeled group named from the title, and the
 * decorative geometry is aria-hidden so assistive tech lands on the meaningful stops, not unlabeled shapes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { mountContainer, trackHandle } from './helpers';
import { createDefaultChart } from '../../src/createChart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssClass, getCssSelector } from '../../src/utils/ChartDom';

const rows = [
  { month: 'Jan', sales: 10, costs: 5 },
  { month: 'Feb', sales: 20, costs: 8 }
];

function makeConfig(overrides: Record<string, unknown> = {}): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    legend: { visible: true },
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

beforeAll(() => {
  installSvgMeasurementShims();
});

describe('chart aria semantics', () => {
  it('labels the svg as a chart group named from the title', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales' } }));
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('group');
    expect(svg.getAttribute('aria-roledescription')).toBe('chart');
    expect(svg.getAttribute('aria-label')).toBe('Monthly sales');
  });

  it('falls back to a generic name when there is no title', () => {
    const container = mountChart(makeConfig());
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe('Chart');
  });

  // Regression: '' is a valid title text and produced aria-label=""
  it('falls back to a generic name when the title text is empty', () => {
    const container = mountChart(makeConfig({ title: { text: '' } }));
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe('Chart');
  });

  it('hides the decorative geometry from assistive tech', () => {
    const container = mountChart(makeConfig());
    // the plot halves stay exposed: their axis tick labels are text (see AxisAria)
    for (const selector of [getCssSelector('crosshair'), getCssSelector('axisThresholdContainer')]) {
      const el = container.querySelector(selector);
      expect(el, selector).not.toBeNull();
      expect(el!.getAttribute('aria-hidden'), selector).toBe('true');
    }
    const seriesGroups = container.querySelectorAll(getCssSelector('series'));
    expect(seriesGroups.length).toBe(2);
    for (const group of seriesGroups) {
      expect(group.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('keeps the interactive stops outside the hidden regions', () => {
    const container = mountChart(makeConfig());
    const plotRect = container.querySelector(getCssSelector('seriesBackground') + ' rect')!;
    expect(plotRect.getAttribute('tabindex')).toBe('0');
    expect(plotRect.closest('[aria-hidden="true"]')).toBeNull();

    const legendItem = container.querySelector('[data-series-id]')!;
    expect(legendItem.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('hides pie slices from assistive tech', () => {
    const container = mountChart(makeConfig({ chart: { type: 'pie' } }));
    const slices = container.querySelectorAll(getCssSelector('series'));
    expect(slices.length).toBe(2);
    for (const slice of slices) {
      expect(slice.getAttribute('aria-hidden')).toBe('true');
    }
    expect(container.querySelector('svg')!.getAttribute('role')).toBe('group');
  });

  it('tags the chart root with the accessible state class only when enabled', () => {
    const onContainer = mountChart(makeConfig());
    expect(onContainer.querySelector(getCssSelector('chart'))!.classList.contains(getCssClass('accessible'))).toBe(true);

    const offContainer = mountChart(makeConfig({ accessibility: { enabled: false } }));
    expect(offContainer.querySelector(getCssSelector('chart'))!.classList.contains(getCssClass('accessible'))).toBe(false);
  });

  it('renders without any aria semantics when chart accessibility is disabled', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales' }, accessibility: { enabled: false } }));
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-roledescription')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
    expect(container.querySelectorAll('[aria-hidden], [role], [tabindex], [aria-label]').length).toBe(0);
  });

  it('renders a pie without any aria semantics when chart accessibility is disabled', () => {
    const container = mountChart(makeConfig({ chart: { type: 'pie' }, accessibility: { enabled: false } }));
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
    expect(container.querySelectorAll('[aria-hidden], [role], [tabindex], [aria-label]').length).toBe(0);
  });
});

describe('title text in the reading order', () => {
  it('hides the drawn title text because the svg is already named from it', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales', prefix: { text: 'Q1' } } }));
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe('Monthly sales');
    expect(container.querySelector(getCssSelector('titleText'))!.getAttribute('aria-hidden')).toBe('true');
    // the prefix is not part of the svg name, so it still reads
    expect(container.querySelector(getCssSelector('titlePrefix'))!.getAttribute('aria-hidden')).toBeNull();
  });

  it('keeps a linked title\'s text readable, since that text names the link', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales', link: 'https://example.com' } }));
    expect(container.querySelector(getCssSelector('titleText'))!.getAttribute('aria-hidden')).toBeNull();
  });
});

// Regression: the title got an onClick with no tabindex, role or key handler, so onTitleClick was pointer-only
describe('clickable title', () => {
  it('exposes button semantics and fires on Enter and Space', () => {
    const clicks: number[] = [];
    const container = mountChart(
      makeConfig({ title: { text: 'Monthly sales', prefix: { text: 'Q1' } } }),
      { onTitleClick: () => { clicks.push(1); } });
    const title = container.querySelector(getCssSelector('title'))!;
    expect(title.getAttribute('tabindex')).toBe('0');
    expect(title.getAttribute('role')).toBe('button');
    expect(title.getAttribute('aria-label')).toBe('Q1 Monthly sales');

    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    title.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(clicks.length).toBe(2);

    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(clicks.length).toBe(2);
  });

  it('leaves a title with no click handler inert', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales' } }));
    const title = container.querySelector(getCssSelector('title'))!;
    expect(title.getAttribute('tabindex')).toBeNull();
    expect(title.getAttribute('role')).toBeNull();
  });

  it('leaves a linked title to its anchor rather than nesting a second control', () => {
    const container = mountChart(
      makeConfig({ title: { text: 'Monthly sales', link: 'https://example.com' } }),
      { onTitleClick: () => {} });
    const title = container.querySelector(getCssSelector('title'))!;
    expect(title.getAttribute('role')).toBeNull();
    expect(container.querySelector(getCssSelector('title') + ' a')).not.toBeNull();
  });

  it('adds no tab stop when accessibility is off', () => {
    const container = mountChart(
      makeConfig({ title: { text: 'Monthly sales' }, accessibility: { enabled: false } }),
      { onTitleClick: () => {} });
    expect(container.querySelector(getCssSelector('title'))!.getAttribute('tabindex')).toBeNull();
  });
});

describe('decorative-hidden charts', () => {
  // covers everything natively focusable, not just [tabindex]: an svg <a href> takes focus with no tabindex at all
  const FOCUSABLE = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]']
    .map((selector) => `${selector}:not([tabindex="-1"])`).join(', ');

  it('hides the chart root from assistive tech and removes every tab stop it controls', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales' }, accessibility: { hidden: true } }));
    const root = container.querySelector(getCssSelector('chart'))!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.classList.contains(getCssClass('accessible'))).toBe(false);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelectorAll(FOCUSABLE).length).toBe(0);
  });

  it('takes a linked title out of the tab order', () => {
    const container = mountChart(makeConfig({
      title: { text: 'Monthly sales', link: 'https://example.com' },
      accessibility: { hidden: true }
    }));
    const anchor = container.querySelector(getCssSelector('title') + ' a')!;
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.getAttribute('tabindex')).toBe('-1');
    expect(container.querySelectorAll(FOCUSABLE).length).toBe(0);
  });

  it('leaves a linked title focusable on an ordinary chart', () => {
    const container = mountChart(makeConfig({ title: { text: 'Monthly sales', link: 'https://example.com' } }));
    expect(container.querySelector(getCssSelector('title') + ' a')!.getAttribute('tabindex')).toBeNull();
  });

  it('hides a pie chart and its slice tab stops', () => {
    const container = mountChart(makeConfig({ chart: { type: 'pie' }, accessibility: { hidden: true } }));
    expect(container.querySelector(getCssSelector('chart'))!.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll(getCssSelector('series')).length).toBe(2);
    expect(container.querySelectorAll(FOCUSABLE + ', [role="button"]').length).toBe(0);
  });

  it('keeps the chart exposed and announced by default', () => {
    const container = mountChart(makeConfig());
    expect(container.querySelector(getCssSelector('chart'))!.getAttribute('aria-hidden')).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
