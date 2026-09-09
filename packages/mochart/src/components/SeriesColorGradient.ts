import { Renderer, svgEl } from '../render';

import { getSeriesGradientColors } from '../utils/SeriesColors';
import type { EnhancedSeriesConfig } from '../types/enhanced';

interface SeriesColorGradientProps {
  uniqueId: string;
  seriesConfig: EnhancedSeriesConfig;
}

// 2 colors = one ramp; 4 colors = below ramp 0–50%, above ramp 50–100% with a hard break at the base.
function toPercent(i: number, count: number): string {
  const offsets = count === 2 ? [0, 100] : [0, 50, 50, 100];
  return offsets[i] + '%';
}

export default class SeriesColorGradient extends Renderer<SeriesColorGradientProps> {
  root = svgEl('linearGradient');
  stops = this.elList<string>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { uniqueId, seriesConfig } = this.props;

    const colors = getSeriesGradientColors(seriesConfig);

    if (colors) {
      this.setPresent(true);
      this.root.set({ id: uniqueId, x1: '0', x2: '0', y1: '1', y2: '0' });
      this.stops.sync(colors, {
        key: (_color, i) => i,
        create: () => ({ root: svgEl('stop') }),
        update: (handle, color, i) => {
          handle.root.set({ offset: toPercent(i, colors.length), stopColor: color, stopOpacity: 1 });
        }
      });
    }
    else {
      this.setPresent(false);
    }
  }
}
