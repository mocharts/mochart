import { AUTO, NONE, ELLIPSIS, COLOR_CURRENT, STYLE_SAME, SIDE_START, TITLE_SIDE_HIGH } from '../core/constants';
import { deepMerge } from '../core/deepMerge';
import type { StrokeStyleStates, Style, StyleStates, ThresholdConfig } from '../../types/config';
import type { MarginPadding } from '../../types/geometry';
import type { ThresholdTitleSide } from '../core/constants';

export default function getDefaults() {
  return {
    axisLine: {
      visible: true,
      front: false,
      marginInner: 0,
      style: {
        normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.65, strokeWidth: 1, strokeDashArray: NONE },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 0.65, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.325, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME }
      }
    },

    backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
    backgroundFront: false,

    side: SIDE_START,

    reversed: false,

    collapsed: false,

    focusRange: {
      visible: true,
      front: false,
      applyToTitle: false,
      // 0.2 / 0.12 matches the old '#000033' / '#aaccff' wash on a light page and stays legible on a dark one.
      style: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.2, strokeWidth: 1, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: 0.12 }
    },

    focusTickMark: {
      visible: false,
      front: false,
      size: 9,
      marginInner: 3,
      style: { strokeColor: COLOR_CURRENT, strokeOpacity: 1, strokeWidth: 3, strokeDashArray: NONE }
    },

    gridLine: {
      visible: false,
      front: false,
      // currentColor at 0.13 approximates the old '#e5e5e5' grid on a light page and still reads as a grid line on a dark one.
      style: {
        normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.13, strokeWidth: 1, strokeDashArray: '5, 5' },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 0.17, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.09, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME }
      }
    },

    marginInner: 0,
    marginOuter: 1,

    max: AUTO,
    maxOffset: 0,

    maxTickCount: 10,

    min: AUTO,
    minOffset: 0,

    minTickSpacing: 12,
    minTickInterval: 0,

    paddingInner: 0,
    paddingOuter: 1,

    softMin: NONE,
    softMax: NONE,

    thresholds: [],

    tickCount: AUTO,

    tickLabel: {
      front: false,
      anchor: AUTO,
      backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
      size: AUTO,
      marginInner: 2,
      marginOuter: 1,
      paddingInner: 5,
      paddingOuter: 5,
      format: AUTO,
      prefix: NONE,
      suffix: NONE,
      rotation: 0,
      textStyle: {
        normal: { strokeColor: 'none', strokeOpacity: 1, strokeWidth: 0, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: 1 },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 0, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.5, strokeWidth: 0, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 0.5 }
      }
    },

    tickMark: {
      visible: true,
      front: false,
      size: 3,
      marginInner: 0,
      style: {
        normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.65, strokeWidth: 1, strokeDashArray: NONE },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 0.65, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.325, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME }
      }
    },

    title: {
      text: NONE,
      front: false,
      backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
      truncationEnabled: true,
      truncationText: ELLIPSIS,
      size: AUTO,
      marginInner: 2,
      marginOuter: 2,
      paddingInner: 3,
      paddingOuter: 3,
      textStyle: {
        normal: { strokeColor: 'none', strokeOpacity: 1, strokeWidth: 0, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: 1 },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: 0, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.5, strokeWidth: 0, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 0.5 }
      }
    },
    visible: true
  };
}

/** The defaults merged under each `thresholds` entry (the array itself replaces wholesale). */
export function getThresholdEntryDefaults() {
  return {
    front: true,
    style: {
      normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.65, strokeWidth: 1, strokeDashArray: NONE },
      focused: { strokeColor: STYLE_SAME, strokeOpacity: 0.65, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME },
      defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.325, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME }
    },
    title: {
      text: NONE,
      side: TITLE_SIDE_HIGH,
      snapToValue: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      // 'none' rather than null: stroke="none" firewalls a host-css stroke inheriting onto the text.
      textStyle: {
        normal: { strokeColor: 'none', strokeOpacity: 1, strokeWidth: NONE, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: 1 },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: NONE, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 1, strokeWidth: NONE, strokeDashArray: STYLE_SAME, fillColor: STYLE_SAME, fillOpacity: 1 }
      },
      backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 }
    }
  };
}

/** A threshold title with every member filled from the entry defaults. */
export interface ResolvedThresholdTitle {
  text: string | null;
  side: ThresholdTitleSide;
  snapToValue: boolean;
  margin: MarginPadding;
  padding: MarginPadding;
  textStyle: StyleStates;
  backgroundStyle: Style;
}

/** A `thresholds` entry with every member filled from the entry defaults. */
export interface ResolvedThreshold {
  /** A number, or an ISO date string on date axes (validated by datePrimitive); other strings never validate or render. */
  value: number | string;
  front: boolean;
  style: StrokeStyleStates;
  title: ResolvedThresholdTitle;
}

const noThresholds: ResolvedThreshold[] = [];
// keyed by the config's thresholds array, which the clone contract keeps stable per enhanced config;
// stable resolved identities let the threshold renderers' shallow-equal skips hold between frames
const resolvedThresholdsCache = new WeakMap<readonly ThresholdConfig[], ResolvedThreshold[]>();

export function resolveThresholds(thresholds: readonly ThresholdConfig[] | undefined): ResolvedThreshold[] {
  if (!Array.isArray(thresholds)) {
    return noThresholds;
  }
  let resolved = resolvedThresholdsCache.get(thresholds);
  if (resolved === undefined) {
    resolved = thresholds
      .filter(entry => entry !== null && typeof entry === 'object' && (typeof entry.value === 'number' || typeof entry.value === 'string'))
      .map(entry => deepMerge(getThresholdEntryDefaults(), entry as Record<string, unknown>) as unknown as ResolvedThreshold);
    resolvedThresholdsCache.set(thresholds, resolved);
  }
  return resolved;
}
