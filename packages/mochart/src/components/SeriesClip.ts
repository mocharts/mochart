import { Renderer, svgEl } from '../render';

import type { EnhancedMochartConfig } from '../types/enhanced';
import type { LayoutInfo } from '../types/layout';

interface SeriesClipProps {
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  seriesClipPathUniqueId: string;
}

/** Confines the series to the plot so values past an explicit axis bound cannot paint over the chrome; `plot.clipOverflow` widens the clip per side. */
export default class SeriesClip extends Renderer<SeriesClipProps> {
  root = svgEl('clipPath');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, seriesLayoutInfo, seriesClipPathUniqueId } = this.props;
    const { top, right, bottom, left } = mochartConfig.plot.clipOverflow;
    this.root.set({ id: seriesClipPathUniqueId });
    this.rect.set({
      x: seriesLayoutInfo.x - left,
      y: seriesLayoutInfo.y - top,
      width: Math.max(0, seriesLayoutInfo.width + left + right),
      height: Math.max(0, seriesLayoutInfo.height + top + bottom)
    });
  }
}
