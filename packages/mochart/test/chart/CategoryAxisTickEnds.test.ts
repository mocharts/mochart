/**
 * The ends of a category axis: a parallel label that would spill past either end is hidden, each kind tested with
 * its own width and anchor on ordinal and linear axes alike, and the single-label fallback shows once no label of
 * either kind does.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installTextMetrics } from '../golden/textMetrics';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installTextMetrics();
  installFakeFrameClock();
  mochart = await import('../../src');
});

function renderChart(categoryAxisConfig: Record<string, unknown>, labels: (string | number)[], width: number) {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', ...categoryAxisConfig },
    valueAxes: [{ id: 'va', min: 0, max: 3, visible: false }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.errors).toEqual([]);
  const container = mountContainer();
  const chart = createChart(container, {
    mochartConfig,
    dataProvider: new ArrayOfObjectsDataProvider(labels.map(label => ({ label, value: 1 }))),
    width,
    height: 200
  });
  runFrames();
  return { container, chart };
}

const tickLabels = getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel');
const minorLabel = getCssSelector('axisMinorTickLabel');

/** The shown labels of one kind (minor or not). */
function getKindLabels(container: HTMLElement, minor: boolean): string[] {
  return Array.from(container.querySelectorAll(tickLabels + (minor ? minorLabel : ':not(' + minorLabel + ')') + ' text'))
    .filter(text => (text as SVGElement & { style: CSSStyleDeclaration }).style.visibility !== 'hidden')
    .map(text => text.textContent ?? '')
    .filter(label => label !== '');
}

describe('minor tick labels at the axis ends', () => {
  const wide = 'mmmmmmmmmmmmmmmmmmmm';
  const labels = ['a', wide, 'b', wide + 'w'];

  it('hides a minor label that would spill past the axis end by its own width and anchor', () => {
    // every second category is a minor tick; the wide minor labels start at their category, so the last one runs past the end
    const { container, chart } = renderChart({ tickStep: { every: 2 }, tickLabel: { truncation: { enabled: false } }, minorTickLabel: { visible: true, anchor: 'start' } }, labels, 1200);
    expect(getKindLabels(container, false)).toEqual(['a', 'b']);
    expect(getKindLabels(container, true)).toEqual([wide]);
    chart.destroy();
  });

  it('keeps a minor label the major width would have hidden', () => {
    // the wide labels are the majors here; the short minor labels sit well inside the ends
    const { container, chart } = renderChart({ tickStep: { every: 2 }, tickLabel: { truncation: { enabled: false }, anchor: 'start' }, minorTickLabel: { visible: true } }, [wide, 'a', wide + 'w', 'b'], 1200);
    expect(getKindLabels(container, true)).toEqual(['a', 'b']);
    chart.destroy();
  });
});

describe('minor tick labels at the ends of a linear axis', () => {
  // a 20-decimal format makes a label far wider than the plain one; categories 0 to 40 with no slot padding put 40 on the plot edge, and tickCount 3 keeps every step tick
  const wide = '.20f';
  const linear = { type: 'number', scale: 'linear', min: 0, max: 40, categoryCountPadding: 0, tickCount: 3, tickStep: { interval: 20, minorSteps: 2 } };
  const values = [0, 10, 20, 30, 40];

  it('hides a minor label that would spill past the axis end by its own width and anchor', () => {
    // the minor labels start at their tick, so the one at 30 runs past the end while the narrow major labels would not; the end majors spill by half their width
    const { container, chart } = renderChart({ ...linear, tickLabel: { format: '.0f' }, minorTickLabel: { visible: true, format: wide, anchor: 'start' } }, values, 600);
    expect(getKindLabels(container, false)).toEqual(['20']);
    expect(getKindLabels(container, true)).toEqual([(10).toFixed(20)]);
    chart.destroy();
  });

  it('keeps a minor label the major width would have hidden', () => {
    // the wide labels are the majors here, anchored at their tick; the short minor labels sit well inside the ends
    const { container, chart } = renderChart({ ...linear, tickLabel: { format: wide, anchor: 'start' }, minorTickLabel: { visible: true, format: '.0f' } }, values, 600);
    expect(getKindLabels(container, false)).toEqual([(0).toFixed(20), (20).toFixed(20)]);
    expect(getKindLabels(container, true)).toEqual(['10', '30']);
    chart.destroy();
  });
});

describe('the single-label fallback with a tick step', () => {
  const labels = ['category-1', 'category-2', 'category-3', 'category-4', 'category-5', 'category-6'];

  it('shows one label when the step leaves no label of either kind, as the same axis without a step does', () => {
    const withStep = renderChart({ tickStep: { every: 6 }, tickLabel: { truncation: { enabled: false } }, minorTickLabel: { visible: true } }, labels, 250);
    const withoutStep = renderChart({ tickLabel: { truncation: { enabled: false } } }, labels, 250);
    expect(getKindLabels(withoutStep.container, false).length).toBe(1);
    expect(getKindLabels(withStep.container, true)).toEqual([]);
    expect(getKindLabels(withStep.container, false)).toEqual(getKindLabels(withoutStep.container, false));
    withStep.chart.destroy();
    withoutStep.chart.destroy();
  });
});
