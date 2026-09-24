import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { getAxisFocusStyle } from '../utils/FocusValue.js';
import { styleToAttributes } from '../utils/style.js';
import { getMinorTickMark } from '../config/core/minorConfig.js';
import { syncAxisLines, getPassTicks } from './AxisLines.js';
import type { AxisLineHandle, PassTick } from './AxisLines.js';
import type { AxisTick } from '../types/data.js';
import type { AxisConfigBase } from '../types/config.js';
import type { AxisLayoutInfo } from '../types/layout.js';

interface AxisTickMarksProps {
  front: boolean;
  axisConfig: AxisConfigBase & { useSeriesFocus?: boolean };
  axisLayoutInfo: AxisLayoutInfo;
  axisTicks: AxisTick[];
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
}

export default class AxisTickMarks extends Renderer<AxisTickMarksProps> {
  root = svgEl('g');
  ticks = this.elList<PassTick, AxisLineHandle>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { front, axisConfig } = this.props;
    const minorTickMark = getMinorTickMark(axisConfig.tickMark);
    const majorPass = front === axisConfig.tickMark.front && axisConfig.tickMark.visible;
    const minorPass = front === minorTickMark.front && minorTickMark.visible;
    if (majorPass || minorPass) {
      const { axisLayoutInfo, axisTicks, axisFocusPercentage, seriesFocusPercentage } = this.props;
      const { vertical, tickMarkX1, tickMarkY1, tickMarkX2, tickMarkY2, minorTickMarkX1, minorTickMarkY1, minorTickMarkX2, minorTickMarkY2 } = axisLayoutInfo;
      const useSeriesFocus = axisConfig.useSeriesFocus ?? false;

      const styleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, axisConfig.tickMark.style));
      const minorStyleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, minorTickMark.style));

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['axisTickMarks'] });
      syncAxisLines(this.ticks, getPassTicks(axisTicks, majorPass, minorPass), {
        keyPrefix: 'tick-mark-',
        className: mochartCssClasses['axisTickMark'],
        vertical,
        index: ({ index }) => index,
        offset: ({ tick }) => tick.position,
        hidden: ({ tick }) => tick.hidden,
        minor: ({ tick }) => tick.minor === true,
        minorClassName: mochartCssClasses['axisMinorTickMark'],
        x1: tickMarkX1,
        y1: tickMarkY1,
        x2: tickMarkX2,
        y2: tickMarkY2,
        styleAttributes,
        minorLine: { x1: minorTickMarkX1, y1: minorTickMarkY1, x2: minorTickMarkX2, y2: minorTickMarkY2, styleAttributes: minorStyleAttributes }
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
