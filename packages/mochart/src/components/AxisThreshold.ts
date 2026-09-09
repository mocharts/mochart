import { Renderer, svgEl } from '../render';

import AxisThresholdLine from './AxisThresholdLine';
import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { resolveThresholds } from '../config/defaults/axisConfig';
import type { AxisThresholdLineProps, ThresholdAxisConfig } from './AxisThresholdLine';
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
      const { axisConfig, axisLayoutInfo, seriesLayoutInfo, axisDomain, vertical, ascending, positionRange, axisFocusPercentage, seriesFocusPercentage, axisThresholdClass, front } = this.props;
      const { useSeriesFocus = false } = axisConfig;
      const thresholds = resolveThresholds(axisConfig.thresholds);

      this.setPresent(true);
      this.root.set({ className: axisThresholdClass });

      const items: { key: string; ctor: typeof AxisThresholdLine; props: AxisThresholdLineProps }[] = [];
      thresholds.forEach((threshold, thresholdIndex) => {
        // each entry layers independently: front entries render in the front pass, back entries behind
        if (front !== threshold.front) {
          return;
        }
        const line = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, threshold.style));
        const title = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, threshold.title.textStyle));
        items.push({
          key: 'threshold-' + thresholdIndex,
          ctor: AxisThresholdLine,
          props: { axisConfig, threshold, thresholdIndex, axisLayoutInfo, seriesLayoutInfo, axisDomain,
            axisThresholdLineClass: mochartCssClasses['axisThreshold'], vertical, ascending, positionRange,
            stroke: line.stroke ?? null, strokeOpacity: line.strokeOpacity ?? null,
            strokeWidth: line.strokeWidth ?? null, strokeDashArray: line.strokeDasharray ?? null,
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
