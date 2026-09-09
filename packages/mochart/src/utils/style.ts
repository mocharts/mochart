import { color } from 'd3-color';

import type { Style } from '../types/config';

/** The svg presentation attributes a style maps onto: the config's `strokeColor` / `fillColor` are svg's `stroke` / `fill`. */
export interface StyleAttributes {
  stroke?: string | null;
  strokeOpacity?: number | null;
  strokeWidth?: number | null;
  strokeDasharray?: string | null;
  fill?: string | null;
  fillOpacity?: number | null;
}

// Fixed order rather than the style's own key order: initial attribute order is
// svg serialization order, which the golden snapshots record.
const styleAttributeOrder: [keyof Style, keyof StyleAttributes][] = [
  ['strokeColor', 'stroke'],
  ['strokeOpacity', 'strokeOpacity'],
  ['strokeWidth', 'strokeWidth'],
  ['strokeDashArray', 'strokeDasharray'],
  ['fillColor', 'fill'],
  ['fillOpacity', 'fillOpacity']
];

/**
 * A style color as one css color, for the html parts of the chart that have no
 * separate opacity attribute. A null opacity returns the color exactly as
 * configured, so keywords like `currentColor`, which d3 cannot parse, still work.
 * A keyword with an opacity goes through `color-mix`, which the browser resolves
 * after `currentColor` does.
 */
/** A border with no color draws nothing, so it occupies nothing either — the same as a null width. */
export function cssBorderWidth(styleColor: string | null | undefined, strokeWidth: number | null | undefined): number {
  return styleColor === null || styleColor === undefined ? 0 : strokeWidth ?? 0;
}

export function cssStyleColor(styleColor: string | null | undefined, styleOpacity: number | null | undefined): string | null {
  if (styleColor === null || styleColor === undefined || styleOpacity === null || styleOpacity === undefined) {
    return styleColor ?? null;
  }
  const parsed = color(styleColor);
  if (parsed === null) {
    return styleOpacity >= 1 ? styleColor : `color-mix(in srgb, ${styleColor} ${cssPercent(styleOpacity)}%, transparent)`;
  }
  parsed.opacity *= styleOpacity;
  return parsed.toString();
}

// trimmed, because 0.9 * 100 is 90.00000000000001
function cssPercent(fraction: number): number {
  return Number((fraction * 100).toFixed(4));
}

/** A `null` is passed through rather than dropped: it means "remove the attribute". Members absent from the style stay absent. */
export function styleToAttributes(style: Partial<Style> | null | undefined): StyleAttributes {
  const attributes: StyleAttributes = {};
  if (!style) {
    return attributes;
  }
  for (const [styleKey, attributeName] of styleAttributeOrder) {
    if (styleKey in style) {
      (attributes as Record<string, unknown>)[attributeName] = (style as Record<string, unknown>)[styleKey];
    }
  }
  return attributes;
}
