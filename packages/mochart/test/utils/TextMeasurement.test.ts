// Regression: with showInLegend:false series, the expected list used to be every series, so the
// element count never matched and each item fell back to default 20px bounds, mis-sizing the
// legend. Bounds are keyed by series id so a frame-old set can't describe a different series.
import { describe, it, expect } from 'vitest';
import { getChartTextBoundsData, getLegendItemBoundsList, getLegendItemTextRawBounds, getSvgMaxWidthAndHeight, getSvgWidthAndHeight, getTitleTextBounds } from '../../src/utils/TextMeasurement';
import { enhanceConfig } from '../../src';
import type { ChartDomAccessors } from '../../src/types/chart';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';

function makeConfig(showInLegendFlags: boolean[]): EnhancedMochartConfig {
  return enhanceConfig({
    version: '1.0.0',
    categoryAxis: { property: 'label' },
    series: showInLegendFlags.map((showInLegend, i) => ({ property: 'p' + i, showInLegend }))
  } as never) as EnhancedMochartConfig;
}

function fakeTextElement(width: number): SVGGraphicsElement {
  return { getBBox: () => ({ x: 0, y: 0, width, height: 10 }) } as unknown as SVGGraphicsElement;
}

function makeDomAccessors(widths: number[]): ChartDomAccessors {
  return {
    getLegendItemTextRawDomElements: () => widths.map(fakeTextElement)
  } as unknown as ChartDomAccessors;
}

function legendIds(mochartConfig: EnhancedMochartConfig): string[] {
  return mochartConfig.series.filter(seriesConfig => seriesConfig.showInLegend).map(seriesConfig => seriesConfig.id);
}

describe('getLegendItemTextRawBounds', () => {
  it('measures only the showInLegend series, matching the rendered items', () => {
    const mochartConfig = makeConfig([false, false, true, true]);
    // the DOM holds two rendered legend items — one per visible series
    const bounds = getLegendItemTextRawBounds(mochartConfig, makeDomAccessors([30, 50]));
    const [thirdId, fourthId] = legendIds(mochartConfig);
    expect(bounds).toEqual({
      [thirdId]: { width: 30, height: 10 },
      [fourthId]: { width: 50, height: 10 }
    });
  });

  it('measures every series when all are in the legend', () => {
    const mochartConfig = makeConfig([true, true]);
    const bounds = getLegendItemTextRawBounds(mochartConfig, makeDomAccessors([30, 50]));
    const [firstId, secondId] = legendIds(mochartConfig);
    expect(bounds).toEqual({
      [firstId]: { width: 30, height: 10 },
      [secondId]: { width: 50, height: 10 }
    });
  });
});

describe('getLegendItemBoundsList', () => {
  it('lists the measured bounds in legend order', () => {
    const mochartConfig = makeConfig([false, true, true]);
    const bounds = getLegendItemTextRawBounds(mochartConfig, makeDomAccessors([30, 50]));
    expect(getLegendItemBoundsList(mochartConfig, bounds)).toEqual([
      { width: 30, height: 10 },
      { width: 50, height: 10 }
    ]);
  });

  // measuring runs a frame behind drawing, so after showInLegend flips the stored bounds describe the old item set; keyed by id, a series that just joined reads as unmeasured for one frame instead of borrowing another series' size
  it('falls back to unmeasured for a series that just joined the legend', () => {
    const before = makeConfig([false, true]);
    const measured = getLegendItemTextRawBounds(before, makeDomAccessors([50]));
    const after = makeConfig([true, true]);
    expect(getLegendItemBoundsList(after, measured)).toEqual([
      { width: 0, height: 0 },
      { width: 50, height: 10 }
    ]);
  });

  it('ignores bounds for a series that just left the legend', () => {
    const before = makeConfig([true, true]);
    const measured = getLegendItemTextRawBounds(before, makeDomAccessors([30, 50]));
    const after = makeConfig([false, true]);
    expect(getLegendItemBoundsList(after, measured)).toEqual([
      { width: 50, height: 10 }
    ]);
  });
});

describe('getSvgMaxWidthAndHeight', () => {
  const element = (width: number, height: number): SVGGraphicsElement =>
    ({ getBBox: () => ({ x: 0, y: 0, width, height }) } as unknown as SVGGraphicsElement);

  it('measures all-zero bboxes as 0x0 so the default-bounds fallback can trigger', () => {
    // regression: a display:none container reports 0x0 for every element; this
    // must not round up to 1x1 or the re-measure retry loop never runs
    expect(getSvgMaxWidthAndHeight([element(0, 0), element(0, 0)])).toEqual({ width: 0, height: 0 });
  });

  it('takes the per-dimension max over the elements', () => {
    expect(getSvgMaxWidthAndHeight([element(0, 0), element(30.2, 9.5), element(12, 14)])).toEqual({ width: 31, height: 14 });
  });

  it('measures an empty list as 0x0', () => {
    expect(getSvgMaxWidthAndHeight([])).toEqual({ width: 0, height: 0 });
  });
});

// Regression: an element whose text is '' measures 0x0 forever, which used to read as unmeasurable
// (default bounds) — layout reserved a phantom 20x20 and hasDefault re-measured the DOM every render.
describe('empty rendered text', () => {
  const textElement = (textContent: string, width: number, height: number): SVGGraphicsElement =>
    ({ textContent, getBBox: () => ({ x: 0, y: 0, width, height }) } as unknown as SVGGraphicsElement);

  it('measures an empty text element as empty rather than unmeasured', () => {
    expect(getSvgWidthAndHeight(textElement('', 0, 0))).toEqual({ width: 0, height: 0, empty: true });
    expect(getSvgWidthAndHeight(textElement('  ', 0, 0))).toEqual({ width: 0, height: 0, empty: true });
    expect(getSvgWidthAndHeight(textElement('abc', 30, 10))).toEqual({ width: 30, height: 10 });
  });

  it('measures all-empty tick labels as empty, but keeps a hidden non-empty label unmeasured', () => {
    expect(getSvgMaxWidthAndHeight([textElement('', 0, 0), textElement('', 0, 0)])).toEqual({ width: 0, height: 0, empty: true });
    // a display:none container reports 0x0 for text that does exist: still a retry
    expect(getSvgMaxWidthAndHeight([textElement('', 0, 0), textElement('abc', 0, 0)])).toEqual({ width: 0, height: 0 });
  });

  it('does not pin hasDefault or reserve default title space for title.text \'\'', () => {
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      title: { text: '' },
      categoryAxis: { property: 'label', visible: false },
      legend: { visible: false },
      series: [{ property: 'p0' }]
    } as never) as EnhancedMochartConfig;
    const domAccessors = {
      getTitleTextDomElement: () => textElement('', 0, 0),
      getTitleTextRawDomElement: () => textElement('', 0, 0),
      getValueAxisTicksDomElementsForId: () => [textElement('1', 8, 10)],
      getValueAxisThresholdTitleDomElementsForId: () => []
    } as unknown as ChartDomAccessors;
    expect(getTitleTextBounds(mochartConfig, domAccessors)).toEqual({ width: 0, height: 0, empty: true });
    expect(getChartTextBoundsData(mochartConfig, domAccessors).hasDefault).toBe(false);
  });

  // Regression: an axis that draws nothing while its series are filtered was still measured, and the
  // zero-element result read as unmeasurable — pinning hasDefault for as long as the filter was on
  it('does not pin hasDefault for a value axis that draws nothing while all its series are filtered', () => {
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', visible: false },
      legend: { visible: false },
      valueAxes: [{ id: 'v1' }, { id: 'v2', title: { text: 'Hidden' }, visibleWhenAllFiltered: false }],
      series: [{ property: 'p0', axis: 'v1' }, { property: 'p1', axis: 'v2' }]
    } as never) as EnhancedMochartConfig;
    const domAccessors = {
      getValueAxisTicksDomElementsForId: (id: string) => id === 'v1' ? [textElement('1', 8, 10)] : [],
      getValueAxisTitleDomElementForId: () => null,
      getValueAxisThresholdTitleDomElementsForId: () => []
    } as unknown as ChartDomAccessors;

    // v2 draws while it still has a series, so its missing elements are a measurement to retry
    expect(getChartTextBoundsData(mochartConfig, domAccessors, { v1: 1, v2: 1 }).hasDefault).toBe(true);
    // with its series filtered off it draws nothing, so there is nothing to measure and nothing to retry
    expect(getChartTextBoundsData(mochartConfig, domAccessors, { v1: 1, v2: 0 }).hasDefault).toBe(false);
  });

  it('still falls back to default bounds for a non-empty title that cannot be measured yet', () => {
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      title: { text: 'Title' },
      categoryAxis: { property: 'label', visible: false },
      legend: { visible: false },
      series: [{ property: 'p0' }]
    } as never) as EnhancedMochartConfig;
    const domAccessors = {
      getTitleTextDomElement: () => textElement('Title', 0, 0),
      getTitleTextRawDomElement: () => textElement('Title', 0, 0),
      getValueAxisTicksDomElementsForId: () => [textElement('1', 8, 10)],
      getValueAxisThresholdTitleDomElementsForId: () => []
    } as unknown as ChartDomAccessors;
    expect(getTitleTextBounds(mochartConfig, domAccessors)).toEqual({ width: 20, height: 20, default: true });
    expect(getChartTextBoundsData(mochartConfig, domAccessors).hasDefault).toBe(true);
  });
});
