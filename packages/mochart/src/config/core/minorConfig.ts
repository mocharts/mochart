import { MAJOR } from './constants';
import type { Major } from './constants';
import type {
  AxisGridLineConfig, AxisTickLabelConfig, AxisTickMarkConfig, CategoryAxisTickLabelConfig, FontConfig, Style, StyleStates,
  StrokeStyleStates, TickLabelTruncationConfig
} from '../../types/config';

/** The minor tick labels' settings in the shape of the non-minor ones, every "major" replaced by the non-minor value. */
export interface MinorTickLabel {
  visible: boolean;
  front: boolean;
  anchor: AxisTickLabelConfig['anchor'];
  backgroundStyle: Style;
  size: AxisTickLabelConfig['size'];
  marginInner: number;
  marginOuter: number;
  paddingInner: number;
  paddingOuter: number;
  format: AxisTickLabelConfig['format'];
  prefix: string | null;
  suffix: string | null;
  rotation: number;
  textStyle: StyleStates;
  font: FontConfig;
  /** Only a category axis has one. */
  truncation?: TickLabelTruncationConfig;
}

export interface MinorTickMark {
  visible: boolean;
  front: boolean;
  size: number;
  marginInner: number;
  style: StrokeStyleStates;
}

export interface MinorGridLine {
  visible: boolean;
  front: boolean;
  style: StrokeStyleStates;
}

function major<T>(value: T | Major, majorValue: T): T {
  return value === MAJOR ? majorValue : value as T;
}

// member-wise: a "major" member takes the matching non-minor member as written, so a copied "same" still resolves against the minor normal state
function majorMembers<T extends object>(value: object, majorValue: T): T {
  const resolved: Record<string, unknown> = { ...(majorValue as Record<string, unknown>) };
  for (const [member, memberValue] of Object.entries(value)) {
    resolved[member] = memberValue === MAJOR ? (majorValue as Record<string, unknown>)[member] : memberValue;
  }
  return resolved as T;
}

function majorStates<T extends { normal: object; focused: object; defocused: object }>(value: { normal: object; focused: object; defocused: object }, majorValue: T): T {
  return {
    normal: majorMembers(value.normal, majorValue.normal),
    focused: majorMembers(value.focused, majorValue.focused),
    defocused: majorMembers(value.defocused, majorValue.defocused)
  } as T;
}

// config objects are stable per enhanced config, so the resolved settings are too; a stable identity lets renderer skips hold
const minorTickLabels = new WeakMap<AxisTickLabelConfig, MinorTickLabel>();
const minorTickMarks = new WeakMap<AxisTickMarkConfig, MinorTickMark>();
const minorGridLines = new WeakMap<AxisGridLineConfig, MinorGridLine>();

export function getMinorTickLabel(tickLabel: AxisTickLabelConfig & Partial<Pick<CategoryAxisTickLabelConfig, 'truncation' | 'minorTruncation'>>): MinorTickLabel {
  let minor = minorTickLabels.get(tickLabel);
  if (minor === undefined) {
    minor = {
      visible: tickLabel.visible && major(tickLabel.minorVisible, tickLabel.visible),
      front: major(tickLabel.minorFront, tickLabel.front),
      anchor: major(tickLabel.minorAnchor, tickLabel.anchor),
      backgroundStyle: majorMembers(tickLabel.minorBackgroundStyle, tickLabel.backgroundStyle),
      size: major(tickLabel.minorSize, tickLabel.size),
      marginInner: major(tickLabel.minorMarginInner, tickLabel.marginInner),
      marginOuter: major(tickLabel.minorMarginOuter, tickLabel.marginOuter),
      paddingInner: major(tickLabel.minorPaddingInner, tickLabel.paddingInner),
      paddingOuter: major(tickLabel.minorPaddingOuter, tickLabel.paddingOuter),
      format: major(tickLabel.minorFormat, tickLabel.format),
      prefix: tickLabel.minorPrefix,
      suffix: tickLabel.minorSuffix,
      rotation: major(tickLabel.minorRotation, tickLabel.rotation),
      textStyle: majorStates(tickLabel.minorTextStyle, tickLabel.textStyle),
      font: majorMembers(tickLabel.minorFont, tickLabel.font)
    };
    if (tickLabel.truncation !== undefined && tickLabel.minorTruncation !== undefined) {
      minor.truncation = majorMembers(tickLabel.minorTruncation, tickLabel.truncation);
    }
    minorTickLabels.set(tickLabel, minor);
  }
  return minor;
}

export function getMinorTickMark(tickMark: AxisTickMarkConfig): MinorTickMark {
  let minor = minorTickMarks.get(tickMark);
  if (minor === undefined) {
    minor = {
      visible: major(tickMark.minorVisible, tickMark.visible),
      front: major(tickMark.minorFront, tickMark.front),
      size: major(tickMark.minorSize, tickMark.size),
      marginInner: major(tickMark.minorMarginInner, tickMark.marginInner),
      style: majorStates(tickMark.minorStyle, tickMark.style)
    };
    minorTickMarks.set(tickMark, minor);
  }
  return minor;
}

export function getMinorGridLine(gridLine: AxisGridLineConfig): MinorGridLine {
  let minor = minorGridLines.get(gridLine);
  if (minor === undefined) {
    minor = {
      visible: major(gridLine.minorVisible, gridLine.visible),
      front: major(gridLine.minorFront, gridLine.front),
      style: majorStates(gridLine.minorStyle, gridLine.style)
    };
    minorGridLines.set(gridLine, minor);
  }
  return minor;
}
