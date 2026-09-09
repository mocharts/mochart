import { STYLE_SAME } from '../config/core/constants';
import type { FocusData, FocusPercentage, FocusPercentageMap } from '../types/animation';
import type { Style, StrokeStyleStates, StyleStates } from '../types/config';
import type { EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced';

export function getFocusValue(focusPercentage: FocusPercentage, normalValue: number, focusedValue: number, defocusedValue: number): number {
  // piecewise linear interpolation through (-1, defocused), (0, normal), (1, focused) — exact for any value ordering
  if (focusPercentage === null || focusPercentage === 0) {
    return normalValue;
  }
  else if (focusPercentage < 0) {
    return normalValue + focusPercentage * (normalValue - defocusedValue);
  }
  else if (focusPercentage > 0) {
    return normalValue + focusPercentage * (focusedValue - normalValue);
  }
  return normalValue;
}

export function getCategoryFocusPercentage(categoryFocusPercentage: FocusPercentage, seriesFocusPercentage: FocusPercentage): FocusPercentage {
  return getCombinedFocusPercentage(categoryFocusPercentage, seriesFocusPercentage);
}

export function getCombinedFocusPercentage(percentageA: FocusPercentage, percentageB: FocusPercentage): FocusPercentage {
  if (percentageA === null && percentageB === null) {
    return null;
  }
  else if (percentageA === null || percentageA === 0) {
    return percentageB;
  }
  else if (percentageB === null || percentageB === 0) {
    return percentageA;
  }
  else if (percentageA < 0 && percentageB < 0) {
    return Math.min(percentageA, percentageB);
  }
  else if (percentageA > 0 && percentageB > 0) {
    return Math.max(percentageA, percentageB);
  }
  else {
    // opposite signs: bilinear blend — ±1 endpoints resolve positive like the Math.max this
    // replaced, but a focus tweening up under a steady defocus animates -1 → 1 without snapping
    return percentageA + percentageB - percentageA * percentageB;
  }
}

export function getAggregateSeriesFocusPercentage(seriesConfigs: EnhancedSeriesConfig[], seriesFocusPercentages: FocusPercentageMap): FocusPercentage {
  let maxPercentage: FocusPercentage = null;
  let seriesFocusPercentage: FocusPercentage;
  for (const seriesConfig of seriesConfigs) {
    seriesFocusPercentage = seriesFocusPercentages[seriesConfig.id];
    if (seriesFocusPercentage !== null) {
      if (maxPercentage === null || seriesFocusPercentage > maxPercentage) {
        maxPercentage = seriesFocusPercentage;
      }
    }
  }
  return maxPercentage;
}

export interface ValueAxisFocusContext {
  axisConfig: EnhancedValueAxisConfig;
  id: string;
  key: string;
  axisFocusPercentage: FocusPercentage;
  seriesFocusPercentage: FocusPercentage;
}

// per-value-axis focus inputs shared by the axis, grid, base line and threshold containers
export function getValueAxisFocusContexts(valueAxisConfigs: EnhancedValueAxisConfig[], focusData: FocusData): ValueAxisFocusContext[] {
  const { valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
  return valueAxisConfigs.map((axisConfig: EnhancedValueAxisConfig) => {
    const { id, seriesConfigs, useSeriesFocus } = axisConfig;
    return {
      axisConfig, id, key: 'value-axis-' + id,
      axisFocusPercentage: valueAxisFocusPercentages[id],
      seriesFocusPercentage: useSeriesFocus ? getAggregateSeriesFocusPercentage(seriesConfigs ?? [], seriesFocusPercentages) : null
    };
  });
}

export function getFocusedDefocused(focusPercentage: FocusPercentage): { focused: boolean; defocused: boolean } {
  return {
    focused: focusPercentage !== null && focusPercentage > 0,
    defocused: focusPercentage !== null && focusPercentage < 0
  };
}

/** `'same'` defers to whatever color the normal state uses. */
export function getSameColor(color: string, normalColor: string): string {
  return color === STYLE_SAME ? normalColor : color;
}

export function getFocusPercentageColor(focusPercentage: FocusPercentage, normalColor: string, focusedColor: string, defocusedColor: string): string {
  const { focused, defocused } = getFocusedDefocused(focusPercentage);
  if (focused) {
    return getSameColor(focusedColor, normalColor);
  }
  else if (defocused) {
    return getSameColor(defocusedColor, normalColor);
  }
  else {
    return normalColor;
  }
}

export function getAxisFocusColor(axisFocusPercentage: FocusPercentage | undefined, seriesFocusPercentage: FocusPercentage | undefined, useSeriesFocus: boolean, normalColor: string, focusedColor: string, defocusedColor: string): string {
  let color = normalColor;
  if (axisFocusPercentage !== undefined && seriesFocusPercentage !== undefined) {
    if (axisFocusPercentage !== null) {
      color = getFocusPercentageColor(axisFocusPercentage, normalColor, focusedColor, defocusedColor);
    }
    else if (useSeriesFocus ) {
      color = getFocusPercentageColor(seriesFocusPercentage, normalColor, focusedColor, defocusedColor);
    }
  }
  return color;
}

export function getAxisFocusOpacity(axisFocusPercentage: FocusPercentage | undefined, seriesFocusPercentage: FocusPercentage | undefined, useSeriesFocus: boolean, normalOpacity: number, focusedOpacity: number, defocusedOpacity: number): number {
  let opacity = normalOpacity;
  if (axisFocusPercentage !== undefined && seriesFocusPercentage !== undefined && !(axisFocusPercentage === null && seriesFocusPercentage === null)) {
    const percentage = useSeriesFocus ? getCombinedFocusPercentage(axisFocusPercentage, seriesFocusPercentage) : axisFocusPercentage;
    opacity = getFocusValue(percentage, normalOpacity, focusedOpacity, defocusedOpacity);
  }
  return opacity;
}

export interface AxisStyleStates {
  normal: Partial<Style>;
  focused: Partial<Style<string | 'same', 'same'>>;
  defocused: Partial<Style<string | 'same', 'same'>>;
}

const emptyStyle: Partial<Style> = {};

const styleColorMembers = new Set<string>(['strokeColor', 'fillColor']);

/** The state a focus percentage lands in when a member cannot interpolate (dash arrays, null widths). */
export function getFocusDiscreteValue<T>(focusPercentage: FocusPercentage, normalValue: T, focusedValue: T, defocusedValue: T): T {
  const { focused, defocused } = getFocusedDefocused(focusPercentage);
  return focused ? focusedValue : defocused ? defocusedValue : normalValue;
}

/** Resolve a per-state stroke width: 'same' or an absent member defers to normal; numbers interpolate, null stays unset. */
export function getFocusStrokeWidth(focusPercentage: FocusPercentage, normalValue: number | null | undefined, focusedValue: number | null | 'same' | undefined, defocusedValue: number | null | 'same' | undefined): number | null {
  const focused = focusedValue === undefined || focusedValue === STYLE_SAME ? normalValue : focusedValue;
  const defocused = defocusedValue === undefined || defocusedValue === STYLE_SAME ? normalValue : defocusedValue;
  if (typeof normalValue === 'number' && typeof focused === 'number' && typeof defocused === 'number') {
    return getFocusValue(focusPercentage, normalValue, focused, defocused);
  }
  return getFocusDiscreteValue(focusPercentage, normalValue, focused, defocused) ?? null;
}

/** Resolve a per-state dash array: 'same' or an absent member defers to normal, and states switch discretely. */
export function getFocusStrokeDashArray(focusPercentage: FocusPercentage, normalValue: string | null | undefined, focusedValue: string | null | 'same' | undefined, defocusedValue: string | null | 'same' | undefined): string | null {
  const focused = focusedValue === undefined || focusedValue === STYLE_SAME ? normalValue : focusedValue;
  const defocused = defocusedValue === undefined || defocusedValue === STYLE_SAME ? normalValue : defocusedValue;
  return getFocusDiscreteValue(focusPercentage, normalValue, focused, defocused) ?? null;
}

export interface FocusStrokeStyle {
  strokeWidth: number | null;
  strokeDashArray: string | null;
  strokeOpacity: number;
}

export interface FocusStyle extends FocusStrokeStyle {
  fillOpacity: number;
}

/** Resolve the geometry and opacity members of a stroke style at a focus percentage (colors resolve separately, per series). */
export function getFocusStrokeStyle<C>(focusPercentage: FocusPercentage, { normal, focused, defocused }: StrokeStyleStates<C>): FocusStrokeStyle {
  return {
    strokeWidth: getFocusStrokeWidth(focusPercentage, normal.strokeWidth, focused.strokeWidth, defocused.strokeWidth),
    strokeDashArray: getFocusStrokeDashArray(focusPercentage, normal.strokeDashArray, focused.strokeDashArray, defocused.strokeDashArray),
    strokeOpacity: getFocusValue(focusPercentage, normal.strokeOpacity, focused.strokeOpacity, defocused.strokeOpacity)
  };
}

/** Resolve the geometry and opacity members of a full style at a focus percentage (colors resolve separately, per series). */
export function getFocusStyle<C>(focusPercentage: FocusPercentage, styleStates: StyleStates<C>): FocusStyle {
  const { normal, focused, defocused } = styleStates;
  return {
    strokeWidth: getFocusStrokeWidth(focusPercentage, normal.strokeWidth, focused.strokeWidth, defocused.strokeWidth),
    strokeDashArray: getFocusStrokeDashArray(focusPercentage, normal.strokeDashArray, focused.strokeDashArray, defocused.strokeDashArray),
    strokeOpacity: getFocusValue(focusPercentage, normal.strokeOpacity, focused.strokeOpacity, defocused.strokeOpacity),
    fillOpacity: getFocusValue(focusPercentage, normal.fillOpacity, focused.fillOpacity, defocused.fillOpacity)
  };
}

/** Only members the normal state has are resolved, so anything it leaves out produces no attribute. */
export function getAxisFocusStyle(axisFocusPercentage: FocusPercentage | undefined, seriesFocusPercentage: FocusPercentage | undefined, useSeriesFocus: boolean, styleStates: AxisStyleStates): Partial<Style> {
  const normal = (styleStates.normal ?? emptyStyle) as Record<string, unknown>;
  const focused = (styleStates.focused ?? emptyStyle) as Record<string, unknown>;
  const defocused = (styleStates.defocused ?? emptyStyle) as Record<string, unknown>;
  const style: Record<string, unknown> = {};
  for (const member of Object.keys(normal)) {
    const normalValue = normal[member];
    // 'same' (like an absent member) defers to the normal state, for geometry members as well as colors
    const focusedValue = focused[member] === undefined || focused[member] === STYLE_SAME ? normalValue : focused[member];
    const defocusedValue = defocused[member] === undefined || defocused[member] === STYLE_SAME ? normalValue : defocused[member];
    if (styleColorMembers.has(member)) {
      style[member] = getAxisFocusColor(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus,
        normalValue as string, focusedValue as string, defocusedValue as string);
    }
    else if (typeof normalValue === 'number' && typeof focusedValue === 'number' && typeof defocusedValue === 'number') {
      style[member] = getAxisFocusOpacity(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus,
        normalValue, focusedValue, defocusedValue);
    }
    else if (axisFocusPercentage !== undefined && seriesFocusPercentage !== undefined) {
      // no interpolation possible (dash arrays, null widths): switch at the state boundary
      const percentage = useSeriesFocus ? getCombinedFocusPercentage(axisFocusPercentage, seriesFocusPercentage) : (axisFocusPercentage ?? null);
      style[member] = getFocusDiscreteValue(percentage, normalValue, focusedValue, defocusedValue);
    }
    else {
      style[member] = normalValue;
    }
  }
  return style as Partial<Style>;
}
