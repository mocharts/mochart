import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { styleToAttributes } from '../utils/style.js';
import type { Style } from '../types/config.js';
import type { SpacingLayoutInfo } from '../types/layout.js';
import type { Bounds } from '../types/geometry.js';

type CssClassKey = keyof typeof mochartCssClasses;

interface BackgroundConfig {
  backgroundStyle: Style;
}

interface BackgroundProps {
  config: BackgroundConfig;
  classKey: CssClassKey;
  spacingRelative: boolean;
  spacingLayoutInfo: SpacingLayoutInfo | Bounds;
}

export default class Background extends Renderer<BackgroundProps> {
  root = svgEl('g');
  rect = svgEl('rect');

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { config, classKey, spacingRelative, spacingLayoutInfo } = this.props;
    const bounds = 'marginBounds' in spacingLayoutInfo
      ? (spacingRelative ? spacingLayoutInfo.marginRelativeBounds : spacingLayoutInfo.marginBounds)
      : spacingLayoutInfo;
    const { x, y, width, height } = bounds;
    const backgroundProps = styleToAttributes(config.backgroundStyle);
    this.root.set({ className: mochartCssClasses[classKey] });
    this.rect.set({ x, y, width, height, ...backgroundProps });
  }
}
