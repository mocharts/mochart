import { Renderer, svgEl } from '../render';

import { ANCHOR_END, ANCHOR_MIDDLE } from '../config/core/constants';
import { getMinorTickLabel } from '../config/core/minorConfig';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface CategoryAxisTickLabelClipProps {
  mochartConfig: EnhancedMochartConfig;
  /** The minor tick labels' clip, from their own truncation, rotation, anchor and length. */
  minor: boolean;
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
    const { mochartConfig, minor, categoryAxisLayoutInfo, plotLayoutInfo, categoryAxisTickLabelClipPathUniqueId } = this.props;
    let { maxTickLabelLength } = this.props;
    const { categoryAxis: categoryAxisConfig } = mochartConfig;
    const minorTickLabel = minor ? getMinorTickLabel(categoryAxisConfig.tickLabel) : null;
    const tickLabelTruncation = minorTickLabel === null ? categoryAxisConfig.tickLabel.truncation : minorTickLabel.truncation!;
    const tickLabelRotation = minorTickLabel === null ? categoryAxisConfig.tickLabel.rotation : minorTickLabel.rotation;
    // a minor clip only once minor labels can reference it
    const present = categoryAxisConfig.visible && tickLabelTruncation.enabled && (minorTickLabel === null || minorTickLabel.visible);
    if (present) {
      const { vertical } = categoryAxisLayoutInfo;
      const tickLabelParallel = minor ? categoryAxisLayoutInfo.minorTickLabelParallel : categoryAxisLayoutInfo.tickLabelParallel;
      const tickHeight = minor ? categoryAxisLayoutInfo.minorTickHeight : categoryAxisLayoutInfo.tickHeight;
      const tickLabelAnchor = minor ? categoryAxisLayoutInfo.minorTickLabelAnchor : categoryAxisLayoutInfo.tickLabelAnchor;
      if (!tickLabelParallel) {
        maxTickLabelLength = Math.max(tickLabelTruncation.minLength,
          tickLabelTruncation.maxFraction * (vertical ? plotLayoutInfo.width : plotLayoutInfo.height));
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
