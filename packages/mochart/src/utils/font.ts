import type { FontConfig } from '../types/config';
import type { FontWeight, FontStyle } from '../config/core/constants';

/** The inline css a resolved font writes on a text element; a member is absent when nothing sets it. */
export interface FontInlineStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
}

// Fixed order: initial declaration order is the style attribute's serialization order.
const fontMembers: [keyof FontConfig, keyof FontInlineStyle][] = [
  ['family', 'fontFamily'],
  ['size', 'fontSize'],
  ['weight', 'fontWeight'],
  ['style', 'fontStyle']
];

// Config objects are stable per enhanced config, so the resolved style is too: a stable identity
// lets El.set skip the style diff on every unchanged frame.
const resolvedFontStyles = new WeakMap<object, WeakMap<FontConfig, FontInlineStyle | null>>();

function resolveFontStyleUncached(font: Partial<FontConfig>, chartFont: FontConfig): FontInlineStyle | null {
  let style: FontInlineStyle | null = null;
  for (const [member, property] of fontMembers) {
    const value = font[member] ?? chartFont[member];
    if (value !== null && value !== undefined) {
      style = style ?? {};
      (style as Record<string, unknown>)[property] = value;
    }
  }
  return style;
}

/**
 * The inline font style of a text element: each member is the part's own value when set, otherwise
 * the chart-wide `chart.font` value. Null when neither sets any member, so nothing is written and
 * the text keeps the host page's css.
 */
export function resolveFontStyle(font: Partial<FontConfig> | null | undefined, chartFont: FontConfig): FontInlineStyle | null {
  const partFont = font ?? chartFont;
  let byChartFont = resolvedFontStyles.get(partFont);
  if (byChartFont === undefined) {
    byChartFont = new WeakMap();
    resolvedFontStyles.set(partFont, byChartFont);
  }
  let style = byChartFont.get(chartFont);
  if (style === undefined) {
    style = resolveFontStyleUncached(partFont, chartFont);
    byChartFont.set(chartFont, style);
  }
  return style;
}
