import { Renderer, svgEl } from '../render';
import type { El } from '../render';

import { getCutoutRectanglePath } from '../utils/svgUtils';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { SpacingLayoutInfo } from '../types/layout';

interface TooltipClipProps {
  mochartConfig: EnhancedMochartConfig;
  tooltipVisible: boolean;
  tooltipShown: boolean;
  width: number;
  height: number;
  tooltipLayoutInfo: SpacingLayoutInfo;
  chartContentLayoutInfo: SpacingLayoutInfo;
  tooltipClipPathUniqueId: string;
}

export default class TooltipClip extends Renderer<TooltipClipProps> {
  root = svgEl('clipPath');
  shape: El | null = null;
  shapeTag: 'path' | 'rect' | null = null;

  create() {
    return this.root.node;
  }

  setShape(tag: 'path' | 'rect'): El {
    if (this.shapeTag !== tag) {
      if (this.shape !== null) {
        this.root.node.removeChild(this.shape.node);
      }
      this.shape = svgEl(tag);
      this.shapeTag = tag;
      this.root.append(this.shape);
    }
    return this.shape!;
  }

  sync() {
    const { mochartConfig, tooltipVisible, tooltipShown, width, height, tooltipLayoutInfo, chartContentLayoutInfo, tooltipClipPathUniqueId } = this.props;
    if (mochartConfig.tooltip.visible && tooltipVisible) {
      this.setPresent(true);
      this.root.set({ id: tooltipClipPathUniqueId, clipRule: 'evenodd' });
      if (tooltipShown) {
        const pathPoints = getCutoutRectanglePath(0, 0, width, height, tooltipLayoutInfo.x - chartContentLayoutInfo.x,
          tooltipLayoutInfo.y - chartContentLayoutInfo.y, tooltipLayoutInfo.width, tooltipLayoutInfo.height);
        this.setShape('path').set({ fillRule: 'evenodd', d: pathPoints });
      }
      else {
        this.setShape('rect').set({ x: 0, y: 0, width, height });
      }
    }
    else {
      this.setPresent(false);
    }
  }
}
