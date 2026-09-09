import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { syncAxisLines } from './AxisLines';
import type { AxisLineHandle } from './AxisLines';
import type { AxisTick } from '../types/data';
import type { AxisConfigBase } from '../types/config';
import type { AxisLayoutInfo } from '../types/layout';

interface AxisTickMarksProps {
  axisConfig: AxisConfigBase & { useSeriesFocus?: boolean };
  axisLayoutInfo: AxisLayoutInfo;
  axisTicks: AxisTick[];
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
}

export default class AxisTickMarks extends Renderer<AxisTickMarksProps> {
  root = svgEl('g');
  ticks = this.elList<AxisTick, AxisLineHandle>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { axisConfig } = this.props;
    if (axisConfig.tickMark.visible) {
      const { axisLayoutInfo, axisTicks, axisFocusPercentage, seriesFocusPercentage } = this.props;
      const { vertical, tickMarkX1, tickMarkY1, tickMarkX2, tickMarkY2 } = axisLayoutInfo;

      const styleAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage,
        axisConfig.useSeriesFocus ?? false, axisConfig.tickMark.style));

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['axisTickMarks'] });
      syncAxisLines(this.ticks, axisTicks, {
        keyPrefix: 'tick-mark-',
        className: mochartCssClasses['axisTickMark'],
        vertical,
        offset: (tick) => tick.position,
        hidden: (tick) => tick.hidden,
        x1: tickMarkX1,
        y1: tickMarkY1,
        x2: tickMarkX2,
        y2: tickMarkY2,
        styleAttributes
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
