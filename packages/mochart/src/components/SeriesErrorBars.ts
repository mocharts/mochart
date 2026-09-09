import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { NONE, RENDERER_BAR } from '../config/core/constants';
import { getSeriesErrorBarStrokeColor } from '../utils/SeriesColors';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { getFocusStrokeStyle, getCategoryFocusPercentage } from '../utils/FocusValue';
import { isMissingValue } from '../utils/utils';
import type { ElListAdapter, ElProps } from '../render';
import type { FocusData } from '../types/animation';
import type { ColorPaletteConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { AxisScale, SeriesPositionData, SeriesValueObject } from '../types/data';

interface ErrorBarItem {
  key: string;
  attrs: ElProps;
}

const errorBarAdapter: ElListAdapter<ErrorBarItem, { root: ReturnType<typeof svgEl> }> = {
  key: (errorBar) => errorBar.key,
  create: () => ({ root: svgEl('path') }),
  update: (handle, errorBar) => {
    handle.root.set(errorBar.attrs);
  }
};

interface SeriesErrorBarsProps {
  colorPaletteConfig: ColorPaletteConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  seriesPositionData: SeriesPositionData;
  valueAxisScale: AxisScale;
  filteredValues: SeriesValueObject;
  inverted: boolean;
  focusData: FocusData;
}

export default class SeriesErrorBars extends Renderer<SeriesErrorBarsProps> {
  root = svgEl('g');
  errorBars = this.elList<ErrorBarItem>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { colorPaletteConfig, seriesConfig, seriesIndex, seriesPositionData, valueAxisScale, filteredValues, inverted, focusData } = this.props;

    const hasErrorValues = filteredValues.errorLow !== null || filteredValues.errorHigh !== null;
    if ((seriesConfig.errorLowProperty !== NONE || seriesConfig.errorHighProperty !== NONE) &&
      hasErrorValues && seriesConfig.stack === NONE) {
      const { categoryFocusPercentages, valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
      const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);
      const { capSize: errorBarCapSize } = seriesConfig.errorBar;
      const errorLowValues = filteredValues.errorLow;
      const errorHighValues = filteredValues.errorHigh;

      const { length, getDefined, getSeriesPosition, getCategoryPosition, getOffsetCategoryPosition, categoryValueExtent, skipped, skipCategoryIndexMap } = seriesPositionData;

      // A bar whisker centers on the bar's layout slot (the grouped sub-slot,
      // narrowed by barWidthFraction); other renderers center on the point.
      const isBar = seriesConfig.renderer === RENDERER_BAR;
      // Caps on bars are clamped to the slot so they never overlap a neighbour.
      const capHalfSize = (isBar ? Math.min(errorBarCapSize, categoryValueExtent) : errorBarCapSize) / 2;

      const errorBars: ErrorBarItem[] = [];
      for (let i = 0; i < length; i++) {
        if (getDefined(null, i)) {
          // Positions may be compacted, but values and focus percentages stay
          // indexed by the raw category index.
          const skipI = skipped ? skipCategoryIndexMap[i] : i;
          // a missing bound (NaN) reads as undefined below, like an absent property
          const errorLow = errorLowValues !== null && !isMissingValue(errorLowValues[skipI]) ? errorLowValues[skipI] : undefined;
          const errorHigh = errorHighValues !== null && !isMissingValue(errorHighValues[skipI]) ? errorHighValues[skipI] : undefined;
          if (errorLow === undefined && errorHigh === undefined) {
            continue;
          }
          // A missing bound anchors its whisker end at the series position, so
          // a one-sided error bar spans from the point to the defined bound.
          const anchorPosition = getSeriesPosition(null, i)!;
          const lowPosition = errorLow !== undefined ? Math.floor(valueAxisScale(errorLow)) : anchorPosition;
          const highPosition = errorHigh !== undefined ? Math.floor(valueAxisScale(errorHigh)) : anchorPosition;
          const center = isBar ? getOffsetCategoryPosition(null, i)! + categoryValueExtent / 2 : getCategoryPosition(null, i)!;

          let d;
          if (inverted) {
            d = 'M' + lowPosition + ',' + center + 'H' + highPosition;
            if (capHalfSize > 0 && errorLow !== undefined) {
              d += 'M' + lowPosition + ',' + (center - capHalfSize) + 'V' + (center + capHalfSize);
            }
            if (capHalfSize > 0 && errorHigh !== undefined) {
              d += 'M' + highPosition + ',' + (center - capHalfSize) + 'V' + (center + capHalfSize);
            }
          }
          else {
            d = 'M' + center + ',' + lowPosition + 'V' + highPosition;
            if (capHalfSize > 0 && errorLow !== undefined) {
              d += 'M' + (center - capHalfSize) + ',' + lowPosition + 'H' + (center + capHalfSize);
            }
            if (capHalfSize > 0 && errorHigh !== undefined) {
              d += 'M' + (center - capHalfSize) + ',' + highPosition + 'H' + (center + capHalfSize);
            }
          }

          const focusPercentage = getCategoryFocusPercentage(categoryFocusPercentages[skipI], seriesFocusPercentage);
          const strokeColor = getSeriesErrorBarStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
          const { strokeWidth: errorBarStrokeWidth, strokeDashArray: errorBarStrokeDashArray, strokeOpacity } = getFocusStrokeStyle(focusPercentage, seriesConfig.errorBar.style);

          errorBars.push({
            key: 'error-bar-' + i,
            attrs: { className: mochartCssClasses['seriesErrorBar'] + i, d,
              stroke: strokeColor, strokeWidth: errorBarStrokeWidth, strokeDasharray: errorBarStrokeDashArray, strokeOpacity, fill: 'none',
              pointerEvents: 'none' }
          });
        }
      }
      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['seriesErrorBars'] });
      this.errorBars.sync(errorBars, errorBarAdapter);
    }
    else {
      this.setPresent(false);
    }
  }
}
