import { getWithMutations } from './WithMutations';
import { arrayToMap, idAccessor } from './utils';
import { NONE, SCALE_ORDINAL } from '../config/core/constants';
import { isObject } from '../config/defaults/utils';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { ChartDomAccessors } from '../types/chart';
import type { ChartTextBoundsData } from '../types/layout';
import { resolveThresholds } from '../config/defaults/axisConfig';
import type { Size, TextBounds } from '../types/geometry';

type AccessorSpec = keyof ChartDomAccessors | [keyof ChartDomAccessors, string];
type DomAccessor = (id?: string) => Element | ArrayLike<SVGGraphicsElement> | null;

const emptyBounds = { width: 0, height: 0, empty: true };
const defaultBounds = { width: 20, height: 20, default: true };
// not `default`, which would make hasDefault retry a legend that can never be measured
const unmeasuredBounds = { width: 0, height: 0 };

export function getChartTextBoundsData(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>): ChartTextBoundsData {
  const titleTextBounds = getTitleTextBounds(mochartConfig, domAccessors);
  const titleTextRawBounds = getTitleTextRawBounds(mochartConfig, domAccessors);
  const titlePrefixBounds = getTitlePrefixBounds(mochartConfig, domAccessors);
  const titleSuffixBounds = getTitleSuffixBounds(mochartConfig, domAccessors);
  const categoryAxisTickBounds = getCategoryAxisTickLabelBounds(mochartConfig, domAccessors);
  const categoryAxisSizeTickBounds = getCategoryAxisSizeTickLabelBounds(mochartConfig, domAccessors);
  const categoryAxisTitleBounds = getCategoryAxisTitleBounds(mochartConfig, domAccessors);
  const categoryAxisThresholdTitleBounds = getCategoryAxisThresholdTitleBounds(mochartConfig, domAccessors);
  const valueAxisTickBounds = getValueAxisTickLabelBounds(mochartConfig, domAccessors, axisSeriesCounts);
  const valueAxisTitleBounds = getValueAxisTitleBounds(mochartConfig, domAccessors, axisSeriesCounts);
  const valueAxisThresholdTitleBounds = getValueAxisThresholdTitleBounds(mochartConfig, domAccessors);
  const legendBounds = getLegendBounds(mochartConfig, domAccessors);
  const legendItemTextBounds = getLegendItemTextBounds(mochartConfig, domAccessors);
  const legendItemTextRawBounds = getLegendItemTextRawBounds(mochartConfig, domAccessors);
  const legendItemMaxTextBounds = getMaxBounds(Object.values(legendItemTextBounds));

  const chartTextBoundsData = {
    titleTextBounds,
    titleTextRawBounds,
    titlePrefixBounds,
    titleSuffixBounds,
    categoryAxisTickBounds,
    categoryAxisSizeTickBounds,
    categoryAxisTitleBounds,
    categoryAxisThresholdTitleBounds,
    valueAxisTickBounds,
    valueAxisTitleBounds,
    valueAxisThresholdTitleBounds,
    legendBounds,
    legendItemTextBounds,
    legendItemTextRawBounds,
    legendItemMaxTextBounds
  };

  return { ...chartTextBoundsData, hasDefault: hasDefault(chartTextBoundsData) } as ChartTextBoundsData;
}

export function getChartTextBoundsDataWithMutations(oldChartTextBoundsData: ChartTextBoundsData, newChartTextBoundsData: ChartTextBoundsData): ChartTextBoundsData {
  return getWithMutations(oldChartTextBoundsData, newChartTextBoundsData);
}

function hasDefault(v: unknown): boolean {
  if (isObject(v)) {
    if (v.default) {
      return true;
    }
    else {
      return Object.keys(v).some(key => hasDefault(v[key]));
    }
  }
  else if (Array.isArray(v)) {
    return v.some(i => hasDefault(i));
  }
  return false;
}

// a 0-extent box means unmeasurable (hidden container, not yet laid out) unless the text itself is empty
function isMeasured(bounds: TextBounds | null | undefined): bounds is TextBounds {
  return !!bounds && (bounds.empty === true || (bounds.width !== 0 && bounds.height !== 0));
}

function getBounds<T>(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, getBoundsFunction: (element: T) => TextBounds): TextBounds {
  if (domAccessors) {
    const accessors = domAccessors as unknown as Record<keyof ChartDomAccessors, DomAccessor>;
    const element = Array.isArray(getDomElementKey) ?
      accessors[getDomElementKey[0]](getDomElementKey[1]) : accessors[getDomElementKey]();
    const bounds = getBoundsFunction(element as T);
    return isMeasured(bounds) ? bounds : fallbackBounds;
  }
  else {
    return fallbackBounds;
  }
}

function getAllBounds<T>(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, getBoundsFunction: (element: T) => TextBounds, list: readonly unknown[]): TextBounds[] {
  if (domAccessors) {
    const accessors = domAccessors as unknown as Record<keyof ChartDomAccessors, DomAccessor>;
    const elements = (Array.isArray(getDomElementKey) ?
      accessors[getDomElementKey[0]](getDomElementKey[1]) : accessors[getDomElementKey]()) as ArrayLike<T> | null;
    if (elements && elements.length === list.length) {
      const count = elements.length;
      const allBounds: TextBounds[] = [];
      let bounds;
      for (let i=0; i<count; i++) {
        bounds = getBoundsFunction(elements[i]);
        allBounds.push(isMeasured(bounds) ? bounds : fallbackBounds);
      }
      return allBounds;
    }
    else {
      return list.map(() => fallbackBounds);
    }
  }
  else {
    return list.map(() => fallbackBounds);
  }
}

function getMaxBounds(allBounds: TextBounds[]): TextBounds {
  const maxBounds: TextBounds = { width: 0, height: 0 };
  for (const bounds of allBounds) {
    if (bounds.default) {
      maxBounds.default = true;
    }
    if (bounds.width > maxBounds.width) {
      maxBounds.width = bounds.width;
    }
    if (bounds.height > maxBounds.height) {
      maxBounds.height = bounds.height;
    }
    if (bounds.fontSize !== undefined && bounds.fontSize > (maxBounds.fontSize ?? 0)) {
      maxBounds.fontSize = bounds.fontSize;
    }
  }
  return maxBounds;
}

function getSvgBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds): TextBounds {
  return getBounds<SVGGraphicsElement | null>(domAccessors, getDomElementKey, fallbackBounds, getSvgWidthAndHeight);
}

function getSvgAllBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, list: readonly unknown[]): TextBounds[] {
  return getAllBounds<SVGGraphicsElement>(domAccessors, getDomElementKey, fallbackBounds, getSvgWidthAndHeight, list);
}

function getSvgAllBoundsWithFontSize(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, list: readonly unknown[]): TextBounds[] {
  return getAllBounds<SVGGraphicsElement>(domAccessors, getDomElementKey, fallbackBounds, getSvgWidthHeightAndFontSize, list);
}

function getSvgMaxBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds): TextBounds {
  return getBounds<ArrayLike<SVGGraphicsElement>>(domAccessors, getDomElementKey, fallbackBounds, getSvgMaxWidthAndHeight);
}

function getHtmlBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds): TextBounds {
  return getBounds<Element | null>(domAccessors, getDomElementKey, fallbackBounds, getHtmlWidthAndHeight);
}

export function getBoundsWithMutations<T extends Size>(oldBounds: T | null, newBounds: T): T {
  return getWithMutations(oldBounds, newBounds);
}

/** Text width is the advance TextTruncation fits to, never `getBBox().width` — Gecko inflates text boxes 2px per side. */
function getSvgWidth(domElement: SVGGraphicsElement, boundingBox: { width: number }): number {
  const textElement = domElement as SVGTextContentElement;
  return typeof textElement.getComputedTextLength === 'function' ? textElement.getComputedTextLength() : boundingBox.width;
}

const TEXT_NODE = 3;

// empty text legitimately measures 0x0; flagged so it is not mistaken for an unmeasurable element and retried forever.
// Direct text nodes only: a truncation tooltip <title> child holds the full text of a label whose drawn text is empty.
function hasEmptyText(domElement: SVGGraphicsElement): boolean {
  if (typeof domElement.textContent !== 'string') {
    return false;
  }
  let text = '';
  for (let child = domElement.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === TEXT_NODE) {
      text += child.nodeValue;
    }
  }
  return text.trim() === '';
}

export function getSvgMaxWidthAndHeight(domElements: ArrayLike<SVGGraphicsElement>): TextBounds {
  // 0 seeds, never Number.MIN_VALUE: all-zero bboxes (hidden container) must
  // measure 0x0 so the default-bounds fallback marks them for re-measure
  let maxWidth = 0;
  let maxHeight = 0;
  let boundingBox;
  let width;
  let allEmpty = true;
  const count = domElements.length;
  for (let i = 0; i < count; i++) {
    if (allEmpty && !hasEmptyText(domElements[i])) {
      allEmpty = false;
    }
    // the box is still read for the height, which has no advance-based equivalent
    boundingBox = domElements[i].getBBox();
    width = getSvgWidth(domElements[i], boundingBox);
    if (width > maxWidth) {
      maxWidth = width;
    }
    if (boundingBox.height > maxHeight) {
      maxHeight = boundingBox.height;
    }
  }
  const bounds: TextBounds = {
    width: Math.ceil(maxWidth),
    height: Math.ceil(maxHeight)
  };
  if (count > 0 && allEmpty) {
    bounds.empty = true;
  }
  return bounds;
}

export function getSvgWidthAndHeight(domElement: SVGGraphicsElement | null): TextBounds {
  let width = 0;
  let height = 0;
  if (domElement !== null) {
    if (hasEmptyText(domElement)) {
      return { width, height, empty: true };
    }
    // the box is still read for the height, which has no advance-based equivalent
    const boundingBox = domElement.getBBox();
    // ceil, never floor: a reserved width below the fitted width truncates text that exactly fits
    width = Math.ceil(getSvgWidth(domElement, boundingBox));
    height = Math.ceil(boundingBox.height);
  }
  return {
    width, height
  };
}

// measured height is the font's em box (1.15–1.25em), so anything sized to match the text needs the font size itself
export function getSvgWidthHeightAndFontSize(domElement: SVGGraphicsElement | null): TextBounds {
  const bounds: TextBounds = getSvgWidthAndHeight(domElement);
  if (domElement !== null && typeof getComputedStyle === 'function') {
    const fontSize = parseFloat(getComputedStyle(domElement).fontSize);
    if (isFinite(fontSize) && fontSize > 0) {
      bounds.fontSize = fontSize;
    }
  }
  return bounds;
}

export function getHtmlWidthAndHeight(domElement: Element | null): Size {
  let width = 0;
  let height = 0;
  if (domElement !== null) {
    const boundingBox = domElement.getBoundingClientRect();
    width = Math.ceil(boundingBox.width);
    height = Math.ceil(boundingBox.height);
  }
  return {
    width, height
  };
}

export function getTitleTextBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let titleTextBounds: TextBounds = emptyBounds;
  if (mochartConfig.title.text !== NONE) {
    titleTextBounds = getSvgBounds(domAccessors, 'getTitleTextDomElement', defaultBounds);
  }
  return titleTextBounds;
}

export function getTitleTextRawBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let titleTextBounds: TextBounds = emptyBounds;
  if (mochartConfig.title.text !== NONE) {
    titleTextBounds = getSvgBounds(domAccessors, 'getTitleTextRawDomElement', defaultBounds);
  }
  return titleTextBounds;
}

export function getTitlePrefixBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let titlePrefixBounds: TextBounds = emptyBounds;
  if (mochartConfig.title.text !== NONE && mochartConfig.title.prefix.text !== NONE) {
    titlePrefixBounds = getSvgBounds(domAccessors, 'getTitlePrefixDomElement', defaultBounds);
  }
  return titlePrefixBounds;
}

export function getTitleSuffixBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let titleSuffixBounds: TextBounds = emptyBounds;
  if (mochartConfig.title.text !== NONE && mochartConfig.title.suffix.text !== NONE) {
    titleSuffixBounds = getSvgBounds(domAccessors, 'getTitleSuffixDomElement', defaultBounds);
  }
  return titleSuffixBounds;
}

export function getCategoryAxisTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let categoryAxisTickBounds: TextBounds = emptyBounds;
  if (mochartConfig.categoryAxis.visible) {
    categoryAxisTickBounds = getSvgMaxBounds(domAccessors, 'getCategoryAxisTicksDomElements', defaultBounds);
  }
  return categoryAxisTickBounds;
}

export function getCategoryAxisSizeTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let categoryAxisSizeTickBounds: TextBounds = emptyBounds;
  if (mochartConfig.categoryAxis.visible && mochartConfig.categoryAxis.scale === SCALE_ORDINAL && mochartConfig.categoryAxis.tickLabel.truncationEnabled) {
    categoryAxisSizeTickBounds = getSvgBounds(domAccessors, 'getCategoryAxisSizeTickDomElement', defaultBounds);
  }
  return categoryAxisSizeTickBounds;
}

export function getCategoryAxisTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  let categoryAxisTitleBounds: TextBounds = emptyBounds;
  if (categoryAxisConfig.visible && categoryAxisConfig.title.text !== NONE) {
    categoryAxisTitleBounds = getSvgBounds(domAccessors, 'getCategoryAxisTitleDomElement', defaultBounds);
  }
  return categoryAxisTitleBounds;
}


const thresholdTitleIndexPattern = /mochart-axis-threshold-title-(\d+)/;

/** Measured bounds for each rendered threshold title, keyed by threshold index (read from the title group's index class). */
function getThresholdTitleBoundsByIndex(domAccessors: ChartDomAccessors | null | undefined, thresholds: readonly { title: { text: string | null } }[], accessor: () => NodeListOf<SVGGraphicsElement>): Record<number, TextBounds> {
  const boundsByIndex: Record<number, TextBounds> = {};
  const measured: Record<number, TextBounds> = {};
  if (domAccessors && thresholds.some(threshold => threshold.title.text !== NONE)) {
    const elements = accessor();
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]!;
      const match = thresholdTitleIndexPattern.exec(element.getAttribute('class') ?? '');
      const text = element.querySelector<SVGGraphicsElement>('text');
      if (match !== null && text !== null) {
        const bounds = getSvgWidthAndHeight(text);
        if (isMeasured(bounds)) {
          measured[Number(match[1])] = bounds;
        }
      }
    }
  }
  thresholds.forEach((threshold, index) => {
    if (threshold.title.text !== NONE) {
      boundsByIndex[index] = measured[index] ?? defaultBounds;
    }
  });
  return boundsByIndex;
}

export function getCategoryAxisThresholdTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): Record<number, TextBounds> {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  return getThresholdTitleBoundsByIndex(domAccessors, resolveThresholds(categoryAxisConfig.thresholds),
    () => domAccessors!.getCategoryAxisThresholdTitleDomElements());
}




function axisIsDrawn(valueAxisConfig: EnhancedValueAxisConfig, axisSeriesCounts: Record<string, number> | undefined): boolean {
  return valueAxisConfig.visible && (valueAxisConfig.visibleWhenAllFiltered || (axisSeriesCounts?.[valueAxisConfig.id] ?? 0) > 0);
}

export function getValueAxisTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>): Record<string, TextBounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisTickBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    let aValueAxisTickBounds: TextBounds = emptyBounds;
    if (axisIsDrawn(valueAxisConfig, axisSeriesCounts)) {
      aValueAxisTickBounds = getSvgMaxBounds(domAccessors, ['getValueAxisTicksDomElementsForId', valueAxisConfig.id], defaultBounds);
    }
    return aValueAxisTickBounds;
  });
  return valueAxisTickBounds;
}

export function getValueAxisTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>): Record<string, TextBounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisTitleBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    let aValueAxisTitleBounds: TextBounds = emptyBounds;
    if (axisIsDrawn(valueAxisConfig, axisSeriesCounts) && valueAxisConfig.title.text !== NONE) {
      aValueAxisTitleBounds = getSvgBounds(domAccessors, ['getValueAxisTitleDomElementForId', valueAxisConfig.id], defaultBounds);
    }
    return aValueAxisTitleBounds;
  });
  return valueAxisTitleBounds;
}

export function getValueAxisThresholdTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): Record<string, Record<number, TextBounds>> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisThresholdTitleBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    return getThresholdTitleBoundsByIndex(domAccessors, resolveThresholds(valueAxisConfig.thresholds),
      () => domAccessors!.getValueAxisThresholdTitleDomElementsForId(valueAxisConfig.id));
  });
  return valueAxisThresholdTitleBounds;
}




export function getLegendBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let legendBounds: TextBounds = emptyBounds;
  if (mochartConfig.legend.visible) {
    legendBounds = getHtmlBounds(domAccessors, 'getLegendDomElement', defaultBounds);
  }
  return legendBounds;
}

// The DOM only holds legend items for showInLegend series, so the expected list must match — a full
// seriesConfigs list would never match the element count, defaulting every bound (phantom slots).
export function getLegendSeriesConfigs(mochartConfig: EnhancedMochartConfig) {
  return mochartConfig.series.filter(seriesConfig => seriesConfig.showInLegend);
}

// keyed by series id, not position: measuring runs a frame behind drawing, so a just-joined series reads as unmeasured for one frame instead of a positional entry describing the wrong series
export function getLegendItemBoundsList(mochartConfig: EnhancedMochartConfig, legendItemBounds: Record<string, TextBounds>): TextBounds[] {
  return getLegendSeriesConfigs(mochartConfig).map(seriesConfig => legendItemBounds[seriesConfig.id] ?? unmeasuredBounds);
}

function getLegendItemBoundsById(mochartConfig: EnhancedMochartConfig, allBounds: TextBounds[]): Record<string, TextBounds> {
  const boundsById: Record<string, TextBounds> = Object.create(null);
  getLegendSeriesConfigs(mochartConfig).forEach((seriesConfig, index) => {
    boundsById[seriesConfig.id] = allBounds[index] ?? unmeasuredBounds;
  });
  return boundsById;
}

export function getLegendItemTextBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): Record<string, TextBounds> {
  if (!mochartConfig.legend.visible) {
    return getLegendItemBoundsById(mochartConfig, []);
  }
  return getLegendItemBoundsById(mochartConfig,
    getSvgAllBoundsWithFontSize(domAccessors, 'getLegendItemTextDomElements', defaultBounds, getLegendSeriesConfigs(mochartConfig)));
}

export function getLegendItemTextRawBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): Record<string, TextBounds> {
  if (!mochartConfig.legend.visible) {
    return getLegendItemBoundsById(mochartConfig, []);
  }
  return getLegendItemBoundsById(mochartConfig,
    getSvgAllBounds(domAccessors, 'getLegendItemTextRawDomElements', defaultBounds, getLegendSeriesConfigs(mochartConfig)));
}

export function getTooltipBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let tooltipBounds: TextBounds = emptyBounds;
  if (mochartConfig.tooltip.visible) {
    tooltipBounds = getHtmlBounds(domAccessors, 'getTooltipDomElement', defaultBounds);
  }
  return tooltipBounds;
}
