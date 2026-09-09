import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import type { LayoutInfo } from '../types/layout';

type ShapeRef = (element: Element | null) => void;

/** attributes that make the series-area rect the chart's keyboard tab stop */
export interface SeriesShapeA11yProps {
  ariaLabel: string;
  ariaExpanded: string;
  onKeyDown: (event: Event) => void;
}

interface SeriesBackgroundProps {
  seriesLayoutInfo: LayoutInfo;
  shapeRef?: ShapeRef | null;
  a11yProps?: SeriesShapeA11yProps | null;
}

export default class SeriesBackground extends Renderer<SeriesBackgroundProps> {
  root = svgEl('g');
  rect = svgEl('rect');
  lastShapeRef: ShapeRef | null = null;

  create() {
    this.root.append(this.rect);
    return this.root.node;
  }

  sync() {
    const { seriesLayoutInfo, shapeRef = null, a11yProps = null } = this.props;
    this.root.set({ className: mochartCssClasses['seriesBackground'] });
    this.rect.set({ x: seriesLayoutInfo.x, y: seriesLayoutInfo.y, width: seriesLayoutInfo.width, height: seriesLayoutInfo.height,
      fillOpacity: '0', stroke: 'none',
      tabindex: a11yProps ? '0' : null,
      role: a11yProps ? 'button' : null,
      ariaLabel: a11yProps ? a11yProps.ariaLabel : null,
      ariaExpanded: a11yProps ? a11yProps.ariaExpanded : null,
      onKeyDown: a11yProps ? a11yProps.onKeyDown : null });
    if (shapeRef !== this.lastShapeRef) {
      if (this.lastShapeRef) {
        this.lastShapeRef(null);
      }
      if (shapeRef) {
        shapeRef(this.rect.node);
      }
      this.lastShapeRef = shapeRef;
    }
  }

  dispose() {
    if (this.lastShapeRef) {
      this.lastShapeRef(null);
      this.lastShapeRef = null;
    }
  }
}
