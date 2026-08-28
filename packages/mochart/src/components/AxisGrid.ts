import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { syncAxisLines } from './AxisLines';
import type { AxisLineHandle } from './AxisLines';
import type { AxisTick } from '../types/data';
import type { AxisConfigBase } from '../types/config';
import type { LayoutInfo } from '../types/layout';

export interface AxisGridProps {
  vertical: boolean;
  axisConfig: AxisConfigBase & { useSeriesFocus?: boolean };
  seriesLayoutInfo: LayoutInfo;
  axisFocusPercentage?: number | null;
  seriesFocusPercentage?: number | null;
  axisGridClass: string;
  axisTicks: AxisTick[];
}

export default class AxisGrid extends Renderer<AxisGridProps> {
  root = svgEl('g');
  lines = this.elList<AxisTick, AxisLineHandle>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { vertical, axisConfig, seriesLayoutInfo, axisFocusPercentage, seriesFocusPercentage, axisGridClass, axisTicks } = this.props;
    if (axisConfig.gridLine.visible) {
      const styleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage,
        axisConfig.useSeriesFocus ?? false, axisConfig.gridLine.style));

      this.setPresent(true);
      this.root.set({ className: axisGridClass });
      syncAxisLines(this.lines, axisTicks, {
        keyPrefix: 'gridLine-',
        className: mochartCssClasses['axisGridLine'],
        vertical,
        offset: (tick) => tick.position,
        hidden: (tick) => tick.hidden,
        x1: seriesLayoutInfo.x,
        y1: seriesLayoutInfo.y,
        x2: vertical ? seriesLayoutInfo.x + seriesLayoutInfo.width : seriesLayoutInfo.x,
        y2: vertical ? seriesLayoutInfo.y : seriesLayoutInfo.y + seriesLayoutInfo.height,
        styleAttributes
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
