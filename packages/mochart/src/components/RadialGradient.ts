import { Renderer, svgEl } from '../render/index.js';
import type { ElListAdapter } from '../render/index.js';
import type { GradientStop, RadialGradientConfig } from '../types/config.js';

interface RadialGradientProps {
  uniqueId: string;
  radialGradientConfig: RadialGradientConfig;
}

function toPercent(aNumber: number): string {
  return (aNumber * 100) + '%';
}

const stopAdapter: ElListAdapter<GradientStop, { root: ReturnType<typeof svgEl> }> = {
  key: (_stop, i) => i,
  create: () => ({ root: svgEl('stop') }),
  update: (handle, stop) => {
    handle.root.set({ offset: toPercent(stop.offset), stopColor: stop.color, stopOpacity: stop.opacity });
  }
};

export default class RadialGradient extends Renderer<RadialGradientProps> {
  root = svgEl('radialGradient');
  stops = this.elList<GradientStop>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { uniqueId, radialGradientConfig } = this.props;
    this.root.set({
      id: uniqueId,
      cx: toPercent(radialGradientConfig.cx),
      cy: toPercent(radialGradientConfig.cy),
      fx: toPercent(radialGradientConfig.fx),
      fy: toPercent(radialGradientConfig.fy),
      r: toPercent(radialGradientConfig.r),
      gradientTransform: 'rotate(' + radialGradientConfig.rotation + ')'
    });
    this.stops.sync(radialGradientConfig.stops ?? [], stopAdapter);
  }
}
