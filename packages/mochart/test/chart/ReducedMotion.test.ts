/**
 * accessibility.respectReducedMotion: with OS prefers-reduced-motion on, the managed chart swaps to
 * the static (instant) data source — unless the config opts out — and follows live preference changes.
 */
import { describe, it, beforeAll, beforeEach, afterEach, expect, vi } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';

let mochart: typeof import('../../src');

class FakeMediaQueryList extends EventTarget {
  matches = false;
  media = '(prefers-reduced-motion: reduce)';
}

let reducedMotionQuery: FakeMediaQueryList;

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

beforeEach(() => {
  reducedMotionQuery = new FakeMediaQueryList();
  vi.stubGlobal('matchMedia', () => reducedMotionQuery);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector } from '../../src/utils/ChartDom';

const config = {
  version: '1.0.0',
  categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
  series: [{ property: 'value', renderer: 'bar' }]
} as unknown as MochartInputConfig;

const configKeepAnimating = {
  ...(config as object),
  accessibility: { respectReducedMotion: false }
} as unknown as MochartInputConfig;

const initialData = () => [
  { label: 'a', value: 1 },
  { label: 'b', value: 3 }
];
const changedData = () => [
  { label: 'a', value: 5 },
  { label: 'b', value: 3 }
];

function barPaths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('path' + getCssSelector('seriesBar')))
    .map(path => path.getAttribute('d') ?? '');
}

/** The settled bar geometry of a chart mounted directly with the given data. */
function settledPaths(chartConfig: MochartInputConfig, data: Record<string, unknown>[]): string[] {
  const container = mountContainer();
  const chart = mochart.createDefaultChart(container, { config: chartConfig, data, width: 300, height: 200 });
  runFrames();
  const paths = barPaths(container);
  chart.destroy();
  container.remove();
  return paths;
}

describe('accessibility.respectReducedMotion', () => {
  it('applies data changes instantly when the system prefers reduced motion', () => {
    reducedMotionQuery.matches = true;
    const finalPaths = settledPaths(config, changedData());

    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, { config, data: initialData(), width: 300, height: 200 });
    runFrames();
    chart.update({ data: changedData() });
    expect(barPaths(container)).toEqual(finalPaths); // no frames advanced: instant
    chart.destroy();
  });

  it('keeps animating when respectReducedMotion is false', () => {
    reducedMotionQuery.matches = true;
    const finalPaths = settledPaths(configKeepAnimating, changedData());

    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, { config: configKeepAnimating, data: initialData(), width: 300, height: 200 });
    runFrames();
    chart.update({ data: changedData() });
    expect(barPaths(container)).not.toEqual(finalPaths); // tween in flight
    runFrames();
    expect(barPaths(container)).toEqual(finalPaths);
    chart.destroy();
  });

  it('follows a live preference change without re-creating the chart', () => {
    const finalPaths = settledPaths(config, changedData());

    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, { config, data: initialData(), width: 300, height: 200 });
    runFrames();

    reducedMotionQuery.matches = true;
    reducedMotionQuery.dispatchEvent(new Event('change'));
    chart.update({ data: changedData() });
    expect(barPaths(container)).toEqual(finalPaths); // no frames advanced: instant

    chart.destroy();
    reducedMotionQuery.dispatchEvent(new Event('change')); // listener removed: no throw
  });

  // Regression: swapping back to the animated source restarted it from scratch, so the settled chart
  // blanked for a frame and re-grew every bar over the entrance animation
  it('keeps the settled chart on screen when animation is switched back on', () => {
    reducedMotionQuery.matches = true;
    const container = mountContainer();
    const chart = mochart.createDefaultChart(container, { config, data: initialData(), width: 300, height: 200 });
    runFrames();
    const settled = barPaths(container);
    expect(settled.length).toBeGreaterThan(0);

    reducedMotionQuery.matches = false;
    reducedMotionQuery.dispatchEvent(new Event('change'));

    // the same geometry, still drawn: no blank frame and no entrance replay
    expect(barPaths(container)).toEqual(settled);
    expect(container.querySelector(getCssSelector('noData'))).toBeNull();
    runFrames();
    expect(barPaths(container)).toEqual(settled);

    chart.destroy();
  });
});
