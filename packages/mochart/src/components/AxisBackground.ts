import { Renderer, svgEl } from '../render/index.js';

import Background from './Background.js';
import type { AxisConfigBase } from '../types/config.js';
import type { AxisLayoutInfo } from '../types/layout.js';

interface AxisBackgroundProps {
  axisConfig: AxisConfigBase;
  axisLayoutInfo: AxisLayoutInfo;
}

export default class AxisBackground extends Renderer<AxisBackgroundProps> {
  root = svgEl('g');
  background = this.slot(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { axisConfig, axisLayoutInfo } = this.props;
    this.background.set(Background, { config: axisConfig, classKey: 'axisBackground', spacingRelative: true, spacingLayoutInfo: axisLayoutInfo });
  }
}
