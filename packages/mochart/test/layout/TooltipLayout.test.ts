import { describe, expect, it } from 'vitest';
import { fitRectangleWithinRectangle, getTooltipLayoutInfo } from '../../src/layout/TooltipLayout';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { ChartLayoutInfo } from '../../src/types/layout';

const mochartConfig = {
  tooltip: {
    keepInside: true,
    snapToCategory: false,
    backgroundStyle: { strokeWidth: null },
    padding: { top: 0, right: 0, bottom: 0, left: 0 }
  },
  plot: { inverted: false }
} as unknown as EnhancedMochartConfig;

// Regression: the keepInside clamp rectangle's y was computed from the chart
// content's x, so any layout where the content origin is asymmetric (x !== y)
// clamped the tooltip into a vertically shifted band.
const layoutInfo = {
  chartContentLayoutInfo: { x: 0, y: 100 },
  seriesLayoutInfo: { x: 10, y: 20, width: 200, height: 100, categoryExtent: 200, valueExtent: 100 },
  containerLayoutInfo: { x: 0, y: 0, width: 400, height: 400 }
} as unknown as ChartLayoutInfo;

describe('tooltip keepInside clamping', () => {
  it('clamps to the plot top-left at the correct vertical origin', () => {
    const bounds = getTooltipLayoutInfo(mochartConfig, { width: 40, height: 30 }, layoutInfo, { positions: [] }, -1, 0, 0);
    expect(bounds).toEqual({ x: 10, y: 120, width: 40, height: 30 });
  });

  it('clamps to the plot bottom-right edges', () => {
    const bounds = getTooltipLayoutInfo(mochartConfig, { width: 40, height: 30 }, layoutInfo, { positions: [] }, -1, 1, 1);
    expect(bounds).toEqual({ x: 170, y: 190, width: 40, height: 30 });
  });
});

describe('snapToCategory with no category to snap to', () => {
  const snapping = { ...mochartConfig, tooltip: { ...mochartConfig.tooltip, snapToCategory: true } } as EnhancedMochartConfig;

  // Regression: index -1 (the closed tooltip) read positions[-1] and stored NaN bounds in the chart state
  it('returns the default layout for an index outside the positions, never NaN', () => {
    const closed = getTooltipLayoutInfo(snapping, { width: 40, height: 30 }, layoutInfo, { positions: [20, 60, 100] }, -1, 0, 0);
    const gone = getTooltipLayoutInfo(snapping, { width: 40, height: 30 }, layoutInfo, { positions: [20, 60, 100] }, 3, 0, 0);
    expect(closed).toEqual(getTooltipLayoutInfo(snapping, null));
    expect(gone).toEqual(getTooltipLayoutInfo(snapping, null));
    expect(Object.values(closed).every(Number.isFinite)).toBe(true);
  });

  it('still snaps to a category that is there', () => {
    const bounds = getTooltipLayoutInfo(snapping, { width: 40, height: 30 }, layoutInfo, { positions: [20, 60, 100] }, 1, 0, 0);
    expect(bounds.x).toBe(10 + 60 - 20);
  });
});

describe('fitRectangleWithinRectangle', () => {
  it('keeps a rectangle that fits inside the bounds', () => {
    expect(fitRectangleWithinRectangle({ x: 0, y: 0, width: 200, height: 80 }, { x: 10, y: 10, width: 100, height: 50 }))
      .toEqual({ x: 10, y: 10, width: 100, height: 50 });
  });

  it('pulls a rectangle back inside the max edges', () => {
    expect(fitRectangleWithinRectangle({ x: 0, y: 0, width: 200, height: 80 }, { x: 150, y: 60, width: 100, height: 50 }))
      .toEqual({ x: 100, y: 30, width: 100, height: 50 });
  });

  // Regression: the min clamps ran first, so a rectangle wider or taller than the bounds was
  // pushed back out past the left/top edge by the max clamp.
  it('pins an oversized rectangle to the near edge instead of escaping the opposite one', () => {
    // the finding's case: a 200x80 tooltip inside a 100x50 plot used to land at {-90,-20}
    expect(fitRectangleWithinRectangle({ x: 10, y: 10, width: 100, height: 50 }, { x: 20, y: 20, width: 200, height: 80 }))
      .toEqual({ x: 10, y: 10, width: 200, height: 80 });
    // oversized in one direction only
    expect(fitRectangleWithinRectangle({ x: 10, y: 10, width: 100, height: 500 }, { x: 20, y: 20, width: 200, height: 80 }))
      .toEqual({ x: 10, y: 20, width: 200, height: 80 });
  });
});
