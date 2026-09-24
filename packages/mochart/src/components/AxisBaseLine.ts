import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { translate } from '../utils/utils.js';
import { getAxisFocusStyle } from '../utils/FocusValue.js';
import { styleToAttributes } from '../utils/style.js';
import { NONE } from '../config/core/constants.js';
import type { PlotConfig } from '../types/config.js';
import type { EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { LayoutInfo } from '../types/layout.js';

interface AxisBaseLineProps {
  valueAxisConfig: EnhancedValueAxisConfig;
  basePercentage: number;
  axisBaseLineClass: string;
  plotConfig: PlotConfig;
  seriesLayoutInfo: LayoutInfo;
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
}

export default class AxisBaseLine extends Renderer<AxisBaseLineProps> {
  root = svgEl('g');
  inner = svgEl('g');
  line = svgEl('line');

  create() {
    this.inner.append(this.line);
    this.root.append(this.inner);
    return this.root.node;
  }

  sync() {
    const { valueAxisConfig, basePercentage, axisBaseLineClass } = this.props;
    const { base, baseLine } = valueAxisConfig;
    if (base !== NONE && baseLine.visible && basePercentage > 0 && basePercentage < 1) {
      const { plotConfig, seriesLayoutInfo, axisFocusPercentage, seriesFocusPercentage } = this.props;
      const { inverted } = plotConfig;

      const style = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage,
        valueAxisConfig.useSeriesFocus, valueAxisConfig.baseLine.style));

      const vertical = !inverted;
      const positionPercentage = valueAxisConfig.reversed ? 1 - basePercentage : basePercentage;

      let baseX = 0;
      let baseY = 0;
      if (vertical) {
        baseY = (1 - positionPercentage) * seriesLayoutInfo.height;
      }
      else {
        baseX = positionPercentage * seriesLayoutInfo.width;
      }

      this.setPresent(true);
      this.root.set({ className: axisBaseLineClass });
      this.inner.set({ className: mochartCssClasses['axisBaseLine'], transform: translate(baseX, baseY) });
      this.line.set({ x1: seriesLayoutInfo.x, y1: seriesLayoutInfo.y,
        x2: vertical ? seriesLayoutInfo.x + seriesLayoutInfo.width : seriesLayoutInfo.x,
        y2: vertical ? seriesLayoutInfo.y : seriesLayoutInfo.y + seriesLayoutInfo.height,
        ...style });
    }
    else {
      this.setPresent(false);
    }
  }
}
