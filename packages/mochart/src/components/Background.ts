import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { styleToAttributes } from '../utils/style';
import type { Style } from '../types/config';
import type { SpacingLayoutInfo } from '../types/layout';
import type { Bounds } from '../types/geometry';

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
