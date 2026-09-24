import { Renderer, svgEl } from '../render/index.js';
import type { ElListAdapter } from '../render/index.js';
import type { GradientStop, LinearGradientConfig } from '../types/config.js';

interface LinearGradientProps {
  uniqueId: string;
  linearGradientConfig: LinearGradientConfig;
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

export default class LinearGradient extends Renderer<LinearGradientProps> {
  root = svgEl('linearGradient');
  stops = this.elList<GradientStop>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { uniqueId, linearGradientConfig } = this.props;
    this.root.set({
      id: uniqueId,
      x1: toPercent(linearGradientConfig.x1),
      y1: toPercent(linearGradientConfig.y1),
      x2: toPercent(linearGradientConfig.x2),
      y2: toPercent(linearGradientConfig.y2),
      gradientTransform: 'rotate(' + linearGradientConfig.rotation + ')'
    });
    this.stops.sync(linearGradientConfig.stops ?? [], stopAdapter);
  }
}
