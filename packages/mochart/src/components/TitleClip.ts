import { Renderer, svgEl } from '../render/index.js';

import { NONE } from '../config/core/constants.js';
import type { TitleConfig } from '../types/config.js';
import type { SpacingLayoutInfo } from '../types/layout.js';

interface TitleClipProps {
  titleConfig: TitleConfig;
  chartContentLayoutInfo: SpacingLayoutInfo;
  titleTextLayoutInfo: SpacingLayoutInfo;
  titleClipPathUniqueId: string;
}

export default class TitleClip extends Renderer<TitleClipProps> {
  root = svgEl('clipPath');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { titleConfig, chartContentLayoutInfo, titleTextLayoutInfo, titleClipPathUniqueId } = this.props;
    if (titleConfig.text !== NONE && titleConfig.truncation.enabled) {
      const { y, height } = chartContentLayoutInfo;
      const { x, paddingRelativeBounds } = titleTextLayoutInfo;
      const { width } = paddingRelativeBounds;

      this.setPresent(true);
      this.root.set({ id: titleClipPathUniqueId });
      this.rect.set({ x: x + paddingRelativeBounds.x, y, width, height });
    }
    else {
      this.setPresent(false);
    }
  }
}
