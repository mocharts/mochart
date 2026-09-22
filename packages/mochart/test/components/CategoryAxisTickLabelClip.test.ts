/**
 * The category axis tick labels of each kind clip to a rect of their own: the minor labels' rect is built
 * from the minor truncation, rotation and anchor, and a kind whose truncation is off references no clip.
 * A single rect from the major settings left minor labels referencing a clip that was never emitted when only
 * minorTruncation was enabled (so nothing rendered), and cut rotated minor labels at the unrotated major box.
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

function renderChart(tickLabel: Record<string, unknown>): HTMLElement {
  const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
  const mochartConfig = enhanceConfig({
    version: '1.0.0',
    animation: { enabled: false },
    categoryAxis: { property: 'label', type: 'string', scale: 'ordinal', tickStep: { count: 3 }, tickLabel },
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
  it('references a minor clip that exists when only minorTruncation is enabled, and no major clip', () => {
    const container = renderChart({ minorVisible: true, truncation: { enabled: false }, minorTruncation: { enabled: true } });
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
    const container = renderChart({ minorVisible: true, rotation: 0, minorRotation: -60, truncation: { enabled: true } });
    expect(clipRect(container, majorClipPrefix)!.getAttribute('transform')).toBeNull();
    expect(clipRect(container, minorClipPrefix)!.getAttribute('transform')).toBe('rotate(-60)');
    for (const reference of clipReferences(container, false)) {
      expect(reference).toContain(majorClipPrefix);
    }
    for (const reference of clipReferences(container, true)) {
      expect(reference).toContain(minorClipPrefix);
    }
  });

  it('emits no minor clip while no minor labels show', () => {
    const container = renderChart({ truncation: { enabled: true } });
    expect(clipRect(container, majorClipPrefix)).not.toBeNull();
    expect(clipRect(container, minorClipPrefix)).toBeNull();
  });
});
