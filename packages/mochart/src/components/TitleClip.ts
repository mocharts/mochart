import { Renderer, svgEl } from '../render/index.js';
import { hasText } from '../utils/utils.js';

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
    if (hasText(titleConfig.text) && titleConfig.truncation.enabled) {
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
