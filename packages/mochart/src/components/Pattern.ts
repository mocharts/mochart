import { Renderer, svgEl } from '../render';
import {
  COLOR_SERIES, PATTERN_TYPE_CROSSHATCH, PATTERN_TYPE_DOTS
} from '../config/core/constants';
import type { El } from '../render';
import type { PatternColor, PatternConfig } from '../types/config';

interface PatternProps {
  uniqueId: string;
  patternConfig: PatternConfig;
  seriesColor: string | null;
}

function resolveColor(color: PatternColor | null, seriesColor: string | null): string | null {
  return color === COLOR_SERIES ? seriesColor : color;
}

function setChildPresent(parent: El, child: El, present: boolean): void {
  if (present) {
    parent.append(child);
  }
  else {
    child.node.remove();
  }
}

/** A screen-space SVG fill pattern, instantiated once for each series that references it. */
export default class Pattern extends Renderer<PatternProps> {
  root = svgEl('pattern');
  background = svgEl('rect');
  marks = svgEl('g');
  line = svgEl('line');
  crossLine = svgEl('line');
  dot = svgEl('circle');

  create() {
    return this.root.node;
  }

  sync() {
    const { uniqueId, patternConfig, seriesColor } = this.props;
    const { type, spacing, foregroundOpacity, backgroundOpacity } = patternConfig;
    const foregroundColor = resolveColor(patternConfig.foregroundColor, seriesColor);
    const backgroundColor = resolveColor(patternConfig.backgroundColor, seriesColor);
    const linePattern = type !== PATTERN_TYPE_DOTS;

    this.root.set({
      id: uniqueId,
      width: spacing,
      height: spacing,
      patternUnits: 'userSpaceOnUse',
      patternTransform: linePattern ? 'rotate(' + patternConfig.rotation + ')' : null
    });

    setChildPresent(this.root, this.background, backgroundColor !== null);
    if (backgroundColor !== null) {
      this.background.set({ x: 0, y: 0, width: spacing, height: spacing,
        fill: backgroundColor, fillOpacity: backgroundOpacity });
    }

    this.root.append(this.marks);
    this.marks.set({ opacity: foregroundOpacity });
    setChildPresent(this.marks, this.dot, !linePattern);
    setChildPresent(this.marks, this.line, linePattern);
    setChildPresent(this.marks, this.crossLine, type === PATTERN_TYPE_CROSSHATCH);

    if (linePattern) {
      // centred in the tile like the dot: on the edge the tile clips half of the stroke's width
      const center = spacing / 2;
      this.line.set({ x1: center, y1: 0, x2: center, y2: spacing,
        stroke: foregroundColor, strokeWidth: patternConfig.lineWidth });
      if (type === PATTERN_TYPE_CROSSHATCH) {
        this.crossLine.set({ x1: 0, y1: center, x2: spacing, y2: center,
          stroke: foregroundColor, strokeWidth: patternConfig.lineWidth });
      }
    }
    else {
      this.dot.set({ cx: spacing / 2, cy: spacing / 2, r: patternConfig.radius,
        fill: foregroundColor });
    }
  }
}
