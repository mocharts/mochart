import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import type { AxisConfigBase } from '../types/config';
import type { AxisLayoutInfo } from '../types/layout';

interface AxisLineProps {
  axisConfig: AxisConfigBase & { useSeriesFocus?: boolean };
  axisLayoutInfo: AxisLayoutInfo;
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
}

export default class AxisLine extends Renderer<AxisLineProps> {
  root = svgEl('g');
  line = svgEl('line');

  create() {
    this.root.append(this.line);
    return this.root.node;
  }

  sync() {
    const { axisConfig } = this.props;
    if (axisConfig.axisLine.visible === true) {
      const { axisLayoutInfo, axisFocusPercentage, seriesFocusPercentage } = this.props;
      const { axisLineX1, axisLineY1, axisLineX2, axisLineY2 } = axisLayoutInfo;

      const style = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage,
        axisConfig.useSeriesFocus ?? false, axisConfig.axisLine.style));

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['axisLine'] });
      this.line.set({ x1: axisLineX1, y1: axisLineY1, x2: axisLineX2, y2: axisLineY2,
        ...style });
    }
    else {
      this.setPresent(false);
    }
  }
}
