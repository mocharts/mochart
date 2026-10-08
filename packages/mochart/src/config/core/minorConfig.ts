import { MAJOR } from './constants.js';
import type { Major } from './constants.js';
import type {
  AxisGridLineConfig, AxisMinorGridLineConfig, AxisMinorTickLabelConfig, AxisMinorTickMarkConfig, AxisTickLabelConfig, AxisTickMarkConfig,
  CategoryAxisMinorTickLabelConfig, CategoryAxisTickLabelConfig, FontConfig, Style, StyleStates, StrokeStyleStates, TickLabelTruncationConfig
} from '../../types/config.js';

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

/** The axis config members the minor tick labels resolve from; only a category axis has the truncations. */
export interface MinorTickLabelSource {
  tickLabel: AxisTickLabelConfig & Partial<Pick<CategoryAxisTickLabelConfig, 'truncation'>>;
  minorTickLabel: AxisMinorTickLabelConfig & Partial<Pick<CategoryAxisMinorTickLabelConfig, 'truncation'>>;
}

// config objects are stable per enhanced config, so the resolved settings are too; a stable identity lets renderer skips hold
const minorTickLabels = new WeakMap<object, { major: object; resolved: MinorTickLabel }>();
const minorTickMarks = new WeakMap<object, { major: object; resolved: MinorTickMark }>();
const minorGridLines = new WeakMap<object, { major: object; resolved: MinorGridLine }>();

// keyed by the minor config object, recomputed when it is paired with a different major one
function cached<T>(cache: WeakMap<object, { major: object; resolved: T }>, minor: object, major: object, resolve: () => T): T {
  const entry = cache.get(minor);
  if (entry !== undefined && entry.major === major) {
    return entry.resolved;
  }
  const resolved = resolve();
  cache.set(minor, { major, resolved });
  return resolved;
}

export function getMinorTickLabel({ tickLabel, minorTickLabel }: MinorTickLabelSource): MinorTickLabel {
  return cached(minorTickLabels, minorTickLabel, tickLabel, () => {
    const minor: MinorTickLabel = {
      // tickLabel.visible false hides the minor labels too, whatever minorTickLabel.visible says
      visible: tickLabel.visible && major(minorTickLabel.visible, tickLabel.visible),
      front: major(minorTickLabel.front, tickLabel.front),
      anchor: major(minorTickLabel.anchor, tickLabel.anchor),
      backgroundStyle: majorMembers(minorTickLabel.backgroundStyle, tickLabel.backgroundStyle),
      size: major(minorTickLabel.size, tickLabel.size),
      marginInner: major(minorTickLabel.marginInner, tickLabel.marginInner),
      marginOuter: major(minorTickLabel.marginOuter, tickLabel.marginOuter),
      paddingInner: major(minorTickLabel.paddingInner, tickLabel.paddingInner),
      paddingOuter: major(minorTickLabel.paddingOuter, tickLabel.paddingOuter),
      format: major(minorTickLabel.format, tickLabel.format),
      prefix: minorTickLabel.prefix,
      suffix: minorTickLabel.suffix,
      rotation: major(minorTickLabel.rotation, tickLabel.rotation),
      textStyle: majorStates(minorTickLabel.textStyle, tickLabel.textStyle),
      font: majorMembers(minorTickLabel.font, tickLabel.font)
    };
    if (tickLabel.truncation !== undefined && minorTickLabel.truncation !== undefined) {
      minor.truncation = majorMembers(minorTickLabel.truncation, tickLabel.truncation);
    }
    return minor;
  });
}

export function getMinorTickMark({ tickMark, minorTickMark }: { tickMark: AxisTickMarkConfig; minorTickMark: AxisMinorTickMarkConfig }): MinorTickMark {
  return cached(minorTickMarks, minorTickMark, tickMark, () => ({
    visible: tickMark.visible && major(minorTickMark.visible, tickMark.visible),
    front: major(minorTickMark.front, tickMark.front),
    size: major(minorTickMark.size, tickMark.size),
    marginInner: major(minorTickMark.marginInner, tickMark.marginInner),
    style: majorStates(minorTickMark.style, tickMark.style)
  }));
}

export function getMinorGridLine({ gridLine, minorGridLine }: { gridLine: AxisGridLineConfig; minorGridLine: AxisMinorGridLineConfig }): MinorGridLine {
  return cached(minorGridLines, minorGridLine, gridLine, () => ({
    visible: gridLine.visible && major(minorGridLine.visible, gridLine.visible),
    front: major(minorGridLine.front, gridLine.front),
    style: majorStates(minorGridLine.style, gridLine.style)
  }));
}
