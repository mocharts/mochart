import { Renderer, svgEl } from '../render';

import { NONE } from '../config/core/constants';
import type { AxisConfigBase } from '../types/config';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface AxisTitleClipProps {
  axisConfig: AxisConfigBase;
  chartContentLayoutInfo: SpacingLayoutInfo;
  axisLayoutInfo: AxisLayoutInfo;
  axisTitleClipPathUniqueId: string;
}

export default class AxisTitleClip extends Renderer<AxisTitleClipProps> {
  root = svgEl('clipPath');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { axisConfig, chartContentLayoutInfo, axisLayoutInfo, axisTitleClipPathUniqueId } = this.props;
    if (axisConfig.visible && axisConfig.title.text !== NONE && axisConfig.title.truncationEnabled) {
      const { width: cWidth, height: cHeight } = chartContentLayoutInfo;
      const { titleBoundsX, titleBoundsY, titleBoundsWidth, titleBoundsHeight, vertical } = axisLayoutInfo;

      const x = vertical ? 0 : titleBoundsX;
      const y = vertical ? titleBoundsY : 0;
      const width = vertical ? cWidth : titleBoundsWidth;
      const height = vertical ? titleBoundsHeight : cHeight;

      this.setPresent(true);
      this.root.set({ id: axisTitleClipPathUniqueId });
      this.rect.set({ x, y, width, height });
    }
    else {
      this.setPresent(false);
    }
  }
}
