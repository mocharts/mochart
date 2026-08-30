/**
 * A chart mounted where text cannot be measured (a hidden container) retries via updateTextSizes once
 * it can; that layout commit must notify onSeriesLayoutBoundsChange like every other layout change.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mountContainer, trackHandle } from './helpers';
import { installTextMetrics } from '../golden/textMetrics';
import { createDefaultChart } from '../../src/createChart';
import type { Bounds } from '../../src/types/geometry';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';

const config = {
  version: '1.0.0',
  animation: { enabled: false },
  title: { text: 'Quarterly revenue by region' },
  legend: { visible: true },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  series: [{ id: 'S0', property: 'sales', title: 'A long series title for the legend' }]
} as unknown as MochartInputConfig;

// simulates a hidden container: nothing measures until the reveal
let revealed = false;

beforeAll(() => {
  installTextMetrics();
  const svgProto = globalThis.SVGElement.prototype as unknown as {
    getComputedTextLength: (this: SVGElement) => number;
    getBBox: (this: SVGElement) => { x: number; y: number; width: number; height: number };
  };
  const measure = svgProto.getComputedTextLength;
  const box = svgProto.getBBox;
  // 3x once revealed: the revealed sizes must clear the 20px default-bounds fallback by more than rounding,
  // or the series area lands where the defaults put it and no bounds notification is due
  svgProto.getComputedTextLength = function (this: SVGElement): number {
    return revealed ? measure.call(this) * 3 : 0;
  };
  svgProto.getBBox = function (this: SVGElement) {
    if (!revealed) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const bounds = box.call(this);
    return { x: bounds.x, y: bounds.y, width: bounds.width * 3, height: bounds.height * 3 };
  };
});

describe('text remeasure after the container is revealed', () => {
  it('notifies onSeriesLayoutBoundsChange when the retry commits the real layout', () => {
    revealed = false;
    const boundsCalls: Bounds[] = [];
    const container = mountContainer();
    const handle = trackHandle(createDefaultChart(container, {
      config, data: null, loading: true, width: 800, height: 600,
      onSeriesLayoutBoundsChange: (bounds: Bounds) => { boundsCalls.push(bounds); }
    } as unknown as DefaultChartProps));
    expect(container.textContent).toContain('Quarterly revenue by region');
    const mountCalls = boundsCalls.length;

    revealed = true;
    handle.update({ loading: false } as Partial<DefaultChartProps>);
    expect(boundsCalls.length).toBe(mountCalls + 1);
  });
});
