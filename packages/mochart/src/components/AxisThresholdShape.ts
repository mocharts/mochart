import { Renderer, svgEl, textEl } from '../render';

import { translate, translateRotate } from '../utils/utils';
import { mochartCssClasses } from '../utils/ChartDom';
import { styleToAttributes } from '../utils/style';
import { getCategoryValueKey } from '../data/CategoryValue';
import { ANCHOR_MIDDLE, ANCHOR_START, AUTO, NONE, SCALE_LINEAR, SCALE_ORDINAL, SIDE_START, TITLE_SIDE_INSIDE, TITLE_SIDE_LOW, TYPE_DATE } from '../config/core/constants';
import type { El, TextEl } from '../render';
import type { AxisConfigBase } from '../types/config';
import type { CategoryValue } from '../types/data';
import type { ResolvedThreshold } from '../config/defaults/axisConfig';
import type { DataType, Scale } from '../config/core/constants';
import type { AxisLayoutInfo, LayoutInfo } from '../types/layout';

type ThresholdTitleEl = El & { backgroundHandle: El; textHandle: El; valueHandle: TextEl };

export type ThresholdAxisConfig = AxisConfigBase & {
  scale: Scale;
  type: DataType;
  useSeriesFocus?: boolean;
};

/** The ordinal category positions a category axis threshold is placed by; null on a value axis or a linear category axis. */
export interface ThresholdCategoryPositions {
  values: readonly CategoryValue[];
  /** Pixel offsets along the axis from the plot origin, one per category. */
  positions: number[];
  /** The full slot each category owns along the axis, edge to edge. */
  slotExtent: number;
}

export interface AxisThresholdShapeProps {
  axisConfig: ThresholdAxisConfig;
  threshold: ResolvedThreshold;
  thresholdIndex: number;
  axisDomain: [number | Date | null, number | Date | null];
  categoryPositions: ThresholdCategoryPositions | null;
  seriesLayoutInfo: LayoutInfo;
  axisLayoutInfo: AxisLayoutInfo;
  axisThresholdShapeClass: string;
  stroke: string | null;
  strokeOpacity: number | null;
  strokeWidth: number | null;
  strokeDashArray: string | null;
  fill: string | null;
  fillOpacity: number | null;
  /** The pattern or gradient url a range is filled with instead of the fill colour. */
  fillReference: string | null;
  vertical: boolean;
  /** Whether the axis's pixel position grows with the value along its direction. */
  ascending: boolean;
  /** Where the domain's min and max sit along the plot, as fractions: a category axis insets its range by half a category slot. */
  positionRange: [number, number];
  titleStroke: string | null;
  titleStrokeOpacity: number | null;
  titleStrokeWidth: number | null;
  titleFill: string | null;
  titleFillOpacity: number | null;
}

/** A threshold value's pixel offset along the axis from the plot origin, or null when it has no place on the axis. */
function getThresholdOffset(props: AxisThresholdShapeProps, rawValue: number | string): number | null {
  const { axisConfig, axisDomain, categoryPositions, seriesLayoutInfo, vertical, ascending, positionRange } = props;
  const { scale, type } = axisConfig;
  const axisExtent = vertical ? seriesLayoutInfo.height : seriesLayoutInfo.width;
  if (scale === SCALE_ORDINAL) {
    if (categoryPositions === null) {
      return null;
    }
    // by value, not by keyProperty: a threshold names a category value, like an explicit tick does
    const keyAxisConfig = { type, keyProperty: NONE };
    const key = getCategoryValueKey(keyAxisConfig, rawValue);
    const index = categoryPositions.values.findIndex(categoryValue => getCategoryValueKey(keyAxisConfig, categoryValue) === key);
    return index === -1 ? null : categoryPositions.positions[index]!;
  }
  const thresholdValue = type === TYPE_DATE ? new Date(rawValue) : (typeof rawValue === 'number' ? rawValue : Number(rawValue));
  const domainMin = axisDomain[0]?.valueOf();
  const domainMax = axisDomain[1]?.valueOf();
  const numericThreshold = thresholdValue?.valueOf();
  if (scale !== SCALE_LINEAR || typeof numericThreshold !== 'number' || Number.isNaN(numericThreshold) || domainMin === undefined || domainMax === undefined || domainMin === domainMax) {
    return null;
  }
  const domainFraction = (numericThreshold - domainMin) / (domainMax - domainMin);
  const thresholdPercentage = positionRange[0] + (positionRange[1] - positionRange[0]) * domainFraction;
  return (ascending ? thresholdPercentage : 1 - thresholdPercentage) * axisExtent;
}

export default class AxisThresholdShape extends Renderer<AxisThresholdShapeProps> {
  root = svgEl('g');
  // document order is paint order: a range's fill rect goes in front of the line group, so it paints behind the edge lines
  rangeRect: El | null = null;
  lineGroup = svgEl('g');
  line = this.elSlot(this.lineGroup);
  rangeLineGroup = svgEl('g');
  rangeLine = this.elSlot(this.rangeLineGroup);
  title = this.elSlot(this.root);

  create() {
    this.root.node.insertBefore(this.lineGroup.node, this.root.node.firstChild);
    return this.root.node;
  }

  sync() {
    const { axisConfig, threshold, seriesLayoutInfo, vertical } = this.props;
    const axisExtent = vertical ? seriesLayoutInfo.height : seriesLayoutInfo.width;
    const isRange = threshold.rangeValue !== NONE;
    const valueOffset = getThresholdOffset(this.props, threshold.value);
    const rangeOffset = isRange ? getThresholdOffset(this.props, threshold.rangeValue!) : null;
    const inPlot = (offset: number | null): offset is number => offset !== null && offset >= 0 && offset <= axisExtent;

    let present: boolean;
    // the pixel span the range fills, clipped to the plot; an ordinal range covers whole category slots
    let rangeStart = 0;
    let rangeEnd = 0;
    if (isRange) {
      present = valueOffset !== null && rangeOffset !== null;
      if (present) {
        const halfSlot = axisConfig.scale === SCALE_ORDINAL ? this.props.categoryPositions!.slotExtent / 2 : 0;
        rangeStart = Math.max(0, Math.min(valueOffset!, rangeOffset!) - halfSlot);
        rangeEnd = Math.min(axisExtent, Math.max(valueOffset!, rangeOffset!) + halfSlot);
        present = rangeEnd > rangeStart;
      }
    }
    else {
      present = inPlot(valueOffset);
    }
    if (!present) {
      this.setPresent(false);
      return;
    }

    const { axisThresholdShapeClass, stroke, strokeOpacity, strokeWidth, strokeDashArray, fill, fillOpacity, fillReference } = this.props;
    this.setPresent(true);
    this.root.set({ className: axisThresholdShapeClass });

    const lineAttributes = { x1: 0, y1: 0, x2: vertical ? seriesLayoutInfo.width : 0, y2: vertical ? 0 : seriesLayoutInfo.height,
      stroke, strokeOpacity, strokeWidth, strokeDasharray: strokeDashArray };
    const lineTransform = (offset: number) => vertical ? translate(seriesLayoutInfo.x, seriesLayoutInfo.y + offset) : translate(seriesLayoutInfo.x + offset, seriesLayoutInfo.y);

    // the edge lines of a range are the value edges (slot edges on an ordinal axis), hidden individually outside the plot
    const minEdge = isRange ? (axisConfig.scale === SCALE_ORDINAL ? rangeStart : Math.min(valueOffset!, rangeOffset!)) : valueOffset!;
    const maxEdge = isRange ? (axisConfig.scale === SCALE_ORDINAL ? rangeEnd : Math.max(valueOffset!, rangeOffset!)) : null;
    // an edge outside the plot mounts no line, so a clipped range keeps only its visible edge
    const showMin = inPlot(minEdge);
    this.lineGroup.set({ className: isRange ? mochartCssClasses['axisThresholdMin'] : null, transform: lineTransform(showMin ? minEdge : 0) });
    if (showMin) {
      this.line.set('line', () => svgEl('line'))!.set(lineAttributes);
    }
    else {
      this.line.set(null);
    }
    // the max edge group only exists in the DOM while a range shows it, so a line threshold's markup is unchanged
    const showMax = maxEdge !== null && inPlot(maxEdge);
    if (showMax) {
      if (this.rangeLineGroup.node.parentNode === null) {
        this.root.node.insertBefore(this.rangeLineGroup.node, this.lineGroup.node.nextSibling);
      }
      this.rangeLineGroup.set({ className: mochartCssClasses['axisThresholdMax'], transform: lineTransform(maxEdge!) });
      this.rangeLine.set('line', () => svgEl('line'))!.set(lineAttributes);
    }
    else if (this.rangeLineGroup.node.parentNode !== null) {
      this.root.node.removeChild(this.rangeLineGroup.node);
    }

    if (isRange) {
      if (this.rangeRect === null) {
        this.rangeRect = svgEl('rect');
        this.root.node.insertBefore(this.rangeRect.node, this.lineGroup.node);
      }
      this.rangeRect.set({ className: mochartCssClasses['axisThresholdRange'],
        x: vertical ? seriesLayoutInfo.x : seriesLayoutInfo.x + rangeStart, y: vertical ? seriesLayoutInfo.y + rangeStart : seriesLayoutInfo.y,
        width: vertical ? seriesLayoutInfo.width : rangeEnd - rangeStart, height: vertical ? rangeEnd - rangeStart : seriesLayoutInfo.height,
        fill: fillReference ?? fill, fillOpacity: fillReference !== null ? null : fillOpacity, stroke: 'none' });
    }
    else if (this.rangeRect !== null) {
      this.root.node.removeChild(this.rangeRect.node);
      this.rangeRect = null;
    }

    if (threshold.title.text !== NONE) {
      // a range title sits at the edge on its value side, or centred inside the band
      const { ascending } = this.props;
      const titleInside = isRange && threshold.title.side === TITLE_SIDE_INSIDE;
      const titleLow = threshold.title.side === TITLE_SIDE_LOW;
      let anchorOffset = valueOffset!;
      if (isRange) {
        const lowEdge = ascending ? rangeStart : rangeEnd;
        const highEdge = ascending ? rangeEnd : rangeStart;
        anchorOffset = titleInside ? (rangeStart + rangeEnd) / 2 : (titleLow ? lowEdge : highEdge);
      }
      this.syncTitle(seriesLayoutInfo.x + (vertical ? 0 : anchorOffset), seriesLayoutInfo.y + (vertical ? anchorOffset : 0), titleInside);
    }
    else {
      this.title.set(null);
    }
  }

  private syncTitle(thresholdX: number, thresholdY: number, centred: boolean) {
    const { axisConfig, threshold, seriesLayoutInfo, vertical, ascending } = this.props;
    const start = axisConfig.side === SIDE_START;
    const titleLow = threshold.title.side === TITLE_SIDE_LOW;
    const { snapToValue: titleSnapToValue, align } = threshold.title;
    const { axisLayoutInfo, thresholdIndex, titleStroke, titleStrokeOpacity, titleStrokeWidth, titleFill, titleFillOpacity } = this.props;
    const thresholdTitleLayoutInfo = axisLayoutInfo.thresholdTitleLayoutInfos[thresholdIndex] ?? { x: 0, y: 0, width: 0, height: 0 };
    let titleX = thresholdX;
    let titleY = thresholdY;
    const paddingRelativeBounds = 'paddingRelativeBounds' in thresholdTitleLayoutInfo
      ? thresholdTitleLayoutInfo.paddingRelativeBounds
      : thresholdTitleLayoutInfo;
    const marginRelativeBounds = 'marginRelativeBounds' in thresholdTitleLayoutInfo
      ? thresholdTitleLayoutInfo.marginRelativeBounds
      : thresholdTitleLayoutInfo;
    let { width, height } = thresholdTitleLayoutInfo;
    let { x: paddingX, y: paddingY, height: paddingHeight } = paddingRelativeBounds;

    if (!vertical) {
      let temp;

      temp = width;
      width = height;
      height = temp;

      temp = paddingX;
      paddingX = paddingY;
      paddingY = temp;
    }

    // titleSide names the value side; ascending says which pixel direction the values grow in
    const below = ascending ? !titleLow : titleLow;
    const left = ascending ? titleLow : !titleLow;
    // align places the title along the threshold: auto keeps it at the axis side
    const alongStart = align === AUTO ? start : align === ANCHOR_START;
    const alongMiddle = align === ANCHOR_MIDDLE;
    if (vertical) {
      paddingY += paddingHeight / 2.0;
      if (alongMiddle) {
        titleX += (seriesLayoutInfo.width - width) / 2;
      }
      else if (!alongStart) {
        // right
        titleX += seriesLayoutInfo.width - width;
      }
      if (centred) {
        titleY = Math.min(Math.max(thresholdY - height / 2, seriesLayoutInfo.y), seriesLayoutInfo.y + seriesLayoutInfo.height - height);
      }
      else if (below) {
        // below
        titleY = Math.min(thresholdY, seriesLayoutInfo.y + seriesLayoutInfo.height - height);
      }
      else {
        // above
        titleY = Math.max(thresholdY - height, seriesLayoutInfo.y);
      }
      if (titleSnapToValue && !centred) {
        if (below && titleY < thresholdY) {
          if (thresholdY - height >= seriesLayoutInfo.y) {
            titleY = thresholdY - height;
          }

        }
        else if (!below && titleY > (thresholdY - height)) {
          if (thresholdY + height <= seriesLayoutInfo.y + seriesLayoutInfo.height) {
            titleY = thresholdY;
          }

        }
      }
    }
    else {
      paddingX += paddingHeight / 2.0;
      if (alongMiddle) {
        titleY += (seriesLayoutInfo.height - height) / 2;
      }
      else if (!alongStart) {
        // above
        titleY += seriesLayoutInfo.height - height;
      }
      if (centred) {
        titleX = Math.min(Math.max(thresholdX - width / 2, seriesLayoutInfo.x), seriesLayoutInfo.x + seriesLayoutInfo.width - width);
      }
      else if (left) {
        // left
        titleX = Math.max(thresholdX - width, seriesLayoutInfo.x);
      }
      else {
        // right
        titleX = Math.min(thresholdX, seriesLayoutInfo.x + seriesLayoutInfo.width - width);
      }
      if (titleSnapToValue && !centred) {
        if (left && titleX > (thresholdX - width)) {
          if (thresholdX + width <= seriesLayoutInfo.x + seriesLayoutInfo.width) {
            titleX = thresholdX;
          }

        }
        else if (!left && titleX < thresholdX) {
          if (thresholdX - width >= seriesLayoutInfo.x) {
            titleX = thresholdX - width;
          }

        }
      }
    }
    const titleGroup = this.title.set('title', () => {
      const group = svgEl('g') as ThresholdTitleEl;
      const background = svgEl('rect');
      const text = svgEl('text');
      const value = textEl();
      text.append(value);
      group.append(background);
      group.append(text);
      group.backgroundHandle = background;
      group.textHandle = text;
      group.valueHandle = value;
      return group;
    }) as ThresholdTitleEl;
    titleGroup.set({ className: mochartCssClasses['axisThresholdTitle'] + thresholdIndex, transform: translate(titleX, titleY) });
    // a horizontal title is rotated 90°, so its background takes the swapped bounds like the text does
    titleGroup.backgroundHandle.set({ className: mochartCssClasses['axisThresholdTitleBackground'],
      x: vertical ? marginRelativeBounds.x : marginRelativeBounds.y, y: vertical ? marginRelativeBounds.y : marginRelativeBounds.x,
      width: vertical ? marginRelativeBounds.width : marginRelativeBounds.height, height: vertical ? marginRelativeBounds.height : marginRelativeBounds.width,
      ...styleToAttributes(threshold.title.backgroundStyle) });
    titleGroup.textHandle.set({ transform: translateRotate(paddingX, paddingY, vertical ? 0 : 90),
      fill: titleFill, fillOpacity: titleFillOpacity,
      stroke: titleStroke, strokeOpacity: titleStrokeOpacity, strokeWidth: titleStrokeWidth, dy: '0.35em' });
    titleGroup.valueHandle.set(threshold.title.text);
  }
}
