import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextWidthCache, axisTicksTextGroup, axisTitleTextGroup, axisThresholdTitleTextGroup, valueAxisTextGroup } from '../../src/utils/TextWidthCache';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Probe { element: SVGTextContentElement; widthReads: number; boxReads: number }

/** A <text> whose width is one unit per character (zero when `hidden`), counting the reads that reach it. */
function probe(text: string, hidden = false, inlineStyle: string | null = null): Probe {
  const element = document.createElementNS(SVG_NS, 'text') as SVGTextContentElement;
  element.textContent = text;
  if (inlineStyle !== null) {
    element.setAttribute('style', inlineStyle);
  }
  const result: Probe = { element, widthReads: 0, boxReads: 0 };
  (element as any).getComputedTextLength = () => { result.widthReads++; return hidden ? 0 : text.length; };
  (element as any).getBBox = () => { result.boxReads++; return { x: 0, y: 0, width: hidden ? 0 : text.length, height: hidden ? 0 : 12 }; };
  return result;
}

const KEY = 'normal|400|16px|serif|normal|0';

let cache: TextWidthCache;

beforeEach(() => {
  cache = new TextWidthCache();
  cache.beginPass(true, 0);
});

describe('TextWidthCache widths', () => {
  it('reads a text once per font key and answers from memory after', () => {
    const first = probe('Hello');
    const second = probe('Hello');
    expect(cache.width(KEY, first.element)).toBe(5);
    expect(cache.width(KEY, second.element)).toBe(5);
    expect(first.widthReads).toBe(1);
    expect(second.widthReads).toBe(0);
  });

  it('reads a text it has not seen, and the same text again in another font', () => {
    const hello = probe('Hello');
    const world = probe('World!');
    cache.width(KEY, hello.element);
    expect(cache.width(KEY, world.element)).toBe(6);
    expect(world.widthReads).toBe(1);
    expect(cache.width('other font', hello.element)).toBe(5);
    expect(hello.widthReads).toBe(2);
  });

  // a hidden container measures every text as 0; a kept 0 would survive the container being shown
  it('never keeps a zero width', () => {
    const hidden = probe('Hello', true);
    expect(cache.width(KEY, hidden.element)).toBe(0);
    expect(cache.width(KEY, hidden.element)).toBe(0);
    expect(hidden.widthReads).toBe(2);
    const shown = probe('Hello');
    expect(cache.width(KEY, shown.element)).toBe(5);
    expect(shown.widthReads).toBe(1);
  });

  it('keys by the drawn text, not a tooltip <title> child', () => {
    const plain = probe('Hel');
    const withTitle = probe('Hel');
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = 'Hello';
    withTitle.element.appendChild(title);
    cache.width(KEY, plain.element);
    expect(cache.width(KEY, withTitle.element)).toBe(3);
    expect(withTitle.widthReads).toBe(0);
  });

  it('reads a text with other element children fresh every time', () => {
    const spanned = probe('Hello');
    spanned.element.appendChild(document.createElementNS(SVG_NS, 'tspan'));
    cache.width(KEY, spanned.element);
    cache.width(KEY, spanned.element);
    expect(spanned.widthReads).toBe(2);
    expect(cache.width(KEY, probe('Hello').element)).toBe(5);
  });
});

describe('TextWidthCache width reads', () => {
  it('reads the direct text through getSubStringLength when the engine has it, else getComputedTextLength, else getBBox', () => {
    const prefixed = probe('Hello');
    const reads: [number, number][] = [];
    (prefixed.element as any).getSubStringLength = (charnum: number, nchars: number) => { reads.push([charnum, nchars]); return 7; };
    expect(cache.width(KEY, prefixed.element)).toBe(7);
    expect(reads).toEqual([[0, 5]]);
    expect(prefixed.widthReads).toBe(0);
    const advance = probe('Hello');
    expect(cache.width('advance', advance.element)).toBe(5);
    expect(advance.widthReads).toBe(1);
    const boxed = document.createElementNS(SVG_NS, 'text') as SVGTextContentElement;
    boxed.textContent = 'Hello';
    (boxed as any).getBBox = () => ({ x: 0, y: 0, width: 9, height: 12 });
    expect(cache.width('box', boxed)).toBe(9);
  });

  // getSubStringLength(0, 0) throws IndexSizeError in every engine
  it('reads an empty text as zero without a read', () => {
    const empty = probe('');
    (empty.element as any).getSubStringLength = () => { throw new Error('IndexSizeError'); };
    expect(cache.width(KEY, empty.element)).toBe(0);
    expect(empty.widthReads).toBe(0);
  });
});

describe('TextWidthCache letter-spacing', () => {
  const svgProto = globalThis.SVGElement.prototype as any;
  const nativeGetComputedStyle = globalThis.getComputedStyle;
  const nativeGetSubStringLength = svgProto.getSubStringLength;
  const spacingOf = (element: Element): number => parseFloat((element as HTMLElement).style.letterSpacing) || 0;

  beforeEach(() => {
    globalThis.getComputedStyle = function (element: Element, pseudoElement?: string | null) {
      const style = nativeGetComputedStyle.call(globalThis, element, pseudoElement ?? undefined);
      style.fontSize = '16px';
      style.letterSpacing = (element as HTMLElement).style.letterSpacing || 'normal';
      return style;
    } as typeof globalThis.getComputedStyle;
  });

  afterEach(() => {
    globalThis.getComputedStyle = nativeGetComputedStyle;
    svgProto.getSubStringLength = nativeGetSubStringLength;
  });

  /** A spaced text in its own document, since the probe's answer is kept per document. */
  function spacedText(text: string, spacing: string): SVGGraphicsElement {
    const doc = document.implementation.createHTMLDocument('spaced');
    const element = doc.createElementNS(SVG_NS, 'text') as SVGTextContentElement;
    element.textContent = text;
    element.setAttribute('style', 'letter-spacing: ' + spacing);
    doc.body.appendChild(element);
    return element;
  }

  it('adds the spacing to a width when the engine leaves it out of its reads, once per gap', () => {
    // WebKit: the advance reads ignore letter-spacing, the ink has a gap after every character but the last
    svgProto.getSubStringLength = function (this: SVGElement, _charnum: number, nchars: number): number { return nchars * 10; };
    const element = spacedText('Hello', '2px');
    expect(cache.width(cache.fontKey('ticks', element), element)).toBe(58);
    const plain = spacedText('Hello', 'normal');
    expect(cache.width(cache.fontKey('title', plain), plain)).toBe(50);
  });

  it('leaves a width alone when the engine counts the spacing itself', () => {
    svgProto.getSubStringLength = function (this: SVGElement, _charnum: number, nchars: number): number { return nchars * (10 + spacingOf(this)); };
    const element = spacedText('Hello', '2px');
    expect(cache.width(cache.fontKey('ticks', element), element)).toBe(60);
  });
});

describe('TextWidthCache heights', () => {
  it('reads the box once per font key, whatever the text', () => {
    const hello = probe('Hello');
    const world = probe('World!');
    expect(cache.height(KEY, hello.element)).toBe(12);
    expect(cache.height(KEY, world.element)).toBe(12);
    expect(hello.boxReads).toBe(1);
    expect(world.boxReads).toBe(0);
    expect(cache.height('other font', world.element)).toBe(12);
    expect(world.boxReads).toBe(1);
  });

  it('never keeps a zero height', () => {
    const hidden = probe('Hello', true);
    expect(cache.height(KEY, hidden.element)).toBe(0);
    expect(cache.height(KEY, hidden.element)).toBe(0);
    expect(hidden.boxReads).toBe(2);
  });
});

describe('TextWidthCache generations', () => {
  const settledPass = () => cache.beginPass(true, 0);

  it('drops an entry untouched for two generations and keeps one that is touched', () => {
    const kept = probe('kept');
    const dropped = probe('dropped');
    cache.width(KEY, kept.element);
    cache.width(KEY, dropped.element);
    for (let generation = 0; generation < 2; generation++) {
      settledPass();
      cache.width(KEY, kept.element);
      expect(cache.width(KEY, dropped.element)).toBe(7);
      expect(dropped.widthReads).toBe(1);
    }
    // two generations without a touch
    settledPass();
    cache.width(KEY, kept.element);
    settledPass();
    cache.width(KEY, kept.element);
    settledPass();
    cache.width(KEY, kept.element);
    expect(kept.widthReads).toBe(1);
    cache.width(KEY, dropped.element);
    expect(dropped.widthReads).toBe(2);
  });

  it('counts a generation only for a settled pass that measures', () => {
    const entry = probe('Hello');
    cache.width(KEY, entry.element);
    for (let frame = 0; frame < 10; frame++) {
      cache.beginPass(false, 0);
      cache.width(KEY, probe('other').element);
    }
    // settled passes that measure nothing do not age the cache either
    for (let pass = 0; pass < 10; pass++) {
      settledPass();
    }
    cache.width(KEY, entry.element);
    expect(entry.widthReads).toBe(1);
  });

  it('empties on clear and on a fontsVersion bump', () => {
    const entry = probe('Hello');
    cache.width(KEY, entry.element);
    cache.height(KEY, entry.element);
    cache.clear();
    cache.width(KEY, entry.element);
    cache.height(KEY, entry.element);
    expect(entry.widthReads).toBe(2);
    expect(entry.boxReads).toBe(2);
    cache.beginPass(true, 1);
    cache.width(KEY, entry.element);
    expect(entry.widthReads).toBe(3);
  });
});

describe('TextWidthCache font keys', () => {
  const nativeGetComputedStyle = globalThis.getComputedStyle;
  let styleReads = 0;

  // jsdom resolves no font size of its own; the inline size stands in, as in the golden suite's metrics
  beforeEach(() => {
    styleReads = 0;
    globalThis.getComputedStyle = function (element: Element, pseudoElement?: string | null) {
      styleReads++;
      const style = nativeGetComputedStyle.call(globalThis, element, pseudoElement ?? undefined);
      style.fontSize = (element as HTMLElement).style.fontSize || '16px';
      return style;
    } as typeof globalThis.getComputedStyle;
  });

  afterEach(() => {
    globalThis.getComputedStyle = nativeGetComputedStyle;
  });

  it('reads the style of one element per group per settled pass', () => {
    const first = probe('a', false, 'font-size: 12px');
    const second = probe('b', false, 'font-size: 12px');
    const key = cache.fontKey('ticks', first.element);
    expect(cache.fontKey('ticks', second.element)).toBe(key);
    expect(styleReads).toBe(1);
    cache.beginPass(true, 0);
    expect(cache.fontKey('ticks', second.element)).toBe(key);
    expect(styleReads).toBe(2);
  });

  it('reuses the last key through the frames of a tween', () => {
    const element = probe('a', false, 'font-size: 12px').element;
    const key = cache.fontKey('title', element);
    for (let frame = 0; frame < 5; frame++) {
      cache.beginPass(false, 0);
      expect(cache.fontKey('title', element)).toBe(key);
    }
    expect(styleReads).toBe(1);
  });

  it('reads again at once when the inline style changed', () => {
    const element = probe('a', false, 'font-size: 12px').element;
    const key = cache.fontKey('title', element);
    cache.beginPass(false, 0);
    element.setAttribute('style', 'font-size: 20px');
    const changed = cache.fontKey('title', element);
    expect(changed).not.toBe(key);
    expect(styleReads).toBe(2);
    expect(cache.fontSize('title')).toBe(20);
  });

  it('names the font, so two groups in one font share a key and a fontsVersion bump does not', () => {
    const title = probe('a', false, 'font-size: 12px').element;
    const legend = probe('b', false, 'font-size: 12px').element;
    expect(cache.fontKey('title', title)).toBe(cache.fontKey('legendItem', legend));
    cache.beginPass(true, 1);
    expect(cache.fontKey('title', title)).not.toBe(cache.fontKey('legendItem', probe('b', false, 'font-size: 14px').element));
  });

  it('gives each axis part its own group name', () => {
    expect(axisTicksTextGroup(valueAxisTextGroup('left'), false)).toBe('valueAxis:left:ticks');
    expect(axisTicksTextGroup('categoryAxis', true)).toBe('categoryAxis:minorTicks');
    expect(axisTitleTextGroup('categoryAxis')).toBe('categoryAxis:title');
    expect(axisThresholdTitleTextGroup('categoryAxis', 2)).toBe('categoryAxis:threshold:2');
  });
});
