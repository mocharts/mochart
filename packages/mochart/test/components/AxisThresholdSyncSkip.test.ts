/**
 * Pointer tracking re-syncs the Chart on every move, but threshold lines only re-sync when their own
 * inputs changed: the resolved thresholds are cached by config identity and the position ranges are
 * kept while config and domain hold, so moves inside one category skip every AxisThresholdLine.
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
    valueAxes: [{ id: 'VA0', min: 0, max: 40, thresholds: [{ value: 25 }, { value: 15, front: true }] }],
    series: [{ id: 'S0', property: 'sales', axis: 'VA0', renderer: 'bar' }]
  } as unknown as MochartInputConfig;
}

let mochart: typeof import('../../src');
let syncSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  installFakeFrameClock();
  installSvgMeasurementShims();
  mockBoundingClientRect(WIDTH, HEIGHT);
  mochart = await import('../../src');
  const { default: AxisThresholdLine } = await import('../../src/components/AxisThresholdLine');
  syncSpy = vi.spyOn(AxisThresholdLine.prototype, 'sync');
});

function mouse(target: Element, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

describe('threshold line sync while the tooltip tracks the pointer', () => {
  it('skips every threshold line while category crossings re-sync the plot', () => {
    const container = mountContainer();
    trackHandle(mochart.createDefaultChart(container, { config: makeConfig(), data: rows, width: WIDTH, height: HEIGHT } as DefaultChartProps));
    runFrames();
    expect(container.querySelectorAll(getCssSelector('axisThreshold')).length).toBeGreaterThan(0);
    const root = container.querySelector(getChartRootCssSelector())!;
    mouse(root, 'mouseenter', 100, 300);
    mouse(root, 'mousemove', 100, 300);
    const tooltip = container.querySelector(getCssSelector('tooltip'))!;

    // crossing categories changes the focused category, which re-syncs the plot subtree
    const before = syncSpy.mock.calls.length;
    for (const [x, month] of [[400, 'Feb'], [700, 'Mar'], [100, 'Jan']] as const) {
      mouse(root, 'mousemove', x, 300);
      expect(tooltip.textContent).toContain(month);
    }
    runFrames();
    expect(syncSpy.mock.calls.length).toBe(before);
  });
});
