/**
 * The category axis tick labels of each kind clip to a rect of their own: the minor labels' rect is built
 * from the minor truncation, rotation and anchor, and a kind whose truncation is off references no clip.
 * A single rect from the major settings left minor labels referencing a clip that was never emitted when only
 * minorTickLabel.truncation was enabled (so nothing rendered), and cut rotated minor labels at the unrotated major box.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { installSvgMeasurementShims } from './svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from './helpers';
import { getCssSelector, getDescendantCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

const data = Array.from({ length: 12 }, (_, i) => ({ label: 'category number ' + (i + 1), value: 1 }));

function renderChart(tickLabel: Record<string, unknown>, minorTickLabel: Record<string, unknown> = {}): HTMLElement {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', tickStep: { count: 3 }, tickLabel, minorTickLabel },
    valueAxes: [{ id: 'va', min: 0, max: 3, visible: false }],
    series: [{ axis: 'va', property: 'value', renderer: 'bar' }]
  });
  expect(mochartConfig.validation.errors).toEqual([]);
  const container = mountContainer();
  createChart(container, { mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(data), width: 1200, height: 200 });
  runFrames();
  return container;
}

const majorClipPrefix = 'categoryaxisticklabel__clippath__';
const minorClipPrefix = 'categoryaxisminorticklabel__clippath__';
const labelSelector = getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel');
const minorSelector = getCssSelector('axisMinorTickLabel');

function clipReferences(container: HTMLElement, minor: boolean): (string | null)[] {
  return Array.from(container.querySelectorAll(labelSelector + (minor ? minorSelector : ':not(' + minorSelector + ')')))
    .map(group => group.getAttribute('clip-path'));
}

function clipRect(container: HTMLElement, idPrefix: string): SVGRectElement | null {
  return container.querySelector<SVGRectElement>('clipPath[id^="' + idPrefix + '"] rect');
}

describe('category axis tick label clips', () => {
  it('references a minor clip that exists when only minorTickLabel.truncation is enabled, and no major clip', () => {
    const container = renderChart({ truncation: { enabled: false } }, { visible: true, truncation: { enabled: true } });
    const minorReferences = clipReferences(container, true);
    expect(minorReferences.length).toBeGreaterThan(0);
    expect(clipRect(container, minorClipPrefix)).not.toBeNull();
    expect(clipRect(container, majorClipPrefix)).toBeNull();
    for (const reference of minorReferences) {
      expect(reference).toContain(minorClipPrefix);
    }
    for (const reference of clipReferences(container, false)) {
      expect(reference).toBeNull();
    }
  });

  it('builds the minor clip rect from the minor rotation, leaving the major rect unrotated', () => {
    const container = renderChart({ rotation: 0, truncation: { enabled: true } }, { visible: true, rotation: -60 });
    expect(clipRect(container, majorClipPrefix)!.getAttribute('transform')).toBeNull();
    expect(clipRect(container, minorClipPrefix)!.getAttribute('transform')).toBe('rotate(-60)');
    for (const reference of clipReferences(container, false)) {
      expect(reference).toContain(majorClipPrefix);
    }
    for (const reference of clipReferences(container, true)) {
      expect(reference).toContain(minorClipPrefix);
    }
  });

  // the minor room started at Infinity and only a labelled neighbour narrowed it, so the rect read x="-Infinity" width="Infinity"
  it('keeps the minor clip rect finite for a lone minor label and for no minor label', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    for (const categoryAxis of [
      { ticks: [{ value: 'c1', minor: true }] },
      { tickStep: { count: 2, offset: 1 }, minorTickLabel: { visible: true } },
      { ticks: [{ value: 'c0' }, { value: 'c2', label: 'C!' }] }
    ]) {
      const mochartConfig = enhanceConfig({
        version: '1.0.0',
        animation: { enabled: false },
        categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', ...categoryAxis },
        series: [{ property: 'value', renderer: 'bar' }]
      });
      const container = mountContainer();
      const rows = ['c0', 'c1', 'c2'].map((label, i) => ({ label, value: i + 1 }));
      createChart(container, { mochartConfig, dataProvider: new ArrayOfObjectsDataProvider(rows), width: 800, height: 600 });
      runFrames();
      const rect = clipRect(container, minorClipPrefix)!;
      expect(Number.isFinite(Number(rect.getAttribute('x')))).toBe(true);
      expect(Number(rect.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number.isFinite(Number(rect.getAttribute('width')))).toBe(true);
    }
  });

  it('emits no minor clip while no minor labels show', () => {
    const container = renderChart({ truncation: { enabled: true } });
    expect(clipRect(container, majorClipPrefix)).not.toBeNull();
    expect(clipRect(container, minorClipPrefix)).toBeNull();
  });
});
