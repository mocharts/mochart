import { Renderer, svgEl } from '../render';

import AxisThresholdShape from './AxisThresholdShape';
import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { resolveFontStyle } from '../utils/font';
import { resolveThresholds } from '../config/defaults/axisConfig';
import { getSteppedThresholds } from '../data/ThresholdSteps';
import { getGradientReference, getPatternReference } from '../utils/svgUtils';
import type { ResolvedThreshold } from '../config/defaults/axisConfig';
import type { CategoryValue } from '../types/data';
import { NONE } from '../config/core/constants';
import type { AxisThresholdShapeProps, ThresholdAxisConfig, ThresholdCategoryPositions } from './AxisThresholdShape';
import type { AxisLayoutInfo, LayoutInfo } from '../types/layout';
import type { FontConfig, PlotConfig } from '../types/config';

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
  private stepped: { step: unknown; domainMin: unknown; domainMax: unknown; categoryValues: unknown; thresholds: ResolvedThreshold[] } | null = null;

  private getSteppedThresholds(axisConfig: ThresholdAxisConfig, axisDomain: AxisThresholdProps['axisDomain'], categoryValues: readonly CategoryValue[] | null): ResolvedThreshold[] {
    const domainMin = axisDomain[0]?.valueOf();
    const domainMax = axisDomain[1]?.valueOf();
    const cached = this.stepped;
    if (cached === null || cached.step !== axisConfig.thresholdStep || cached.domainMin !== domainMin || cached.domainMax !== domainMax || cached.categoryValues !== categoryValues) {
      this.stepped = { step: axisConfig.thresholdStep, domainMin, domainMax, categoryValues, thresholds: getSteppedThresholds(axisConfig, axisDomain, categoryValues) };
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
      const thresholds = configured.concat(this.getSteppedThresholds(axisConfig, axisDomain, categoryPositions?.values ?? null));

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
