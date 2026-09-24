import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { styleToAttributes } from '../utils/style.js';
import { syncAxisLines } from './AxisLines.js';
import type { AxisLineHandle } from './AxisLines.js';
import type { AxisConfigBase } from '../types/config.js';
import type { AxisLayoutInfo } from '../types/layout.js';

interface AxisFocusTickMarksProps {
  axisConfig: AxisConfigBase;
  axisLayoutInfo: AxisLayoutInfo;
  focusPercentages: number[];
}

export default class AxisFocusTickMarks extends Renderer<AxisFocusTickMarksProps> {
  root = svgEl('g');
  ticks = this.elList<number, AxisLineHandle>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { axisConfig } = this.props;
    if (axisConfig.focusTickMark.visible) {
      const { axisLayoutInfo, focusPercentages } = this.props;
      const { vertical, focusTickMarkX1, focusTickMarkY1, focusTickMarkX2, focusTickMarkY2 } = axisLayoutInfo;

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['axisFocusTickMarks'] });
      syncAxisLines(this.ticks, focusPercentages, {
        keyPrefix: 'focus-tick-mark-',
        className: mochartCssClasses['axisFocusTickMark'],
        vertical,
        offset: (focusPercentage) => focusPercentage * (vertical ? axisLayoutInfo.height : axisLayoutInfo.width),
        x1: focusTickMarkX1,
        y1: focusTickMarkY1,
        x2: focusTickMarkX2,
        y2: focusTickMarkY2,
        styleAttributes: styleToAttributes(axisConfig.focusTickMark.style)
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
