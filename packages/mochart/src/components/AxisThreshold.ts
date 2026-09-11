import { Renderer, svgEl } from '../render';

import AxisThresholdShape from './AxisThresholdShape';
import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { resolveThresholds } from '../config/defaults/axisConfig';
import { getGradientReference, getPatternReference } from '../utils/svgUtils';
import { NONE } from '../config/core/constants';
import type { AxisThresholdShapeProps, ThresholdAxisConfig, ThresholdCategoryPositions } from './AxisThresholdShape';
import type { AxisLayoutInfo, LayoutInfo } from '../types/layout';
import type { PlotConfig } from '../types/config';

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
}

/** The patternIdMap key of one threshold's pattern definition: an axis key plus the entry index. */
export function getThresholdPatternKey(axisKey: string, thresholdIndex: number): string {
  return 'threshold__' + axisKey + '__' + thresholdIndex;
}

export default class AxisThreshold extends Renderer<AxisThresholdProps> {
  root = svgEl('g');
  lines = this.rendererList(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { hidden } = this.props;
    if (!hidden) {
      const { axisConfig, axisLayoutInfo, seriesLayoutInfo, axisDomain, vertical, ascending, positionRange, axisFocusPercentage, seriesFocusPercentage, axisThresholdClass, front,
        axisKey, categoryPositions, gradientIdMap, patternIdMap } = this.props;
      const { useSeriesFocus = false } = axisConfig;
      const thresholds = resolveThresholds(axisConfig.thresholds);

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
          fillReference = getPatternReference(patternIdMap[getThresholdPatternKey(axisKey, thresholdIndex)]!);
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
            titleFill: title.fill ?? null, titleFillOpacity: title.fillOpacity ?? null }
        });
      });
      this.lines.sync(items);
    }
    else {
      this.setPresent(false);
    }
  }
}
