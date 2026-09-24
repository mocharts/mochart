import { Renderer, svgEl } from '../render/index.js';
import type { LegendConfig } from '../types/config.js';
import type { SpacingLayoutInfo } from '../types/layout.js';

interface LegendClipProps {
  legendConfig: LegendConfig;
  chartContentLayoutInfo: SpacingLayoutInfo;
  // undefined when the layout placed no legend (no series)
  legendItemTextLayoutInfo: SpacingLayoutInfo | undefined;
  legendClipPathUniqueId: string;
}

export default class LegendClip extends Renderer<LegendClipProps> {
  root = svgEl('clipPath');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { legendConfig, chartContentLayoutInfo, legendItemTextLayoutInfo, legendClipPathUniqueId } = this.props;
    if (legendConfig.visible && legendConfig.truncation.enabled && legendItemTextLayoutInfo !== undefined) {
      const { y, height } = chartContentLayoutInfo;
      const { x, width } = legendItemTextLayoutInfo;

      this.setPresent(true);
      this.root.set({ id: legendClipPathUniqueId });
      this.rect.set({ x, y, width, height });
    }
    else {
      this.setPresent(false);
    }
  }
}
