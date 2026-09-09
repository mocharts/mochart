/**
 * Data-tween hot path: a value-only update (same categories/domains) must not remeasure DOM text per frame.
 * Unlike other suites the shims return non-zero sizes, so bounds are real and the remeasure-retry path stays quiet.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installFakeFrameClock, runFrames, mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const VERSION = '1.0.0';
const WIDTH = 800;
const HEIGHT = 600;

let textMeasureCalls = 0;

function installCountingMeasurementShims(): void {
  // Cast: these text-measurement methods live on SVGTextContentElement in the
  // DOM lib, not the SVGElement base prototype we shim here.
  const svgProto = globalThis.SVGElement.prototype as any;
  svgProto.getComputedTextLength = () => { textMeasureCalls++; return 40; };
  svgProto.getSubStringLength = () => { textMeasureCalls++; return 40; };
  svgProto.getBBox = () => { textMeasureCalls++; return { x: 0, y: 0, width: 40, height: 12 }; };
}

const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

// same months, same min/max — value-only change with identical domains
const reversedRows = [
  { month: 'Jan', sales: 30 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 10 }
];

// different category labels — tick text changes, so a remeasure is required
const renamedRows = [
  { month: 'April', sales: 10 },
  { month: 'May', sales: 20 },
  { month: 'June', sales: 30 }
];

function makeConfig(): MochartInputConfig {
  return {
    version: VERSION,
    animation: { enabled: true },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ property: 'sales' }]
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');

beforeAll(async () => {
  installCountingMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  installFakeFrameClock();
  mochart = await import('../../src');
});

function mountChart(data: readonly unknown[] = rows) {
  const container = mountContainer();
  const handle = trackHandle(mochart.createDefaultChart(container, {
    config: makeConfig(), data, width: WIDTH, height: HEIGHT
  } as DefaultChartProps));
  return { container, handle };
}

describe('data tween hot path', () => {
  it('does not remeasure text during a value-only data tween', () => {
    const { container, handle } = mountChart();
    runFrames();
    expect(vi.getTimerCount()).toBe(0);
    const settledHtml = container.innerHTML;

    textMeasureCalls = 0;
    handle.update({ data: reversedRows } as Partial<DefaultChartProps>);
    const frames = runFrames();

    expect(frames).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    // the tween re-rendered the series with the new values...
    expect(container.innerHTML).not.toBe(settledHtml);
    // ...without a single per-frame DOM text measurement
    expect(textMeasureCalls).toBe(0);
  });

  it('still remeasures when a data change alters the rendered tick text', () => {
    const { handle } = mountChart();
    runFrames();

    textMeasureCalls = 0;
    handle.update({ data: renamedRows } as Partial<DefaultChartProps>);
    runFrames();

    expect(textMeasureCalls).toBeGreaterThan(0);
  });
});
