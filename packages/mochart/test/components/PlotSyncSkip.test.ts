/**
 * Pointer tracking re-syncs the Chart on every move, but the Plot only re-syncs when one of its own props
 * changed: the a11y props object is kept while the plot label and expanded state hold, so moves inside one
 * category skip the whole plot subtree.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installFakeFrameClock, runFrames, mockBoundingClientRect, mountContainer, trackHandle } from './helpers';
import { installSvgMeasurementShims } from './svgShims';
import type { DefaultChartProps } from '../../src/types/chart';
import type { MochartInputConfig } from '../../src/types/config';
import { getCssSelector, getChartRootCssSelector } from '../../src/utils/ChartDom';

const WIDTH = 800;
const HEIGHT = 600;
const rows = [
  { month: 'Jan', sales: 10 },
  { month: 'Feb', sales: 20 },
  { month: 'Mar', sales: 30 }
];

function makeConfig(): MochartInputConfig {
  return {
    version: '1.0.0',
    animation: { enabled: false },
    tooltip: { followPointer: true, snapToCategory: false },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
    series: [{ id: 'S0', property: 'sales', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');
let syncSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  installFakeFrameClock();
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
  const { default: Plot } = await import('../../src/components/Plot');
  syncSpy = vi.spyOn(Plot.prototype, 'sync');
});

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

describe('plot sync while the tooltip tracks the pointer', () => {
  it('skips the plot for moves inside one category and syncs it on a category change', () => {
    const container = mountContainer();
    trackHandle(mochart.createDefaultChart(container, { config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
    runFrames();
    const root = container.querySelector(getChartRootCssSelector())!;
    mouse(root, 'mouseenter', 100, 300);
    mouse(root, 'mousemove', 100, 300);
    const tooltip = container.querySelector(getCssSelector('tooltip'))!;
    expect(tooltip.textContent).toContain('Jan');

    // the first third of the width stays on Jan
    const before = syncSpy.mock.calls.length;
    for (let x = 110; x < 220; x += 20) {
      mouse(root, 'mousemove', x, 300);
    }
    expect(tooltip.textContent).toContain('Jan');
    expect(syncSpy.mock.calls.length).toBe(before);

    // crossing into Feb changes the focused category, which is the plot's business
    mouse(root, 'mousemove', 400, 300);
    expect(tooltip.textContent).toContain('Feb');
    expect(syncSpy.mock.calls.length).toBeGreaterThan(before);
  });
});
