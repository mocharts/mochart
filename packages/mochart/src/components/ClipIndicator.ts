import { path } from 'd3-path';

import { Renderer, svgEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { styleToAttributes } from '../utils/style';
import { getSvgWidthAndHeight } from '../utils/TextMeasurement';
import { AUTO, NONE } from '../config/core/constants';
import type { El, TextEl } from '../render';
import type { ClippedEdges } from '../types/data';
import type { Bounds, Size } from '../types/geometry';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { LayoutInfo } from '../types/layout';

interface ClipIndicatorProps {
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  clippedEdges: ClippedEdges;
  clipIndicatorPatternUniqueId: string;
}

/** Null until the label has been rendered once and measured. */
interface ClipIndicatorState { textBounds: Size | null; fontSize: number | null }

const edgeKeys = ['top', 'right', 'bottom', 'left'] as const;
type EdgeKey = typeof edgeKeys[number];

interface Band { group: El; shape: El; text: El; textValue: TextEl }

/** Used for an automatic size on the first frame, before the label can be measured. */
const defaultFontSize = 12;
/** More or less centers text vertically (same value the axis title uses). */
const textDY = '0.35em';

/** Marks the plot edges that have data hidden behind them: one mitred band per clipped edge, overlaying the plot rather than reserving layout space. */
export default class ClipIndicator extends Renderer<ClipIndicatorProps, ClipIndicatorState> {
  root = svgEl('g');
  title = svgEl('title');
  titleValue = textEl();
  pattern = svgEl('pattern');
  patternLine = svgEl('line');
  bands: Partial<Record<EdgeKey, Band>> = {};

  constructor() {
    super();
    this.state = { textBounds: null, fontSize: null };
  }

  create() {
    this.title.append(this.titleValue);
    this.pattern.append(this.patternLine);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, seriesLayoutInfo, clippedEdges, clipIndicatorPatternUniqueId } = this.props;
    const { clipIndicator: clipIndicatorConfig } = mochartConfig;

    if (!clipIndicatorConfig.visible || !edgeKeys.some(edge => clippedEdges[edge])) {
      this.setPresent(false);
      return;
    }

    const depths = getBandDepths(seriesLayoutInfo, clippedEdges, this.getSize());
    const labelBounds = edgeKeys.map(edge => getLabelBounds(seriesLayoutInfo, depths, edge));
    // no band has room (a size larger than the plot): show nothing rather than an empty group
    if (!labelBounds.some((bounds, index) => clippedEdges[edgeKeys[index]] && bounds.width > 0 && bounds.height > 0)) {
      this.setPresent(false);
      return;
    }

    this.setPresent(true);
    this.root.set({ className: mochartCssClasses['clipIndicator'] });

    // The library's only <title>: one string serves as both the accessible name and the hidden
    // label's fallback text — aria-label would win for AT and let the two drift apart.
    const label = clipIndicatorConfig.label;
    if (label !== NONE) {
      this.root.append(this.title);
      this.titleValue.set(label);
    }
    else {
      this.title.node.remove();
    }

    const { fill, fillOpacity, ...strokeAttributes } = styleToAttributes(clipIndicatorConfig.style);
    const bandFill = this.syncPattern(clipIndicatorPatternUniqueId, fill);

    edgeKeys.forEach((edge, index) => {
      const band = this.getBand(edge);
      const bounds = labelBounds[index];
      if (depths[edge] <= 0) {
        band.group.node.remove();
        return;
      }
      this.root.append(band.group);
      band.group.set({ className: mochartCssClasses['clipIndicatorBand'] + edge });
      band.shape.set({ d: getBandPath(seriesLayoutInfo, depths, edge), ...strokeAttributes,
        fill: bandFill, fillOpacity });
      this.syncLabel(band, edge, bounds, label);
    });
  }

  /** The band's fill: a diagonal hatch drawn from the style's fill colour; degenerate hatches collapse to the flat fill they would draw anyway. */
  private syncPattern(patternUniqueId: string, fill: string | null | undefined): string | null | undefined {
    const hatch = this.props.mochartConfig.clipIndicator.hatch;
    if (hatch === NONE || hatch.spacing <= 0 || hatch.lineWidth >= hatch.spacing) {
      this.pattern.node.remove();
      return fill;
    }
    if (hatch.lineWidth <= 0) {
      this.pattern.node.remove();
      return NONE;
    }
    this.root.append(this.pattern);
    this.pattern.set({ id: patternUniqueId, width: hatch.spacing, height: hatch.spacing,
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    // centered in the tile: a line along x=0 loses its negative half to the tile clip
    this.patternLine.set({ x1: hatch.spacing / 2, y1: 0, x2: hatch.spacing / 2, y2: hatch.spacing,
      stroke: fill ?? null, strokeWidth: hatch.lineWidth });
    return 'url(#' + patternUniqueId + ')';
  }

  private syncLabel(band: Band, edge: EdgeKey, bounds: Bounds, label: string | null): void {
    if (label === NONE) {
      band.text.node.remove();
      return;
    }
    band.group.append(band.text);
    const vertical = edge === 'left' || edge === 'right';
    // matches the axis title on the same side: start side reads downward, end side upward
    const angle = vertical ? (edge === 'left' ? 90 : 270) : 0;
    const transform = 'translate(' + Math.floor(bounds.x + bounds.width / 2) + ',' + Math.floor(bounds.y + bounds.height / 2) + ')'
      + (angle === 0 ? '' : ' rotate(' + angle + ')');
    // hidden rather than removed when it does not fit, so it stays measurable and the band depth
    // does not shrink out from under it
    const available = vertical ? bounds.height : bounds.width;
    const fits = available > 0 && (this.state.textBounds === null || this.state.textBounds.width <= available);
    band.textValue.set(label);
    // the label is not a hit target: the pointer falls through to the band behind it, which still
    // triggers the <title>, and the text never shows an I-beam or takes a selection
    band.text.set({ transform, textAnchor: 'middle', dy: textDY, pointerEvents: 'none',
      visibility: fits ? null : 'hidden', ...styleToAttributes(this.props.mochartConfig.clipIndicator.textStyle) });
  }

  private getBand(edge: EdgeKey): Band {
    let band = this.bands[edge];
    if (band === undefined) {
      const group = svgEl('g');
      const shape = svgEl('path');
      const text = svgEl('text');
      const textValue = textEl();
      text.append(textValue);
      group.append(shape);
      band = this.bands[edge] = { group, shape, text, textValue };
    }
    return band;
  }

  /** Post-commit: measure the label's bounding box (as the titles do), stored only when it changes so a stable label settles after one extra pass. */
  measure(): void {
    if (!this.present) {
      return;
    }
    const textNode = Object.values(this.bands).find(band => band.text.node.isConnected)?.text.node;
    const textBounds = textNode ? getSvgWidthAndHeight(textNode as SVGGraphicsElement) : null;
    if (textBounds !== null && (this.state.textBounds === null
      || textBounds.width !== this.state.textBounds.width || textBounds.height !== this.state.textBounds.height)) {
      this.setState({ textBounds });
      return;
    }
    // no label to measure: fall back to the computed font size, which is all an empty band needs
    if (textBounds === null && typeof getComputedStyle === 'function') {
      const fontSize = parseFloat(getComputedStyle(this.root.node as Element).fontSize);
      if (isFinite(fontSize) && fontSize > 0 && fontSize !== this.state.fontSize) {
        this.setState({ fontSize });
      }
    }
  }

  /** The band's depth: an explicit size, or the measured label height plus padding on both sides. */
  getSize(): number {
    const { size, labelPadding, label } = this.props.mochartConfig.clipIndicator;
    if (size !== AUTO) {
      return size;
    }
    const measured = label !== NONE && this.state.textBounds !== null
      ? this.state.textBounds.height
      : this.state.fontSize ?? defaultFontSize;
    return measured + labelPadding * 2;
  }
}

interface BandDepths { top: number; right: number; bottom: number; left: number }

/** 0 for an edge that is not clipped; opposing pairs share the extent so they can never overlap. */
function getBandDepths(seriesLayoutInfo: LayoutInfo, clippedEdges: ClippedEdges, size: number): BandDepths {
  const verticalShare = clippedEdges.top && clippedEdges.bottom ? seriesLayoutInfo.height / 2 : seriesLayoutInfo.height;
  const horizontalShare = clippedEdges.left && clippedEdges.right ? seriesLayoutInfo.width / 2 : seriesLayoutInfo.width;
  return {
    top: clippedEdges.top ? Math.min(size, verticalShare) : 0,
    bottom: clippedEdges.bottom ? Math.min(size, verticalShare) : 0,
    left: clippedEdges.left ? Math.min(size, horizontalShare) : 0,
    right: clippedEdges.right ? Math.min(size, horizontalShare) : 0
  };
}

/** The band as a mitred quadrilateral: each end angles inward where the neighbouring edge is also clipped, so adjacent bands tile the frame exactly. */
function getBandPath(seriesLayoutInfo: LayoutInfo, depths: BandDepths, edge: EdgeKey): string {
  const { x, y, width, height } = seriesLayoutInfo;
  const right = x + width;
  const bottom = y + height;
  const innerTop = y + depths.top;
  const innerBottom = bottom - depths.bottom;
  const innerLeft = x + depths.left;
  const innerRight = right - depths.right;
  const corners: [number, number][] =
    edge === 'top' ? [[x, y], [right, y], [innerRight, innerTop], [innerLeft, innerTop]]
      : edge === 'bottom' ? [[innerLeft, innerBottom], [innerRight, innerBottom], [right, bottom], [x, bottom]]
        : edge === 'left' ? [[x, y], [innerLeft, innerTop], [innerLeft, innerBottom], [x, bottom]]
          : [[innerRight, innerTop], [right, y], [right, bottom], [innerRight, innerBottom]];
  const pathGenerator = path();
  pathGenerator.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < corners.length; i++) {
    pathGenerator.lineTo(corners[i][0], corners[i][1]);
  }
  pathGenerator.closePath();
  return pathGenerator.toString();
}

/** The band's usable rectangle — the part clear of its neighbours, where the label is centred. */
function getLabelBounds(seriesLayoutInfo: LayoutInfo, depths: BandDepths, edge: EdgeKey): Bounds {
  const { x, y, width, height } = seriesLayoutInfo;
  const innerWidth = Math.max(0, width - depths.left - depths.right);
  const innerHeight = Math.max(0, height - depths.top - depths.bottom);
  switch (edge) {
    case 'top': return { x: x + depths.left, y, width: innerWidth, height: depths.top };
    case 'bottom': return { x: x + depths.left, y: y + height - depths.bottom, width: innerWidth, height: depths.bottom };
    case 'left': return { x, y: y + depths.top, width: depths.left, height: innerHeight };
    default: return { x: x + width - depths.right, y: y + depths.top, width: depths.right, height: innerHeight };
  }
}
