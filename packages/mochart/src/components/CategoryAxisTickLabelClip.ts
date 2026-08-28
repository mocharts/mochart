import { Renderer, svgEl } from '../render';

import { ANCHOR_END, ANCHOR_MIDDLE } from '../config/core/constants';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface CategoryAxisTickLabelClipProps {
  mochartConfig: EnhancedMochartConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  categoryAxisTickLabelClipPathUniqueId: string;
  maxTickLabelLength: number;
}

export default class CategoryAxisTickLabelClip extends Renderer<CategoryAxisTickLabelClipProps> {
  root = svgEl('clipPath');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, categoryAxisLayoutInfo, plotLayoutInfo, categoryAxisTickLabelClipPathUniqueId } = this.props;
    let { maxTickLabelLength } = this.props;
    const { categoryAxis: categoryAxisConfig } = mochartConfig;
    if (categoryAxisConfig.visible && categoryAxisConfig.tickLabel.truncationEnabled) {
      const { tickLabelParallel, tickHeight, tickLabelAnchor, vertical } = categoryAxisLayoutInfo;
      const { truncationMaxFraction: tickLabelTruncationMaxFraction, rotation: tickLabelRotation } = categoryAxisConfig.tickLabel;
      if (!tickLabelParallel) {
        maxTickLabelLength = Math.max(categoryAxisConfig.tickLabel.truncationMinLength,
          tickLabelTruncationMaxFraction * (vertical ? plotLayoutInfo.width : plotLayoutInfo.height));
      }
      const tickRotationTransform = tickLabelRotation === 0 ? null : 'rotate(' + tickLabelRotation + ')';
      const x = tickLabelAnchor !== ANCHOR_MIDDLE ? (tickLabelAnchor === ANCHOR_END ? -1 * maxTickLabelLength : 0) : -1 * maxTickLabelLength / 2;
      const y = -1 * tickHeight;
      const width = maxTickLabelLength;
      const height = 2 * tickHeight;

      this.setPresent(true);
      this.root.set({ id: categoryAxisTickLabelClipPathUniqueId });
      this.rect.set({ transform: tickRotationTransform, x, y, width, height });
    }
    else {
      this.setPresent(false);
    }
  }
}
