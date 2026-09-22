/**
 * The ends of an ordinal category axis: a parallel label that would spill past either end is hidden, each kind
 * tested with its own width and anchor, and the single-label fallback shows once no label of either kind does.
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

function renderChart(categoryAxisConfig: Record<string, unknown>, labels: string[], width: number) {
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
    const { container, chart } = renderChart({ tickStep: { count: 2 }, tickLabel: { truncation: { enabled: false }, minorVisible: true, minorAnchor: 'start' } }, labels, 1200);
    expect(getKindLabels(container, false)).toEqual(['a', 'b']);
    expect(getKindLabels(container, true)).toEqual([wide]);
    chart.destroy();
  });

  it('keeps a minor label the major width would have hidden', () => {
    // the wide labels are the majors here; the short minor labels sit well inside the ends
    const { container, chart } = renderChart({ tickStep: { count: 2 }, tickLabel: { truncation: { enabled: false }, minorVisible: true, anchor: 'start' } }, [wide, 'a', wide + 'w', 'b'], 1200);
    expect(getKindLabels(container, true)).toEqual(['a', 'b']);
    chart.destroy();
  });
});

describe('the single-label fallback with a tick step', () => {
  const labels = ['category-1', 'category-2', 'category-3', 'category-4', 'category-5', 'category-6'];

  it('shows one label when the step leaves no label of either kind, as the same axis without a step does', () => {
    const withStep = renderChart({ tickStep: { count: 6 }, tickLabel: { truncation: { enabled: false }, minorVisible: true } }, labels, 250);
    const withoutStep = renderChart({ tickLabel: { truncation: { enabled: false } } }, labels, 250);
    expect(getKindLabels(withoutStep.container, false).length).toBe(1);
    expect(getKindLabels(withStep.container, true)).toEqual([]);
    expect(getKindLabels(withStep.container, false)).toEqual(getKindLabels(withoutStep.container, false));
    withStep.chart.destroy();
    withoutStep.chart.destroy();
  });
});
