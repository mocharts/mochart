export const mochartCssClasses = {
  chart: 'mochart-chart',
  // state class: present only while accessibility.enabled — gates the css focus rules
  accessible: 'mochart-accessible',
    background: 'mochart-background',
    title: 'mochart-title',
      titleBackground: 'mochart-title-background',
      titleText: 'mochart-title-text',
      titleTextBackground: 'mochart-title-text-background',
      titleTextRaw: 'mochart-title-text-raw',
      titlePrefix: 'mochart-title-prefix',
      titlePrefixBackground: 'mochart-title-prefix-background',
      titleSuffix: 'mochart-title-suffix',
      titleSuffixBackground: 'mochart-title-suffix-background',
    plot: 'mochart-plot',
      plotBackground: 'mochart-plot-background',
      plotBack: 'mochart-plot-back',
        axisGridContainer: 'mochart-axis-grid-container',
          categoryAxisGrid: 'mochart-category-axis-grid',
          valueAxisGrid: 'mochart-value-axis-grid mochart-value-axis-grid-id-',
            axisGridLine: 'mochart-axis-grid-line mochart-axis-grid-line-',
        axisBaseContainer: 'mochart-axis-base-container',
          valueAxisBaseLine: 'mochart-value-axis-base-line mochart-value-axis-base-line-id-',
            axisBaseLine: 'mochart-axis-base-line',
        axisContainer: 'mochart-axis-container',
          categoryAxis: 'mochart-category-axis',
          valueAxis: 'mochart-value-axis mochart-value-axis-id-',
            axisBackground: 'mochart-axis-background',
            axisLine: 'mochart-axis-line',
            axisTitle: 'mochart-axis-title',
              axisTitleBackground: 'mochart-axis-title-background',
            axisTickMarks: 'mochart-axis-tick-marks',
              axisTickMark: 'mochart-axis-tick-mark mochart-axis-tick-mark-',
            axisTickLabels: 'mochart-axis-tick-labels',
              axisTickLabel: 'mochart-axis-tick-label mochart-axis-tick-label-',
                axisTickLabelBackground: 'mochart-axis-tick-label-background',
            axisSizeTickLabel: 'mochart-axis-size-tick-label',
            axisFocusRange: 'mochart-axis-focus-range',
            axisFocusTickMarks: 'mochart-axis-focus-tick-marks',
              axisFocusTickMark: 'mochart-axis-focus-tick-mark mochart-axis-focus-tick-mark-',
        axisThresholdContainer: 'mochart-axis-threshold-container',
          categoryAxisThreshold: 'mochart-category-axis-threshold',
          valueAxisThreshold: 'mochart-value-axis-threshold mochart-value-axis-threshold-id-',
            axisThreshold: 'mochart-axis-threshold',
            axisThresholdTitle: 'mochart-axis-threshold-title mochart-axis-threshold-title-',
              axisThresholdTitleBackground: 'mochart-axis-threshold-title-background',
            axisThresholdMin: 'mochart-axis-threshold-min',
            axisThresholdMax: 'mochart-axis-threshold-max',
            axisThresholdRange: 'mochart-axis-threshold-range',
      seriesContainer: 'mochart-series-container',
        seriesBackground: 'mochart-series-background',
        series: 'mochart-series mochart-series-id-',
          seriesLine: 'mochart-series-line',
          seriesArea: 'mochart-series-area',
          seriesBar: 'mochart-series-bar mochart-series-bar-',
          seriesErrorBars: 'mochart-series-error-bars',
            seriesErrorBar: 'mochart-series-error-bar mochart-series-error-bar-',
          seriesMarkers: 'mochart-series-markers',
            seriesMarker: 'mochart-series-marker mochart-series-marker-',
          seriesLabels: 'mochart-series-labels',
            seriesLabel: 'mochart-series-label mochart-series-label-',
      plotFront: 'mochart-plot-front',
    radialPlot: 'mochart-radial-plot',
      seriesSlice: 'mochart-series-slice',
      seriesSliceLabel: 'mochart-series-slice-label',
      pieCenter: 'mochart-pie-center',
        pieCenterLabel: 'mochart-pie-center-label',
        pieCenterTotal: 'mochart-pie-center-total',
    crosshair: 'mochart-crosshair',
      crosshairCategoryLines: 'mochart-crosshair-category-lines',
      crosshairSeriesLines: 'mochart-crosshair-series-lines',
        crosshairLine: 'mochart-crosshair-line',
    legendContainer: 'mochart-legend-container',
      legendBackground: 'mochart-legend-background',
    legend: 'mochart-legend',
    legendItem: 'mochart-legend-item mochart-legend-item-id-',
      legendItemBackground: 'mochart-legend-item-background',
      legendItemIcon: 'mochart-legend-item-icon',
      legendItemText: 'mochart-legend-item-text',
      legendItemTextRaw: 'mochart-legend-item-text-raw',
  tooltipContainer: 'mochart-tooltip-container',
    tooltip: 'mochart-tooltip',
      tooltipContent: 'mochart-tooltip-content',
        tooltipControls: 'mochart-tooltip-controls',
        tooltipLines: 'mochart-tooltip-lines',
          tooltipCategoryLine: 'mochart-tooltip-category-line',
          tooltipSeriesLine: 'mochart-tooltip-series-line mochart-tooltip-series-line-id-',
            tooltipLineIcon: 'mochart-tooltip-line-icon',
            tooltipLineText: 'mochart-tooltip-line-text',
            tooltipLineLabel: 'mochart-tooltip-line-label',
            tooltipLineValue: 'mochart-tooltip-line-value',
    tooltipSizer: 'mochart-tooltip-sizer',
  clipIndicator: 'mochart-clip-indicator',
  clipIndicatorBand: 'mochart-clip-indicator-band mochart-clip-indicator-band-',
  error: 'mochart-error',
  noData: 'mochart-no-data',
  noSeries: 'mochart-no-series',
  loading: 'mochart-loading',
  chartError: 'mochart-chart mochart-chart-error'
};

export type MochartCssClassKey = keyof typeof mochartCssClasses;

// the attribute Chart.ts stamps the library version onto every chart root with
export const mochartVersionAttribute = 'data-mochart-version';

// a value is one class, a class plus the prefix its per-item class is built from, or (chartError
// only) two complete classes; the prefix is the token ending in a dash and is never a class itself
function getCompleteCssClassTokens(key: MochartCssClassKey) {
  return mochartCssClasses[key].split(' ').filter(token => !token.endsWith('-'));
}

/** The class or classes the renderer writes for a key, without any per-item id class. */
export function getCssClass(key: MochartCssClassKey) {
  return getCompleteCssClassTokens(key).join(' ');
}

/** The per-item class a key builds from an id or index, e.g. `series` and `sales`. */
export function getIdCssClass(key: MochartCssClassKey, id: string | number) {
  const prefix = mochartCssClasses[key].split(' ').find(token => token.endsWith('-'));
  if (prefix === undefined) {
    throw new Error(`mochartCssClasses['${key}'] has no id prefix`);
  }
  return prefix + id;
}

/** Selector matching a key's own element. */
export function getCssSelector(key: MochartCssClassKey) {
  return '.' + getCompleteCssClassTokens(key).join('.');
}

/** Selector matching one item of a per-item key. */
export function getIdCssSelector(key: MochartCssClassKey, id: string | number) {
  return '.' + getIdCssClass(key, id);
}

/** Selector matching the last key nested anywhere under the ones before it. */
export function getDescendantCssSelector(...keys: MochartCssClassKey[]) {
  return keys.map(key => getCssSelector(key)).join(' ');
}

/** Selector matching a class by substring, for elements that also carry a per-item id class. */
export function getCssClassMatchSelector(cssClass: string) {
  return '[class*="' + cssClass + '"]';
}

/** Selector matching the chart root in every state — only the root carries the version attribute. */
export function getChartRootCssSelector() {
  return '[' + mochartVersionAttribute + ']';
}

function getCategoryAxisTickLabelsCssSelector() {
  return getDescendantCssSelector('categoryAxis', 'axisTickLabels', 'axisTickLabel') + ' text';
}

function getCategoryAxisSizeTickLabelCssSelector() {
  return getDescendantCssSelector('categoryAxis', 'axisSizeTickLabel') + ' text';
}

function getCategoryAxisTitleCssSelector() {
  return getDescendantCssSelector('categoryAxis', 'axisTitle') + ' text';
}

function getCategoryAxisThresholdTitleCssSelector() {
  return getDescendantCssSelector('categoryAxisThreshold', 'axisThresholdTitle');
}

function getValueAxisTickLabelsCssSelectorForId(axisId: string) {
  return getIdCssSelector('valueAxis', axisId) + ' ' + getCssSelector('axisTickLabels') + ' text';
}

function getValueAxisTitleCssSelectorForId(axisId: string) {
  return getIdCssSelector('valueAxis', axisId) + ' ' + getCssSelector('axisTitle') + ' text';
}

function getValueAxisThresholdTitleCssSelectorForId(axisId: string) {
  return getIdCssSelector('valueAxisThreshold', axisId) + ' ' + getCssSelector('axisThresholdTitle');
}

function getLegendItemTextsCssSelector() {
  return getCssSelector('legendItemText') + ' text';
}

function getLegendItemTextRawsCssSelector() {
  return getCssSelector('legendItemTextRaw') + ' text';
}


export function getDomAccessors(chartElement: Element): ChartDomAccessors {
  return {
    getTitleTextDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCssSelector('titleText')),
    getTitleTextRawDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCssSelector('titleTextRaw')),
    getTitlePrefixDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCssSelector('titlePrefix')),
    getTitleSuffixDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCssSelector('titleSuffix')),
    getCategoryAxisTicksDomElements: () => chartElement.querySelectorAll<SVGGraphicsElement>(getCategoryAxisTickLabelsCssSelector()),
    getCategoryAxisSizeTickDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCategoryAxisSizeTickLabelCssSelector()),
    getCategoryAxisTitleDomElement: () => chartElement.querySelector<SVGGraphicsElement>(getCategoryAxisTitleCssSelector()),
    getCategoryAxisThresholdTitleDomElements: () => chartElement.querySelectorAll<SVGGraphicsElement>(getCategoryAxisThresholdTitleCssSelector()),
    getValueAxisTicksDomElementsForId: (axisId: string) => chartElement.querySelectorAll<SVGGraphicsElement>(getValueAxisTickLabelsCssSelectorForId(axisId)),
    getValueAxisTitleDomElementForId: (axisId: string) => chartElement.querySelector<SVGGraphicsElement>(getValueAxisTitleCssSelectorForId(axisId)),
    getValueAxisThresholdTitleDomElementsForId: (axisId: string) => chartElement.querySelectorAll<SVGGraphicsElement>(getValueAxisThresholdTitleCssSelectorForId(axisId)),
    getLegendDomElement: () => chartElement.querySelector<HTMLElement>(getCssSelector('legend')),
    getLegendItemTextDomElements: () => chartElement.querySelectorAll<SVGGraphicsElement>(getLegendItemTextsCssSelector()),
    getLegendItemTextRawDomElements: () => chartElement.querySelectorAll<SVGGraphicsElement>(getLegendItemTextRawsCssSelector()),
    getTooltipDomElement: () => chartElement.querySelector<HTMLElement>(getCssSelector('tooltipSizer'))
  };
}
import type { ChartDomAccessors } from '../types/chart';
