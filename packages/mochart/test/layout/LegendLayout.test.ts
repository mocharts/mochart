import { describe, expect, it } from 'vitest';
import { getLegendHeight, getLegendLayoutInfo, resolveLegendIconSize } from '../../src/layout/LegendLayout';
import type { LegendConfig } from '../../src/types/config';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { ChartTextBoundsData, LayoutInfo } from '../../src/types/layout';

describe('legend icon sizing', () => {
  it('uses the measured font size for auto and preserves the placeholder fallback', () => {
    const automatic = { icon: { size: 'auto' } } as LegendConfig;

    expect(resolveLegendIconSize(automatic, { width: 80, height: 20, fontSize: 16 })).toBe(16);
    expect(resolveLegendIconSize(automatic, { width: 80, height: 18, fontSize: 15.2 })).toBe(15);
    expect(resolveLegendIconSize(automatic, { width: 20, height: 20, fontSize: 16, default: true })).toBe(14);
    expect(resolveLegendIconSize(automatic, { width: 0, height: 0, empty: true })).toBe(14);
  });

  it('falls back to the measured text height when no font size was captured', () => {
    const automatic = { icon: { size: 'auto' } } as LegendConfig;

    expect(resolveLegendIconSize(automatic, { width: 80, height: 18 })).toBe(18);
  });

  it('preserves an explicit pixel size', () => {
    const fixed = { icon: { size: 12 } } as LegendConfig;

    expect(resolveLegendIconSize(fixed, { width: 80, height: 18 })).toBe(12);
  });
});

// legend.truncation.maxFraction limits how much of the legend width one item may take, so a long
// title truncates and shares its row instead of wrapping onto a row of its own
describe('legend item width limit', () => {
  const CONTENT_WIDTH = 300;
  const ICON_SIZE = 10;
  const TEXT_HEIGHT = 12;

  function mochartConfig(maxFraction: number, ids: string[]): EnhancedMochartConfig {
    const zero = { top: 0, right: 0, bottom: 0, left: 0 };
    return {
      series: ids.map(id => ({ id, showInLegend: true })),
      seriesById: Object.fromEntries(ids.map(id => [id, { followSeries: null, filterable: false }])),
      accessibility: { minTargetSize: 0 },
      legend: {
        visible: true, alignedToAxes: false, align: 'left',
        margin: zero, padding: zero,
        item: { margin: zero, padding: zero },
        icon: { size: ICON_SIZE, spacing: 0 },
        truncation: { enabled: true, text: '…', tooltipEnabled: true, maxFraction },
        filterOnClick: false, focusOnClick: false
      }
    } as unknown as EnhancedMochartConfig;
  }

  // titles too wide to share a row at their measured width
  function textBounds(ids: string[]): ChartTextBoundsData {
    return {
      legendItemMaxTextBounds: { width: 200, height: TEXT_HEIGHT },
      legendItemTextRawBounds: Object.fromEntries(ids.map(id => [id, { width: 200, height: TEXT_HEIGHT }]))
    } as unknown as ChartTextBoundsData;
  }
  const contentBounds = { x: 0, y: 0, width: CONTENT_WIDTH, height: 200 };
  const plotBounds = { x: 0, y: 0, width: CONTENT_WIDTH, height: 200 } as unknown as LayoutInfo;

  function layout(maxFraction: number, ids = ['a', 'b']) {
    const config = mochartConfig(maxFraction, ids);
    const bounds = textBounds(ids);
    const height = getLegendHeight(config, bounds, contentBounds, plotBounds);
    return { height, ...getLegendLayoutInfo(config, bounds, contentBounds, plotBounds, height, 0) };
  }

  it('gives each item its measured width at the default fraction, wrapping the second onto its own row', () => {
    const { height, legendItemLayoutInfos } = layout(1);

    expect(legendItemLayoutInfos!.map(info => info.width)).toEqual([210, 210]);
    expect(legendItemLayoutInfos!.map(info => info.y)).toEqual([0, TEXT_HEIGHT]);
    expect(height).toBe(TEXT_HEIGHT * 2);
  });

  it('limits both items to half the legend width and fits them on one row', () => {
    const { height, legendItemLayoutInfos } = layout(0.5);

    expect(legendItemLayoutInfos!.map(info => info.width)).toEqual([150, 150]);
    expect(legendItemLayoutInfos!.map(info => info.y)).toEqual([0, 0]);
    expect(height).toBe(TEXT_HEIGHT);
  });

  it('fits three items to a row at a third, as the reference says, where 0.34 wraps the third', () => {
    const third = layout(1 / 3, ['a', 'b', 'c']);
    expect(third.legendItemLayoutInfos!.map(info => info.width)).toEqual([100, 100, 100]);
    expect(third.legendItemLayoutInfos!.map(info => info.y)).toEqual([0, 0, 0]);
    expect(third.height).toBe(TEXT_HEIGHT);

    const over = layout(0.34, ['a', 'b', 'c']);
    expect(over.legendItemLayoutInfos!.map(info => info.y)).toEqual([0, 0, TEXT_HEIGHT]);
  });

  it('holds the shared truncation width to the limit, so a limited item cannot draw past its own box', () => {
    // without the limit the shared width follows the widest row, which is one 210px item
    expect(layout(1).legendItemTextLayoutInfo!.width).toBe(210 - ICON_SIZE);
    // with the limit, the row is the full 300 wide but no item may draw wider than half of it
    expect(layout(0.5).legendItemTextLayoutInfo!.width).toBe(CONTENT_WIDTH / 2 - ICON_SIZE);
  });
});
