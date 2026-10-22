import { getWithMutations } from './WithMutations.js';
import { arrayToMap, idAccessor, hasText } from './utils.js';
import { SCALE_ORDINAL } from '../config/core/constants.js';
import { isObject } from '../config/defaults/utils.js';
import { getMinorTickLabel } from '../config/core/minorConfig.js';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { ChartDomAccessors } from '../types/chart.js';
import type { ChartTextBoundsData } from '../types/layout.js';
import { resolveThresholds } from '../config/defaults/axisConfig.js';
import { textGroups, valueAxisTextGroup, axisTicksTextGroup, axisTitleTextGroup, axisThresholdTitleTextGroup } from './TextWidthCache.js';
import type { TextWidthCache } from './TextWidthCache.js';
import type { Size, TextBounds } from '../types/geometry.js';

type AccessorSpec = keyof ChartDomAccessors | [keyof ChartDomAccessors, string];
type DomAccessor = (id?: string) => Element | ArrayLike<SVGGraphicsElement> | null;
/** The chart's width cache; without one (tests, a one-off measure) every read goes to the DOM. */
type Cache = TextWidthCache | null;

const emptyBounds = { width: 0, height: 0, empty: true };
const defaultBounds = { width: 20, height: 20, default: true };
// not `default`, which would make hasDefault retry a legend that can never be measured
const unmeasuredBounds = { width: 0, height: 0 };

export function getChartTextBoundsData(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>, textWidthCache: Cache = null): ChartTextBoundsData {
  const titleTextBounds = getTitleTextBounds(mochartConfig, domAccessors, textWidthCache);
  const titleTextRawBounds = getTitleTextRawBounds(mochartConfig, domAccessors, textWidthCache);
  const titlePrefixBounds = getTitlePrefixBounds(mochartConfig, domAccessors, textWidthCache);
  const titleSuffixBounds = getTitleSuffixBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisTickBounds = getCategoryAxisTickLabelBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisMinorTickBounds = getCategoryAxisMinorTickLabelBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisSizeTickBounds = getCategoryAxisSizeTickLabelBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisMinorSizeTickBounds = getCategoryAxisMinorSizeTickLabelBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisTickCountLabelBounds = getCategoryAxisTickCountLabelBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisTitleBounds = getCategoryAxisTitleBounds(mochartConfig, domAccessors, textWidthCache);
  const categoryAxisThresholdTitleBounds = getCategoryAxisThresholdTitleBounds(mochartConfig, domAccessors, textWidthCache);
  const valueAxisTickBounds = getValueAxisTickLabelBounds(mochartConfig, domAccessors, axisSeriesCounts, textWidthCache);
  const valueAxisMinorTickBounds = getValueAxisMinorTickLabelBounds(mochartConfig, domAccessors, axisSeriesCounts, textWidthCache);
  const valueAxisTickCountLabelBounds = getValueAxisTickCountLabelBounds(mochartConfig, domAccessors, axisSeriesCounts, textWidthCache);
  const valueAxisTitleBounds = getValueAxisTitleBounds(mochartConfig, domAccessors, axisSeriesCounts, textWidthCache);
  const valueAxisThresholdTitleBounds = getValueAxisThresholdTitleBounds(mochartConfig, domAccessors, textWidthCache);
  const legendBounds = getLegendBounds(mochartConfig, domAccessors);
  const legendItemTextBounds = getLegendItemTextBounds(mochartConfig, domAccessors, textWidthCache);
  const legendItemTextRawBounds = getLegendItemTextRawBounds(mochartConfig, domAccessors, textWidthCache);
  const legendItemMaxTextBounds = getMaxBounds(Object.values(legendItemTextBounds));

  const chartTextBoundsData = {
    titleTextBounds,
    titleTextRawBounds,
    titlePrefixBounds,
    titleSuffixBounds,
    categoryAxisTickBounds,
    categoryAxisMinorTickBounds,
    categoryAxisSizeTickBounds,
    categoryAxisMinorSizeTickBounds,
    categoryAxisTickCountLabelBounds,
    categoryAxisTitleBounds,
    categoryAxisThresholdTitleBounds,
    valueAxisTickBounds,
    valueAxisMinorTickBounds,
    valueAxisTickCountLabelBounds,
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

function getSvgBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, textWidthCache: Cache, textGroup: string): TextBounds {
  return getBounds<SVGGraphicsElement | null>(domAccessors, getDomElementKey, fallbackBounds, element => getSvgWidthAndHeight(element, textWidthCache, textGroup));
}

function getSvgAllBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, list: readonly unknown[], textWidthCache: Cache, textGroup: string): TextBounds[] {
  return getAllBounds<SVGGraphicsElement>(domAccessors, getDomElementKey, fallbackBounds, element => getSvgWidthAndHeight(element, textWidthCache, textGroup), list);
}

function getSvgAllBoundsWithFontSize(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, list: readonly unknown[], textWidthCache: Cache, textGroup: string): TextBounds[] {
  return getAllBounds<SVGGraphicsElement>(domAccessors, getDomElementKey, fallbackBounds, element => getSvgWidthHeightAndFontSize(element, textWidthCache, textGroup), list);
}

function getSvgMaxBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds, textWidthCache: Cache, textGroup: string): TextBounds {
  return getBounds<ArrayLike<SVGGraphicsElement>>(domAccessors, getDomElementKey, fallbackBounds, elements => getSvgMaxWidthAndHeight(elements, textWidthCache, textGroup));
}

function getHtmlBounds(domAccessors: ChartDomAccessors | null | undefined, getDomElementKey: AccessorSpec, fallbackBounds: TextBounds): TextBounds {
  return getBounds<Element | null>(domAccessors, getDomElementKey, fallbackBounds, getHtmlWidthAndHeight);
}

export function getBoundsWithMutations<T extends Size>(oldBounds: T | null, newBounds: T): T {
  return getWithMutations(oldBounds, newBounds);
}

/** Text width is the advance TextTruncation fits to, never `getBBox().width`, because Gecko inflates text boxes 2px per side. */
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

export function getSvgMaxWidthAndHeight(domElements: ArrayLike<SVGGraphicsElement>, textWidthCache: Cache = null, textGroup = ''): TextBounds {
  // 0 seeds, never Number.MIN_VALUE: all-zero bboxes (hidden container) must
  // measure 0x0 so the default-bounds fallback marks them for re-measure
  let maxWidth = 0;
  let maxHeight = 0;
  let boundingBox;
  let width;
  let height;
  let allEmpty = true;
  const count = domElements.length;
  const fontKey = textWidthCache !== null && count > 0 ? textWidthCache.fontKey(textGroup, domElements[0]) : '';
  for (let i = 0; i < count; i++) {
    if (allEmpty && !hasEmptyText(domElements[i])) {
      allEmpty = false;
    }
    if (textWidthCache === null) {
      // the box is still read for the height, which has no advance-based equivalent
      boundingBox = domElements[i].getBBox();
      width = getSvgWidth(domElements[i], boundingBox);
      height = boundingBox.height;
    }
    else {
      width = textWidthCache.width(fontKey, domElements[i]);
      height = textWidthCache.height(fontKey, domElements[i]);
    }
    if (width > maxWidth) {
      maxWidth = width;
    }
    if (height > maxHeight) {
      maxHeight = height;
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

export function getSvgWidthAndHeight(domElement: SVGGraphicsElement | null, textWidthCache: Cache = null, textGroup = ''): TextBounds {
  let width = 0;
  let height = 0;
  if (domElement !== null) {
    if (hasEmptyText(domElement)) {
      return { width, height, empty: true };
    }
    if (textWidthCache === null) {
      // the box is still read for the height, which has no advance-based equivalent
      const boundingBox = domElement.getBBox();
      // ceil, never floor: a reserved width below the fitted width truncates text that exactly fits
      width = Math.ceil(getSvgWidth(domElement, boundingBox));
      height = Math.ceil(boundingBox.height);
    }
    else {
      const fontKey = textWidthCache.fontKey(textGroup, domElement);
      width = Math.ceil(textWidthCache.width(fontKey, domElement));
      height = Math.ceil(textWidthCache.height(fontKey, domElement));
    }
  }
  return {
    width, height
  };
}

// measured height is the font's em box (1.15–1.25em), so anything sized to match the text needs the font size itself
export function getSvgWidthHeightAndFontSize(domElement: SVGGraphicsElement | null, textWidthCache: Cache = null, textGroup = ''): TextBounds {
  const bounds: TextBounds = getSvgWidthAndHeight(domElement, textWidthCache, textGroup);
  if (domElement !== null) {
    let fontSize: number;
    if (textWidthCache !== null) {
      // the group's font key read carries the size, so the items of a legend cost one style read, not one each
      textWidthCache.fontKey(textGroup, domElement);
      fontSize = textWidthCache.fontSize(textGroup);
    }
    else {
      fontSize = typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(domElement).fontSize) : NaN;
    }
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

export function getTitleTextBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let titleTextBounds: TextBounds = emptyBounds;
  if (hasText(mochartConfig.title.text)) {
    titleTextBounds = getSvgBounds(domAccessors, 'getTitleTextDomElement', defaultBounds, textWidthCache, textGroups.title);
  }
  return titleTextBounds;
}

export function getTitleTextRawBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let titleTextBounds: TextBounds = emptyBounds;
  if (hasText(mochartConfig.title.text)) {
    titleTextBounds = getSvgBounds(domAccessors, 'getTitleTextRawDomElement', defaultBounds, textWidthCache, textGroups.title);
  }
  return titleTextBounds;
}

export function getTitlePrefixBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let titlePrefixBounds: TextBounds = emptyBounds;
  if (hasText(mochartConfig.title.text) && hasText(mochartConfig.title.prefix.text)) {
    titlePrefixBounds = getSvgBounds(domAccessors, 'getTitlePrefixDomElement', defaultBounds, textWidthCache, textGroups.titlePrefix);
  }
  return titlePrefixBounds;
}

export function getTitleSuffixBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let titleSuffixBounds: TextBounds = emptyBounds;
  if (hasText(mochartConfig.title.text) && hasText(mochartConfig.title.suffix.text)) {
    titleSuffixBounds = getSvgBounds(domAccessors, 'getTitleSuffixDomElement', defaultBounds, textWidthCache, textGroups.titleSuffix);
  }
  return titleSuffixBounds;
}

// The labels a config hides are not drawn, so they measure as nothing rather than as a default to retry.
export function getCategoryAxisTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let categoryAxisTickBounds: TextBounds = emptyBounds;
  if (mochartConfig.categoryAxis.visible && mochartConfig.categoryAxis.tickLabel.visible) {
    categoryAxisTickBounds = getSvgMaxBounds(domAccessors, 'getCategoryAxisMajorTicksDomElements', defaultBounds, textWidthCache, axisTicksTextGroup(textGroups.categoryAxis, false));
  }
  return categoryAxisTickBounds;
}

/** The widest minor label; ticks with no minor among them are a measured nothing, not a default to retry. */
function getMinorTickLabelBounds(domAccessors: ChartDomAccessors | null | undefined, minorElements: () => ArrayLike<SVGGraphicsElement>, allElements: () => ArrayLike<SVGGraphicsElement>, textWidthCache: Cache, textGroup: string): TextBounds {
  if (!domAccessors) {
    return defaultBounds;
  }
  const elements = minorElements();
  if (elements.length > 0) {
    const bounds = getSvgMaxWidthAndHeight(elements, textWidthCache, textGroup);
    return isMeasured(bounds) ? bounds : defaultBounds;
  }
  return allElements().length > 0 ? emptyBounds : defaultBounds;
}

function getCategoryAxisMinorTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  const { categoryAxis } = mochartConfig;
  if (!categoryAxis.visible || !getMinorTickLabel(categoryAxis).visible) {
    return emptyBounds;
  }
  return getMinorTickLabelBounds(domAccessors, () => domAccessors!.getCategoryAxisMinorTicksDomElements(), () => domAccessors!.getCategoryAxisTicksDomElements(),
    textWidthCache, axisTicksTextGroup(textGroups.categoryAxis, true));
}

export function getCategoryAxisSizeTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  let categoryAxisSizeTickBounds: TextBounds = emptyBounds;
  const { categoryAxis } = mochartConfig;
  if (categoryAxis.visible && categoryAxis.scale === SCALE_ORDINAL && categoryAxis.tickLabel.visible && categoryAxis.tickLabel.truncation.enabled) {
    categoryAxisSizeTickBounds = getSvgBounds(domAccessors, 'getCategoryAxisSizeTickDomElement', defaultBounds, textWidthCache, axisTicksTextGroup(textGroups.categoryAxis, false));
  }
  return categoryAxisSizeTickBounds;
}

function getCategoryAxisMinorSizeTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  const { categoryAxis } = mochartConfig;
  const minorTickLabel = getMinorTickLabel(categoryAxis);
  if (categoryAxis.visible && categoryAxis.scale === SCALE_ORDINAL && minorTickLabel.visible && minorTickLabel.truncation?.enabled === true) {
    return getSvgBounds(domAccessors, 'getCategoryAxisMinorSizeTickDomElement', defaultBounds, textWidthCache, axisTicksTextGroup(textGroups.categoryAxis, true));
  }
  return emptyBounds;
}

/** The tick count labels in the DOM by their text, width only (they sit along the axis); one that cannot be measured is a default to retry. */
function getTickCountLabelBounds(elements: ArrayLike<SVGGraphicsElement>, textWidthCache: Cache, textGroup: string): Record<string, TextBounds> {
  const boundsByText: Record<string, TextBounds> = {};
  const count = elements.length;
  const fontKey = textWidthCache !== null && count > 0 ? textWidthCache.fontKey(textGroup, elements[0]) : '';
  for (let i = 0; i < count; i++) {
    const element = elements[i];
    // ceil like getSvgWidthAndHeight; the height is never read, so no box is taken
    const width = hasEmptyText(element) ? 0 : Math.ceil(textWidthCache === null ? getSvgWidth(element, { width: 0 }) : textWidthCache.width(fontKey, element));
    boundsByText[element.textContent ?? ''] = width > 0 || hasEmptyText(element) ? { width, height: 0 } : defaultBounds;
  }
  return boundsByText;
}

function getCategoryAxisTickCountLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): Record<string, TextBounds> {
  const { categoryAxis } = mochartConfig;
  if (!domAccessors || !categoryAxis.visible || !categoryAxis.tickLabel.visible) {
    return {};
  }
  return getTickCountLabelBounds(domAccessors.getCategoryAxisTickCountLabelDomElements(), textWidthCache, axisTicksTextGroup(textGroups.categoryAxis, false));
}

export function getCategoryAxisTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): TextBounds {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  let categoryAxisTitleBounds: TextBounds = emptyBounds;
  if (categoryAxisConfig.visible && hasText(categoryAxisConfig.title.text)) {
    categoryAxisTitleBounds = getSvgBounds(domAccessors, 'getCategoryAxisTitleDomElement', defaultBounds, textWidthCache, axisTitleTextGroup(textGroups.categoryAxis));
  }
  return categoryAxisTitleBounds;
}


const thresholdTitleIndexPattern = /mochart-axis-threshold-title-(\d+)/;

/** Measured bounds for each rendered threshold title, keyed by threshold index (read from the title group's index class). */
function getThresholdTitleBoundsByIndex(domAccessors: ChartDomAccessors | null | undefined, thresholds: readonly { title: { text: string | null } }[], accessor: () => NodeListOf<SVGGraphicsElement>, textWidthCache: Cache, axisGroup: string): Record<number, TextBounds> {
  const boundsByIndex: Record<number, TextBounds> = {};
  const measured: Record<number, TextBounds> = {};
  if (domAccessors && thresholds.some(threshold => hasText(threshold.title.text))) {
    const elements = accessor();
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]!;
      const match = thresholdTitleIndexPattern.exec(element.getAttribute('class') ?? '');
      const text = element.querySelector<SVGGraphicsElement>('text');
      if (match !== null && text !== null) {
        const index = Number(match[1]);
        const bounds = getSvgWidthAndHeight(text, textWidthCache, axisThresholdTitleTextGroup(axisGroup, index));
        if (isMeasured(bounds)) {
          measured[index] = bounds;
        }
      }
    }
  }
  thresholds.forEach((threshold, index) => {
    if (hasText(threshold.title.text)) {
      boundsByIndex[index] = measured[index] ?? defaultBounds;
    }
  });
  return boundsByIndex;
}

export function getCategoryAxisThresholdTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): Record<number, TextBounds> {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  return getThresholdTitleBoundsByIndex(domAccessors, resolveThresholds(categoryAxisConfig.thresholds),
    () => domAccessors!.getCategoryAxisThresholdTitleDomElements(), textWidthCache, textGroups.categoryAxis);
}




function axisIsDrawn(valueAxisConfig: EnhancedValueAxisConfig, axisSeriesCounts: Record<string, number> | undefined): boolean {
  return valueAxisConfig.visible && (valueAxisConfig.visibleWhenAllFiltered || (axisSeriesCounts?.[valueAxisConfig.id] ?? 0) > 0);
}

export function getValueAxisTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>, textWidthCache: Cache = null): Record<string, TextBounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisTickBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    let aValueAxisTickBounds: TextBounds = emptyBounds;
    if (axisIsDrawn(valueAxisConfig, axisSeriesCounts) && valueAxisConfig.tickLabel.visible) {
      aValueAxisTickBounds = getSvgMaxBounds(domAccessors, ['getValueAxisMajorTicksDomElementsForId', valueAxisConfig.id], defaultBounds,
        textWidthCache, axisTicksTextGroup(valueAxisTextGroup(valueAxisConfig.id), false));
    }
    return aValueAxisTickBounds;
  });
  return valueAxisTickBounds;
}

function getValueAxisMinorTickLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>, textWidthCache: Cache = null): Record<string, TextBounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  return arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    if (!axisIsDrawn(valueAxisConfig, axisSeriesCounts) || !getMinorTickLabel(valueAxisConfig).visible) {
      return emptyBounds;
    }
    const { id } = valueAxisConfig;
    return getMinorTickLabelBounds(domAccessors, () => domAccessors!.getValueAxisMinorTicksDomElementsForId(id), () => domAccessors!.getValueAxisTicksDomElementsForId(id),
      textWidthCache, axisTicksTextGroup(valueAxisTextGroup(id), true));
  });
}

function getValueAxisTickCountLabelBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>, textWidthCache: Cache = null): Record<string, Record<string, TextBounds>> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  return arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    if (!domAccessors || !axisIsDrawn(valueAxisConfig, axisSeriesCounts) || !valueAxisConfig.tickLabel.visible) {
      return {};
    }
    return getTickCountLabelBounds(domAccessors.getValueAxisTickCountLabelDomElementsForId(valueAxisConfig.id), textWidthCache, axisTicksTextGroup(valueAxisTextGroup(valueAxisConfig.id), false));
  });
}

export function getValueAxisTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, axisSeriesCounts?: Record<string, number>, textWidthCache: Cache = null): Record<string, TextBounds> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisTitleBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    let aValueAxisTitleBounds: TextBounds = emptyBounds;
    if (axisIsDrawn(valueAxisConfig, axisSeriesCounts) && hasText(valueAxisConfig.title.text)) {
      aValueAxisTitleBounds = getSvgBounds(domAccessors, ['getValueAxisTitleDomElementForId', valueAxisConfig.id], defaultBounds,
        textWidthCache, axisTitleTextGroup(valueAxisTextGroup(valueAxisConfig.id)));
    }
    return aValueAxisTitleBounds;
  });
  return valueAxisTitleBounds;
}

export function getValueAxisThresholdTitleBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): Record<string, Record<number, TextBounds>> {
  const { valueAxes: valueAxisConfigs } = mochartConfig;
  const valueAxisThresholdTitleBounds = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => {
    return getThresholdTitleBoundsByIndex(domAccessors, resolveThresholds(valueAxisConfig.thresholds),
      () => domAccessors!.getValueAxisThresholdTitleDomElementsForId(valueAxisConfig.id), textWidthCache, valueAxisTextGroup(valueAxisConfig.id));
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

// The DOM only holds legend items for showInLegend series, so the expected list must match. A full
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

export function getLegendItemTextBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): Record<string, TextBounds> {
  if (!mochartConfig.legend.visible) {
    return getLegendItemBoundsById(mochartConfig, []);
  }
  return getLegendItemBoundsById(mochartConfig,
    getSvgAllBoundsWithFontSize(domAccessors, 'getLegendItemTextDomElements', defaultBounds, getLegendSeriesConfigs(mochartConfig), textWidthCache, textGroups.legendItem));
}

export function getLegendItemTextRawBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null, textWidthCache: Cache = null): Record<string, TextBounds> {
  if (!mochartConfig.legend.visible) {
    return getLegendItemBoundsById(mochartConfig, []);
  }
  return getLegendItemBoundsById(mochartConfig,
    getSvgAllBounds(domAccessors, 'getLegendItemTextRawDomElements', defaultBounds, getLegendSeriesConfigs(mochartConfig), textWidthCache, textGroups.legendItem));
}

export function getTooltipBounds(mochartConfig: EnhancedMochartConfig, domAccessors?: ChartDomAccessors | null): TextBounds {
  let tooltipBounds: TextBounds = emptyBounds;
  if (mochartConfig.tooltip.visible) {
    tooltipBounds = getHtmlBounds(domAccessors, 'getTooltipDomElement', defaultBounds);
  }
  return tooltipBounds;
}
