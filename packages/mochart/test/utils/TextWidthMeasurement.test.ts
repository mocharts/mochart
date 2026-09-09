// TextTruncation fits text with getComputedTextLength(), so every width a layout reserves must come from the same call — getBBox().width is not interchangeable (Gecko inflates text boxes by 2px per side, making Firefox reserve more than it needs)
import { describe, it, expect } from 'vitest';
import { getSvgMaxWidthAndHeight, getSvgWidthAndHeight } from '../../src/utils/TextMeasurement';
import { truncateSVGText } from '../../src/utils/TextTruncation';
import { getTextHeight, measureTextWidth } from '../golden/textMetrics';

/** Gecko's text-bbox width inflation, 2px per side — measured live in Firefox, exactly 4.00 for every label. */
const GECKO_BBOX_WIDTH_INFLATION = 4;

/** Any box height above the advance model's, so a height read off the box is distinguishable. */
const BOX_HEIGHT_EXCESS = 3;

const strings = ['M', 'MMMMMMMMMM', 'iiii', 'Hello world', 'Total revenue (millions)'];

/** A <text> whose advance and box disagree exactly the way Gecko's do. */
function geckoTextElement(text: string): SVGTextContentElement {
  const advance = measureTextWidth(text);
  return {
    getComputedTextLength: () => advance,
    getBBox: () => ({ x: -2, y: -2, width: advance + GECKO_BBOX_WIDTH_INFLATION, height: getTextHeight() + BOX_HEIGHT_EXCESS })
  } as unknown as SVGTextContentElement;
}

describe('svg text width measurement', () => {
  it('reserves the advance width, not the inflated box width', () => {
    for (const text of strings) {
      const element = geckoTextElement(text);
      expect(getSvgWidthAndHeight(element).width).toBe(Math.ceil(measureTextWidth(text)));
    }
  });

  it('reserves the max advance width over a list, not the max box width', () => {
    const elements = strings.map(geckoTextElement);
    const widest = Math.max(...strings.map(measureTextWidth));
    expect(getSvgMaxWidthAndHeight(elements).width).toBe(Math.ceil(widest));
  });

  it('never reserves less than the width truncation fits to', () => {
    for (const text of strings) {
      const element = geckoTextElement(text);
      // ceil, not floor or round: reserving below the advance truncates text that exactly fits
      expect(getSvgWidthAndHeight(element).width).toBeGreaterThanOrEqual(element.getComputedTextLength());
    }
  });

  it('leaves text untruncated at exactly its reserved width', () => {
    for (const text of strings) {
      const element = geckoTextElement(text);
      const reservedWidth = getSvgWidthAndHeight(element).width;
      expect(truncateSVGText(element, reservedWidth, '...', { text }).truncatedText).toBe(text);
    }
  });

  it('takes height from the box, the only height measurement text has', () => {
    // deliberate: there is no advance-based height, so height keeps its single source
    expect(getSvgWidthAndHeight(geckoTextElement('M')).height).toBe(Math.ceil(getTextHeight() + BOX_HEIGHT_EXCESS));
  });

  it('falls back to the box for an element with no advance', () => {
    const shape = { getBBox: () => ({ x: 0, y: 0, width: 12.5, height: 8 }) } as unknown as SVGGraphicsElement;
    expect(getSvgWidthAndHeight(shape)).toEqual({ width: 13, height: 8 });
  });
});
