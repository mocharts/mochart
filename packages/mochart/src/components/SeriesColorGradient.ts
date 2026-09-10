import { Renderer, svgEl } from '../render';

import type { SeriesSwatchGradient } from '../utils/SeriesColors';

interface SeriesColorGradientProps {
  uniqueId: string;
  gradient: SeriesSwatchGradient;
}

interface Stop {
  offset: string;
  color: string;
}

// A ramp: 2 colors = one ramp; 4 colors = below ramp 0–50%, above ramp 50–100% with a hard break at the base.
function rampPercent(i: number, count: number): string {
  const offsets = count === 2 ? [0, 100] : [0, 50, 50, 100];
  return offsets[i] + '%';
}

// Stripes: every color gets a stop at each end of its band, so the bands meet with hard edges.
function stripeStops(colors: string[]): Stop[] {
  const stops: Stop[] = [];
  colors.forEach((color, i) => {
    stops.push({ offset: (100 * i / colors.length) + '%', color });
    stops.push({ offset: (100 * (i + 1) / colors.length) + '%', color });
  });
  return stops;
}

export default class SeriesColorGradient extends Renderer<SeriesColorGradientProps> {
  root = svgEl('linearGradient');
  stops = this.elList<Stop>(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { uniqueId, gradient } = this.props;
    const { colors, striped } = gradient;

    // a ramp runs bottom to top like a value axis; stripes run left to right like categories
    this.root.set(striped
      ? { id: uniqueId, x1: '0', x2: '1', y1: '0', y2: '0' }
      : { id: uniqueId, x1: '0', x2: '0', y1: '1', y2: '0' });
    const stops = striped
      ? stripeStops(colors)
      : colors.map((color, i) => ({ offset: rampPercent(i, colors.length), color }));
    this.stops.sync(stops, {
      key: (_stop, i) => i,
      create: () => ({ root: svgEl('stop') }),
      update: (handle, stop) => {
        handle.root.set({ offset: stop.offset, stopColor: stop.color, stopOpacity: 1 });
      }
    });
  }
}
