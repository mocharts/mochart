import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { translate } from '../utils/utils';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { NONE } from '../config/core/constants';
import type { PlotConfig } from '../types/config';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { LayoutInfo } from '../types/layout';

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
