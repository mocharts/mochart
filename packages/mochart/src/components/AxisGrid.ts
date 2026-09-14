import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { getMinorGridLine } from '../config/core/minorConfig';
import { syncAxisLines, getPassTicks } from './AxisLines';
import type { AxisLineHandle, PassTick } from './AxisLines';
import type { AxisTick } from '../types/data';
import type { AxisConfigBase } from '../types/config';
import type { LayoutInfo } from '../types/layout';

export interface AxisGridProps {
  front: boolean;
  vertical: boolean;
  axisConfig: AxisConfigBase & { useSeriesFocus?: boolean };
  seriesLayoutInfo: LayoutInfo;
  axisFocusPercentage?: number | null;
  seriesFocusPercentage?: number | null;
  axisGridClass: string;
  axisTicks: AxisTick[];
}

/** Whether a pass draws any of an axis's grid lines: those of either kind that are visible and drawn in it. */
export function gridLinesInPass(axisConfig: AxisConfigBase, front: boolean): boolean {
  const minorGridLine = getMinorGridLine(axisConfig.gridLine);
  return (front === axisConfig.gridLine.front && axisConfig.gridLine.visible) || (front === minorGridLine.front && minorGridLine.visible);
}

export default class AxisGrid extends Renderer<AxisGridProps> {
  root = svgEl('g');
  lines = this.elList<PassTick, AxisLineHandle>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { front, vertical, axisConfig, seriesLayoutInfo, axisFocusPercentage, seriesFocusPercentage, axisGridClass, axisTicks } = this.props;
    const minorGridLine = getMinorGridLine(axisConfig.gridLine);
    const majorPass = front === axisConfig.gridLine.front && axisConfig.gridLine.visible;
    const minorPass = front === minorGridLine.front && minorGridLine.visible;
    if (majorPass || minorPass) {
      const useSeriesFocus = axisConfig.useSeriesFocus ?? false;
      const styleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, axisConfig.gridLine.style));
      const minorStyleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, minorGridLine.style));
      const x1 = seriesLayoutInfo.x;
      const y1 = seriesLayoutInfo.y;
      const x2 = vertical ? seriesLayoutInfo.x + seriesLayoutInfo.width : seriesLayoutInfo.x;
      const y2 = vertical ? seriesLayoutInfo.y : seriesLayoutInfo.y + seriesLayoutInfo.height;

      this.setPresent(true);
      this.root.set({ className: axisGridClass });
      syncAxisLines(this.lines, getPassTicks(axisTicks, majorPass, minorPass), {
        keyPrefix: 'gridLine-',
        className: mochartCssClasses['axisGridLine'],
        vertical,
        index: ({ index }) => index,
        offset: ({ tick }) => tick.position,
        hidden: ({ tick }) => tick.hidden,
        minor: ({ tick }) => tick.minor === true,
        minorClassName: mochartCssClasses['axisMinorGridLine'],
        x1, y1, x2, y2,
        styleAttributes,
        minorLine: { x1, y1, x2, y2, styleAttributes: minorStyleAttributes }
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
