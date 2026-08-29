import { Renderer, svgEl, textEl } from '../render';

import { getSeriesLabelFormat } from '../utils/ValueFormat';
import { mochartCssClasses } from '../utils/ChartDom';
import { NONE, AUTO, LABEL_POSITION_CENTER, LABEL_POSITION_INSIDE, RENDERER_BAR } from '../config/core/constants';
import { translate, isMissingValue } from '../utils/utils';
import { getSeriesLabelFillColor, getSeriesLabelStrokeColor } from '../utils/SeriesColors';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { getFocusStyle, getCategoryFocusPercentage } from '../utils/FocusValue';
import type { El, ElListAdapter, TextEl } from '../render';
import type { ColorPaletteConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { FocusData } from '../types/animation';
import type { AxisScale, NullableDomain, SeriesPositionData, SeriesValueObject } from '../types/data';
import type { LabelPosition } from '../config/core/constants';
import { CategoryShapeCache } from '../utils/CategoryShapes';
import type { CategoryShape } from '../utils/CategoryShapes';

const getLabelPosition = (isAboveBase: boolean, hasBase: boolean, seriesConfig: EnhancedSeriesConfig): LabelPosition => {
  let { position: labelPosition } = seriesConfig.label;
  if (hasBase) {
    const labelAboveBasePosition = seriesConfig.label.aboveBase.position, labelBelowBasePosition = seriesConfig.label.belowBase.position;
    if (isAboveBase && labelAboveBasePosition !== AUTO) {
      labelPosition = labelAboveBasePosition;
    }
    else if (!isAboveBase && labelBelowBasePosition !== AUTO) {
      labelPosition = labelBelowBasePosition;
    }
  }
  return labelPosition;
};

const getTextAnchor = (inverted: boolean, isAboveBase: boolean, position: LabelPosition): 'middle' | 'start' | 'end' => {
  return (!inverted || position === LABEL_POSITION_CENTER) ? 'middle' :
    (position === LABEL_POSITION_INSIDE ? (isAboveBase ? 'end' : 'start') : (isAboveBase ? 'start' : 'end'));
};

const getDY = (inverted: boolean, isAboveBase: boolean, position: LabelPosition): string => {
  return (inverted || position === LABEL_POSITION_CENTER) ? '0.35em' :
    (position === LABEL_POSITION_INSIDE ? (isAboveBase ? '1.35em' : '-0.65em') : (isAboveBase ? '-0.65em' : '1.35em'));
};

interface SeriesLabelShape extends CategoryShape { text: string }
interface SeriesLabelHandle { root: El; value: TextEl }

const labelAdapter: ElListAdapter<SeriesLabelShape, SeriesLabelHandle> = {
  key: (label: SeriesLabelShape) => label.key,
  create: () => {
    const root = svgEl('text');
    const value = textEl();
    root.append(value);
    return { root, value };
  },
  update: (handle: SeriesLabelHandle, label: SeriesLabelShape) => {
    handle.root.set(label.attrs);
    handle.value.set(label.text);
  }
};

interface SeriesLabelsProps {
  colorPaletteConfig: ColorPaletteConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  rawValueAxisDomain: NullableDomain;
  valueAxisScale: AxisScale;
  seriesPositionData: SeriesPositionData;
  filteredValues: SeriesValueObject;
  inverted: boolean;
  focusData: FocusData;
  accessibility: boolean;
  onCategoryEnter: (categoryIndex: number) => void;
  onCategoryLeave: (categoryIndex: number) => void;
  onCategoryClick: (categoryIndex: number, event: Event) => void;
}

export default class SeriesLabels extends Renderer<SeriesLabelsProps> {
  root = svgEl('g');
  labels = this.elList<SeriesLabelShape, SeriesLabelHandle>(this.root);
  labelShapes = new CategoryShapeCache<SeriesLabelShape>('seriesLabel', () => this.props, shape => ({ ...shape, text: '' }));

  create() {
    return this.root.node;
  }

  sync() {
    const { colorPaletteConfig, seriesConfig, seriesIndex, rawValueAxisDomain, valueAxisScale, seriesPositionData,
      filteredValues, inverted, focusData, accessibility } = this.props;
    if (seriesConfig.labelProperty !== NONE) {
      const { valueAxisConfig } = seriesConfig;
      const hasBase = valueAxisConfig.base !== NONE;
      const domainMin = rawValueAxisDomain[0];
      const domainMax = rawValueAxisDomain[1];

      if (domainMin !== null && domainMax !== null) {
        const domainExtent = domainMax - domainMin;
        const base = hasBase ? Math.min(Math.max(valueAxisConfig.base!, domainMin), domainMax) : domainMin;
        const labels: SeriesLabelShape[] = [];
        const { max: maxValuesNullable, min: minValues, label: labelValuesNullable } = filteredValues;
        const maxValues = maxValuesNullable!;
        const labelValues = labelValuesNullable!;
        let labelStrokeColor, labelFillColor;

        let withinPercentages = (_seriesValue: number, _minSeriesValue?: number | null) => {
          return true;
        };

        const { offset: labelOffset } = seriesConfig.label;

        // a reversed value axis flips the pixel direction, so the offset and the label side flip with it
        const { reversed } = valueAxisConfig;
        const offsetSign = reversed ? -1 : 1;

        let getOffset = (_aboveBase: boolean) => {
          return offsetSign * labelOffset;
        };

        if (hasBase) {
          const aboveBaseLabelOffset = seriesConfig.label.aboveBase.offset === AUTO ? labelOffset : seriesConfig.label.aboveBase.offset;
          const belowBaseLabelOffset = seriesConfig.label.belowBase.offset === AUTO ? -1 * labelOffset : seriesConfig.label.belowBase.offset;

          getOffset = (aboveBase: boolean) => {
            return offsetSign * (aboveBase ? aboveBaseLabelOffset : belowBaseLabelOffset);
          };
        }

        const { minPositionFraction: labelMinPositionFraction, maxPositionFraction: labelMaxPositionFraction, aboveBase: aboveBaseLabel, belowBase: belowBaseLabel } = seriesConfig.label;
        const { minPositionFraction: labelAboveBaseMinPositionFraction, maxPositionFraction: labelAboveBaseMaxPositionFraction } = aboveBaseLabel;
        const { minPositionFraction: labelBelowBaseMinPositionFraction, maxPositionFraction: labelBelowBaseMaxPositionFraction } = belowBaseLabel;

        if ((labelMinPositionFraction !== NONE || labelMaxPositionFraction !== NONE) || (hasBase &&
            (labelAboveBaseMinPositionFraction !== NONE || labelAboveBaseMaxPositionFraction !== NONE ||
             labelBelowBaseMinPositionFraction !== NONE || labelBelowBaseMaxPositionFraction !== NONE)
          )) {

          let minValue: number | null = null;
          let maxValue: number | null = null;
          let aboveBaseMinValue: number | null = null;
          let aboveBaseMaxValue: number | null = null;
          let belowBaseMinValue: number | null = null;
          let belowBaseMaxValue: number | null = null;

          if (hasBase) {
            if (labelAboveBaseMinPositionFraction !== NONE && !(labelAboveBaseMinPositionFraction === AUTO && labelMinPositionFraction === NONE)) {
              const percent = (labelAboveBaseMinPositionFraction === AUTO ? labelMinPositionFraction : labelAboveBaseMinPositionFraction)!;
              aboveBaseMinValue = base + percent * domainExtent;
            }
            if (labelAboveBaseMaxPositionFraction !== NONE && !(labelAboveBaseMaxPositionFraction === AUTO && labelMaxPositionFraction === NONE)) {
              const percent = (labelAboveBaseMaxPositionFraction === AUTO ? labelMaxPositionFraction : labelAboveBaseMaxPositionFraction)!;
              aboveBaseMaxValue = domainMax - percent * domainExtent;
            }
            if (labelBelowBaseMinPositionFraction !== NONE && !(labelBelowBaseMinPositionFraction === AUTO && labelMinPositionFraction === NONE)) {
              const percent = (labelBelowBaseMinPositionFraction === AUTO ? labelMinPositionFraction : labelBelowBaseMinPositionFraction)!;
              belowBaseMinValue = base - percent * domainExtent;
            }
            if (labelBelowBaseMaxPositionFraction !== NONE && !(labelBelowBaseMaxPositionFraction === AUTO && labelMaxPositionFraction === NONE)) {
              const percent = (labelBelowBaseMaxPositionFraction === AUTO ? labelMaxPositionFraction : labelBelowBaseMaxPositionFraction)!;
              belowBaseMaxValue = domainMin + percent * domainExtent;
            }
            withinPercentages = (seriesValue: number) => {
              if (seriesValue >= base) {
                return (aboveBaseMinValue === null || seriesValue >= aboveBaseMinValue) && (aboveBaseMaxValue === null || seriesValue <= aboveBaseMaxValue);
              }
              else {
                return (belowBaseMinValue === null || seriesValue <= belowBaseMinValue) && (belowBaseMaxValue === null || seriesValue >= belowBaseMaxValue);
              }
            };
          }
          else {
            if (labelMinPositionFraction !== NONE) {
              minValue = domainMin + labelMinPositionFraction * domainExtent;
            }
            if (labelMaxPositionFraction !== NONE) {
              maxValue = domainMax - labelMaxPositionFraction * domainExtent;
            }

            withinPercentages = (seriesValue: number) => {
              return (minValue === null || seriesValue >= minValue) && (maxValue === null || seriesValue <= maxValue);
            };
          }
        }
        if (seriesConfig.label.minRangeFraction !== NONE) {
          const oldWithinPercentages = withinPercentages;
          const hasStack = seriesConfig.stack !== NONE;
          const minAbsoluteValue = seriesConfig.label.minRangeFraction * domainExtent;

          if (hasStack) {
            if (hasBase) {
              withinPercentages = (maxSeriesValue: number, minSeriesValue?: number | null) => {
                let valueMin = base;
                if (minSeriesValue !== null && minSeriesValue !== undefined) {
                  valueMin = minSeriesValue;
                }
                return oldWithinPercentages(maxSeriesValue) && Math.abs(maxSeriesValue - valueMin) >= minAbsoluteValue;
              };
            }
            else {
              withinPercentages = (maxSeriesValue: number, minSeriesValue?: number | null) => {
                let valueMin = domainMin;
                if (minSeriesValue !== null && minSeriesValue !== undefined) {
                  valueMin = minSeriesValue;
                }
                return oldWithinPercentages(maxSeriesValue) && Math.abs(maxSeriesValue - valueMin) >= minAbsoluteValue;
              };
            }
          }
          else {
            // an unstacked value with no rangeProperty spans from where the bars start, like a stacked one
            const unstackedMin = hasBase ? base : domainMin;
            withinPercentages = (maxSeriesValue: number, minSeriesValue?: number | null) => {
              let valueMin = maxSeriesValue;
              if (minSeriesValue !== undefined) {
                valueMin = minSeriesValue ?? unstackedMin;
              }
              return oldWithinPercentages(maxSeriesValue) && Math.abs(maxSeriesValue - valueMin) >= minAbsoluteValue;
            };
          }
        }

        const valueFormat = getSeriesLabelFormat(seriesConfig, valueAxisConfig, valueAxisScale);

        const { categoryFocusPercentages, valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
        const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);

        let focusPercentage, aboveBase, textAnchor, dy, seriesPosition, x, y;
        // Each side resolves its own position (labelAboveBasePosition/
        // labelBelowBasePosition fall back to labelPosition).
        const aboveBasePosition = getLabelPosition(true, hasBase, seriesConfig);
        const belowBasePosition = getLabelPosition(false, hasBase, seriesConfig);
        // the side is a value-space choice; the anchor/dy direction is a pixel-space one
        const aboveBaseTextAnchor = getTextAnchor(inverted, !reversed, aboveBasePosition);
        const belowBaseTextAnchor = getTextAnchor(inverted, reversed, belowBasePosition);
        const aboveBaseDY = getDY(inverted, !reversed, aboveBasePosition);
        const belowBaseDY = getDY(inverted, reversed, belowBasePosition);

        const { length, getDefined, getSeriesPosition, getCategoryPosition, getOffsetCategoryPosition, categoryValueExtent, skipped, skipCategoryIndexMap } = seriesPositionData;
        // a bar label centers on the bar's own slot (group sub-slot, barWidthFraction), not the category slot
        const isBar = seriesConfig.renderer === RENDERER_BAR;

        for (let i = 0; i < length; i++) {
          const skipI = skipped ? skipCategoryIndexMap[i] : i;
          // a missing prior (NaN) reads as undefined here so the base/domain fallbacks above apply
          const minValue = minValues ? (isMissingValue(minValues[skipI]) ? undefined : minValues[skipI]) : null;
          if (getDefined(null, i) && !isMissingValue(labelValues[skipI]) && withinPercentages(maxValues[skipI]!, minValue)) {
            aboveBase = !hasBase || maxValues[skipI]! >= base;
            textAnchor = aboveBase ? aboveBaseTextAnchor : belowBaseTextAnchor;
            dy = aboveBase ? aboveBaseDY : belowBaseDY;

            focusPercentage = getCategoryFocusPercentage(categoryFocusPercentages[skipI], seriesFocusPercentage);
            labelFillColor = getSeriesLabelFillColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
            labelStrokeColor = getSeriesLabelStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
            const { strokeWidth: labelStrokeWidth, strokeOpacity: labelStrokeOpacity, fillOpacity: labelFillOpacity } = getFocusStyle(focusPercentage, seriesConfig.label.textStyle);
            seriesPosition = getSeriesPosition(null, i)! + getOffset(aboveBase);
            const categoryPosition = isBar ? getOffsetCategoryPosition(null, i)! + categoryValueExtent / 2 : getCategoryPosition(null, i)!;
            x = inverted ? seriesPosition : categoryPosition;
            y = inverted ? categoryPosition : seriesPosition;
            const label = this.labelShapes.get(skipI);
            label.attrs = { className: label.className, transform: translate(x, y),
              textAnchor, dy, stroke: labelStrokeColor, fill: labelFillColor, fillOpacity: labelFillOpacity, strokeOpacity: labelStrokeOpacity,
              strokeWidth: labelStrokeWidth, onPointerEnter: label.onPointerEnter, onPointerLeave: label.onPointerLeave, onClick: label.onClick };
            label.text = String(valueFormat(labelValues[skipI]!));
            labels.push(label);
          }
        }
        this.setPresent(true);
        // unattributed values, interpolated mid-animation: the tooltip live region reads the settled ones
        this.root.set({ className: mochartCssClasses['seriesLabels'],
          ariaHidden: accessibility ? 'true' : null });
        this.labels.sync(labels, labelAdapter);
        return;
      }
    }
    this.setPresent(false);
  }
}
