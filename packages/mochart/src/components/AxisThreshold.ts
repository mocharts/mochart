import { Renderer, svgEl } from '../render/index.js';

import AxisThresholdShape from './AxisThresholdShape.js';
import { mochartCssClasses } from '../utils/ChartDom.js';
import { getAxisFocusStyle } from '../utils/FocusValue.js';
import { styleToAttributes } from '../utils/style.js';
import { resolveFontStyle } from '../utils/font.js';
import { resolveThresholds } from '../config/defaults/axisConfig.js';
import { getSteppedThresholds, steppedThresholdsFit } from '../data/ThresholdSteps.js';
import { getGradientReference, getPatternReference } from '../utils/svgUtils.js';
import type { ResolvedThreshold } from '../config/defaults/axisConfig.js';
import type { CategoryValue } from '../types/data.js';
import { NONE } from '../config/core/constants.js';
import type { AxisThresholdShapeProps, ThresholdAxisConfig, ThresholdCategoryPositions } from './AxisThresholdShape.js';
import type { AxisLayoutInfo, LayoutInfo } from '../types/layout.js';
import type { FontConfig, PlotConfig } from '../types/config.js';

interface AxisThresholdProps {
  hidden: boolean;
  front: boolean;
  plotConfig: PlotConfig;
  axisConfig: ThresholdAxisConfig;
  axisLayoutInfo: AxisLayoutInfo;
  seriesLayoutInfo: LayoutInfo;
  axisDomain: [number | Date | null, number | Date | null];
  vertical: boolean;
  ascending: boolean;
  positionRange: [number, number];
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
  axisThresholdClass: string;
  /** The key the axis's threshold pattern definitions are registered under in patternIdMap. */
  axisKey: string;
  /** How the axis is named in a console warning. */
  axisName: string;
  categoryPositions: ThresholdCategoryPositions | null;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  chartFont: FontConfig;
}

/** The patternIdMap key of one threshold's pattern definition: an axis key plus the entry index, or 'step' for the axis's thresholdStep. */
export function getThresholdPatternKey(axisKey: string, thresholdIndex: number | 'step'): string {
  return 'threshold__' + axisKey + '__' + thresholdIndex;
}

export default class AxisThreshold extends Renderer<AxisThresholdProps> {
  root = svgEl('g');
  lines = this.rendererList(this.root);

  /** the last expansion, kept while its inputs hold so the shape renderers' shallow-equal skips see stable thresholds */
  private stepped: { step: unknown; domainMin: unknown; domainMax: unknown; categoryValues: unknown; axisLength: number; thresholds: ResolvedThreshold[] } | null = null;
  /** whether the last expansion found the step too dense: the warning is for the change, not for every frame of an animated domain */
  private steppedTooDense = false;

  private getSteppedThresholds(axisConfig: ThresholdAxisConfig, axisDomain: AxisThresholdProps['axisDomain'], categoryValues: readonly CategoryValue[] | null, categoryKeys: readonly CategoryValue[] | null, axisLength: number): ResolvedThreshold[] {
    const domainMin = axisDomain[0]?.valueOf();
    const domainMax = axisDomain[1]?.valueOf();
    const cached = this.stepped;
    if (cached === null || cached.step !== axisConfig.thresholdStep || cached.domainMin !== domainMin || cached.domainMax !== domainMax || cached.categoryValues !== categoryValues || cached.axisLength !== axisLength) {
      const { front, axisName } = this.props;
      // the pass that would draw the step's shapes warns, so the front and back renderers do not both report it
      const tooDense = front === axisConfig.thresholdStep.front && axisConfig.thresholdStep.visible && !steppedThresholdsFit(axisConfig, axisDomain, axisLength);
      if (tooDense && !this.steppedTooDense) {
        console.warn('mochart ' + axisName + ' thresholdStep draws nothing: its thresholds would be closer together than minSpacing (' + axisConfig.thresholdStep.minSpacing + 'px)');
      }
      this.steppedTooDense = tooDense;
      this.stepped = { step: axisConfig.thresholdStep, domainMin, domainMax, categoryValues, axisLength, thresholds: getSteppedThresholds(axisConfig, axisDomain, categoryValues, categoryKeys, axisLength) };
    }
    return this.stepped!.thresholds;
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { hidden } = this.props;
    if (!hidden) {
      const { axisConfig, axisLayoutInfo, seriesLayoutInfo, axisDomain, vertical, ascending, positionRange, axisFocusPercentage, seriesFocusPercentage, axisThresholdClass, front,
        axisKey, categoryPositions, gradientIdMap, patternIdMap, chartFont } = this.props;
      const { useSeriesFocus = false } = axisConfig;
      const configured = resolveThresholds(axisConfig.thresholds);
      // the stepped thresholds follow the configured entries, so title layout indexes stay those of the config
      const axisLength = (vertical ? seriesLayoutInfo.height : seriesLayoutInfo.width) * Math.abs(positionRange[1] - positionRange[0]);
      const thresholds = configured.concat(this.getSteppedThresholds(axisConfig, axisDomain, categoryPositions?.values ?? null, categoryPositions?.keys ?? null, axisLength));

      this.setPresent(true);
      this.root.set({ className: axisThresholdClass });

      const items: { key: string; ctor: typeof AxisThresholdShape; props: AxisThresholdShapeProps }[] = [];
      thresholds.forEach((threshold, thresholdIndex) => {
        // each entry layers independently: front entries render in the front pass, back entries behind
        if (front !== threshold.front) {
          return;
        }
        const line = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, threshold.style));
        const title = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, threshold.title.textStyle));
        let fillReference: string | null = null;
        if (threshold.pattern !== NONE) {
          fillReference = getPatternReference(patternIdMap[getThresholdPatternKey(axisKey, thresholdIndex < configured.length ? thresholdIndex : 'step')]!);
        }
        else if (threshold.gradient !== NONE) {
          fillReference = getGradientReference(gradientIdMap[threshold.gradient]!);
        }
        items.push({
          key: 'threshold-' + thresholdIndex,
          ctor: AxisThresholdShape,
          props: { axisConfig, threshold, thresholdIndex, axisLayoutInfo, seriesLayoutInfo, axisDomain, categoryPositions,
            axisThresholdShapeClass: mochartCssClasses['axisThreshold'], vertical, ascending, positionRange,
            stroke: line.stroke ?? null, strokeOpacity: line.strokeOpacity ?? null,
            strokeWidth: line.strokeWidth ?? null, strokeDashArray: line.strokeDasharray ?? null,
            fill: line.fill ?? null, fillOpacity: line.fillOpacity ?? null, fillReference,
            titleStroke: title.stroke ?? null, titleStrokeOpacity: title.strokeOpacity ?? null, titleStrokeWidth: title.strokeWidth ?? null,
            titleFill: title.fill ?? null, titleFillOpacity: title.fillOpacity ?? null,
            titleFontStyle: resolveFontStyle(threshold.title.font, chartFont) }
        });
      });
      this.lines.sync(items);
    }
    else {
      this.setPresent(false);
    }
  }
}
