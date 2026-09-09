// A synthetic proportional font for the golden suite: jsdom has no font engine, and the old zero stubs made every measurement fall to the 20x20 defaultBounds fallback, so truncation, tick pruning and layout fitting never ran; widths are per-code-point advance fractions of a fixed em — a pure function of the string, identical on every machine, deliberately not any real font

/** Nominal font size, in pixels, for every text element the chart renders. */
export const EM_PX = 16;

/** Measured text height as a fraction of the em box (real browsers report 1.15-1.25em). */
const LINE_HEIGHT_FRACTION = 1.2;

/** Advance widths in fractions of the em, by character group. */
const ADVANCE_FRACTION_GROUPS: readonly [number, string][] = [
  [0.28, ' iljI.,:;!|\'`'],
  [0.33, 'tfr-()[]{}/\\"'],
  [0.56, 'abcdeghknopqsuvxyz0123456789$?+*&#%'],
  [0.67, 'ABCDEFGHJKLNOPQRSTUVXYZ'],
  [0.83, 'mw'],
  [0.94, 'MW']
];

const advanceFractions = new Map<string, number>();
for (const [fraction, characters] of ADVANCE_FRACTION_GROUPS) {
  for (const character of characters) {
    advanceFractions.set(character, fraction);
  }
}

/** Anything at or above this code point is treated as full-width (CJK, symbols, emoji). */
const FULL_WIDTH_MIN_CODE_POINT = 0x2e80;
/** Everything else (accented Latin, unlisted punctuation) gets a middling advance. */
const DEFAULT_ADVANCE_FRACTION = 0.6;

function getAdvanceFraction(character: string): number {
  const known = advanceFractions.get(character);
  if (known !== undefined) {
    return known;
  }
  return (character.codePointAt(0) ?? 0) >= FULL_WIDTH_MIN_CODE_POINT ? 1 : DEFAULT_ADVANCE_FRACTION;
}

/** Width in pixels of `text` in the synthetic font. */
export function measureTextWidth(text: string): number {
  let fraction = 0;
  // by code point, so an astral character is one advance and not two
  for (const character of text) {
    fraction += getAdvanceFraction(character);
  }
  return fraction * EM_PX;
}

/** Height in pixels of a non-empty line of text in the synthetic font. */
export function getTextHeight(): number {
  return EM_PX * LINE_HEIGHT_FRACTION;
}

/** The text a browser measures: the element's own text, never a <title> child (the truncation tooltip holds the full text of an ellipsised label). */
export function getRenderedText(element: Element): string {
  let text = '';
  for (let child = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.nodeValue ?? '';
    }
    else if (child.nodeName !== 'title') {
      text += child.textContent ?? '';
    }
  }
  return text;
}

function getTextContent(element: Element): string {
  return getRenderedText(element);
}

/**
 * Install the metrics on every measurement entry point the chart uses — `getComputedTextLength`,
 * `getBBox`, and computed-style `fontSize` — all reporting the same model, so the library never
 * sees a width that disagrees with a font size.
 */
export function installTextMetrics(): void {
  // Cast: the text-measurement methods live on SVGTextContentElement in the DOM
  // lib, not on the SVGElement base prototype that jsdom gives every SVG node.
  const svgProto = globalThis.SVGElement.prototype as any;

  svgProto.getComputedTextLength = function (this: SVGTextContentElement): number {
    return measureTextWidth(getTextContent(this));
  };

  // Only text carries metrics here: the library measures bounds of <text> nodes
  // exclusively, and shapes would need a real layout engine to box correctly.
  svgProto.getBBox = function (this: SVGGraphicsElement) {
    const text = this.tagName === 'text' || this.tagName === 'tspan' ? getTextContent(this) : '';
    if (text.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return { x: 0, y: 0, width: measureTextWidth(text), height: getTextHeight() };
  };

  // jsdom resolves font-size to the keyword `medium`, which the library reads as
  // NaN and discards; report the em the widths above are built from.
  const nativeGetComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = function (element: Element, pseudoElement?: string | null) {
    const style = nativeGetComputedStyle.call(globalThis, element, pseudoElement ?? undefined);
    if (style.fontSize !== EM_PX + 'px') {
      style.fontSize = EM_PX + 'px';
    }
    return style;
  } as typeof globalThis.getComputedStyle;
}
