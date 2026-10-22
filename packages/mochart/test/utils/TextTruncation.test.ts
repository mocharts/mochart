import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  prepareTruncation,
  getTruncatedText,
  updateTruncation,
  type TruncationData,
  type TruncationDataValue,
  type TruncationMeasure
} from '../../src/utils/TextTruncation';
import { TextWidthCache } from '../../src/utils/TextWidthCache';
import { getRenderedText } from '../golden/textMetrics';

const ELLIPSIS = '…';
const SVG_NS = 'http://www.w3.org/2000/svg';
const UNIT = 10;

// A synthetic font: every code point advances UNIT, and the pairs in `kerns` kern. Where getSubStringLength books a pair's
// kern is the engine's choice (half on each glyph in Chromium and Firefox, or all on the first or the second), so a prefix
// read off the full run carries some share of the kern the cut removes; the fit must land on the same prefix under each.
type KernBooking = 'half' | 'first' | 'second';
const KERN_BOOKINGS: KernBooking[] = ['half', 'first', 'second'];
let kerns: Record<string, number> = {};
let kernBooking: KernBooking = 'half';
const kern = (a: string, b: string): number => kerns[a + b] ?? 0;

function runWidth(text: string): number {
  const codePoints = Array.from(text);
  let width = 0;
  for (let i = 0; i < codePoints.length; i++) {
    width += UNIT + (i > 0 ? kern(codePoints[i - 1], codePoints[i]) : 0);
  }
  return width;
}

function subStringWidth(text: string, charnum: number, nchars: number): number {
  const codePoints = Array.from(text);
  const before = kernBooking === 'half' ? 0.5 : kernBooking === 'second' ? 1 : 0;
  const after = kernBooking === 'half' ? 0.5 : kernBooking === 'first' ? 1 : 0;
  let width = 0;
  let charCount = 0;
  for (let i = 0; i < codePoints.length; i++) {
    if (charCount >= charnum && charCount < charnum + nchars) {
      width += UNIT + (i > 0 ? kern(codePoints[i - 1], codePoints[i]) * before : 0) + (i + 1 < codePoints.length ? kern(codePoints[i], codePoints[i + 1]) * after : 0);
    }
    charCount += codePoints[i].length;
  }
  return width;
}

beforeAll(() => {
  const svgProto = globalThis.SVGElement.prototype as any;
  svgProto.getComputedTextLength = function (this: SVGElement): number { return runWidth(getRenderedText(this)); };
  svgProto.getSubStringLength = function (this: SVGElement, charnum: number, nchars: number): number { return subStringWidth(getRenderedText(this), charnum, nchars); };
  svgProto.getBBox = function (this: SVGElement) { return { x: 0, y: 0, width: runWidth(getRenderedText(this)), height: 12 }; };
});

let svg: SVGSVGElement;

beforeEach(() => {
  kerns = {};
  kernBooking = 'half';
  svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  document.body.appendChild(svg);
});

afterEach(() => {
  svg.remove();
});

/** A drawn label: a <text> in its own <g>, as the hosts lay them out. */
function label(text: string, style?: string): SVGTextContentElement {
  const group = document.createElementNS(SVG_NS, 'g');
  const element = document.createElementNS(SVG_NS, 'text') as SVGTextContentElement;
  element.textContent = text;
  if (style !== undefined) {
    element.setAttribute('style', style);
  }
  group.appendChild(element);
  svg.appendChild(group);
  return element;
}

function measureWith(cache = new TextWidthCache()): TruncationMeasure {
  cache.beginPass(true, 0);
  return { cache, fontKey: () => 'synthetic' };
}

/** Renders a label until its truncation settles, as a host does: each pass measures, a changed drawn text is drawn before the next. */
function settle(text: string, maxLength: number, suffix = ELLIPSIS, measure = measureWith(), style?: string): { drawn: string; renders: number; truncatedText: string } {
  const element = label(text, style);
  let truncationData: TruncationDataValue = null;
  let renders = 0;
  for (let pass = 0; pass < 10; pass++) {
    const result = updateTruncation(suffix, truncationData, text, maxLength, element, measure);
    truncationData = result.truncationData;
    if (result.changed) {
      renders++;
      element.textContent = getTruncatedText(true, suffix, text, truncationData);
    }
    if (!result.checkTruncation) {
      return { drawn: element.textContent!, renders, truncatedText: (truncationData as TruncationData).truncatedText! };
    }
    measure.cache.beginPass(true, 0);
  }
  throw new Error('did not settle');
}

/** The nodes a pass appended beside the label and the nodes it left there. */
function probesOf(element: SVGTextContentElement, run: () => void): { appended: number; left: number } {
  const observer = new MutationObserver(() => {});
  observer.observe(element.parentNode!, { childList: true });
  run();
  const appended = observer.takeRecords().reduce((count, record) => count + record.addedNodes.length, 0);
  observer.disconnect();
  return { appended, left: element.parentNode!.childNodes.length - 1 };
}

describe('prepareTruncation', () => {
  it('does nothing when truncation is disabled', () => {
    expect(prepareTruncation(false, true, null)).toEqual({ truncationData: null, checkTruncation: false });
  });

  it('flags a check but has no data on first enable with no prior data', () => {
    expect(prepareTruncation(true, true, null)).toEqual({ truncationData: null, checkTruncation: true });
  });

  it('restores the full text in prior single data when changed and integrity changed', () => {
    const old: TruncationData = { text: 'Hello', truncatedText: 'Hel', lastText: 'Hell' };
    const { truncationData, checkTruncation } = prepareTruncation(true, true, old, true);
    expect(checkTruncation).toBe(true);
    expect(truncationData).toEqual({ text: 'Hello', truncatedText: 'Hello' });
  });

  it('restores the full text in each entry of prior array data', () => {
    const old: TruncationData[] = [
      { text: 'a', truncatedText: 'a', lastText: 'a' },
      { text: 'bb', truncatedText: 'b', lastText: 'bb' }
    ];
    const { truncationData } = prepareTruncation(true, true, old, true);
    expect(truncationData).toEqual([
      { text: 'a', truncatedText: 'a' },
      { text: 'bb', truncatedText: 'bb' }
    ]);
  });

  it('adopts new text for entries whose label changed, restoring the rest', () => {
    const old: TruncationData[] = [
      { text: 'aaaa', truncatedText: 'aa', lastText: 'aa' },
      { text: 'bbbb', truncatedText: 'bb', lastText: 'bb' }
    ];
    const { truncationData } = prepareTruncation(true, true, old, true, ['aaaa', 'cccc']);
    expect(truncationData).toEqual([
      { text: 'aaaa', truncatedText: 'aaaa' },
      { text: 'cccc', truncatedText: 'cccc' }
    ]);
  });

  it('adopts new single text when it changed', () => {
    const old: TruncationData = { text: 'Hello', truncatedText: 'Hel', lastText: 'Hel' };
    const { truncationData } = prepareTruncation(true, true, old, true, 'World!');
    expect(truncationData).toEqual({ text: 'World!', truncatedText: 'World!' });
  });

  it('drops prior data when integrity did not change', () => {
    const old: TruncationData = { text: 'Hello', truncatedText: 'Hel' };
    const { truncationData } = prepareTruncation(true, true, old, false);
    expect(truncationData).toBe(null);
  });

  it('keeps prior data and skips the check when nothing changed', () => {
    const old: TruncationData = { text: 'Hello', truncatedText: 'Hel' };
    expect(prepareTruncation(true, false, old)).toEqual({ truncationData: old, checkTruncation: false });
  });
});

describe('getTruncatedText', () => {
  it('returns the text untouched when disabled or data is null', () => {
    expect(getTruncatedText(false, ELLIPSIS, 'Hello', { text: 'Hello', truncatedText: 'Hel' })).toBe('Hello');
    expect(getTruncatedText(true, ELLIPSIS, 'Hello', null)).toBe('Hello');
  });

  it('appends the truncation value to a truncated single string', () => {
    expect(getTruncatedText(true, ELLIPSIS, 'Hello', { text: 'Hello', truncatedText: 'Hel' })).toBe('Hel' + ELLIPSIS);
  });

  it('leaves an untruncated single string alone', () => {
    expect(getTruncatedText(true, ELLIPSIS, 'Hi', { text: 'Hi', truncatedText: 'Hi' })).toBe('Hi');
  });

  it('drops the whitespace a prefix ends in before the suffix', () => {
    expect(getTruncatedText(true, ELLIPSIS, 'Tea party', { text: 'Tea party', truncatedText: 'Tea ' })).toBe('Tea' + ELLIPSIS);
    const data: TruncationData[] = [
      { text: 'Tea party', truncatedText: 'Tea ' },
      { text: 'Error bars', truncatedText: 'Er' }
    ];
    expect(getTruncatedText(true, ELLIPSIS, ['Tea party', 'Error bars'], data)).toEqual(['Tea' + ELLIPSIS, 'Er' + ELLIPSIS]);
  });

  it('truncates only the entries that changed in an array', () => {
    const data: TruncationData[] = [
      { text: 'Hello', truncatedText: 'Hel' },
      { text: 'Hi', truncatedText: 'Hi' }
    ];
    expect(getTruncatedText(true, ELLIPSIS, ['Hello', 'Hi'], data)).toEqual(['Hel' + ELLIPSIS, 'Hi']);
  });
});

describe('updateTruncation', () => {
  it('seeds single truncation data and skips measuring when there is no dom element', () => {
    const { checkTruncation, changed, truncationData } = updateTruncation(ELLIPSIS, null, 'Hello', 100, null, measureWith());
    expect(checkTruncation).toBe(false);
    expect(changed).toBe(false);
    expect(truncationData).toEqual({ text: 'Hello' });
  });

  it('settles empty text at once', () => {
    const { checkTruncation, truncationData } = updateTruncation(ELLIPSIS, null, '', 100, label(''), measureWith());
    expect(checkTruncation).toBe(false);
    expect(truncationData).toEqual({ text: '', truncatedText: '', lastText: '' });
  });

  it('settles a full text that fits without a second pass', () => {
    const { checkTruncation, changed, truncationData } = updateTruncation(ELLIPSIS, null, 'Hello', 100, label('Hello'), measureWith());
    expect(checkTruncation).toBe(false);
    expect(changed).toBe(false);
    expect(truncationData).toEqual({ text: 'Hello', truncatedText: 'Hello', lastText: 'Hello' });
  });

  it('fits the longest prefix whose width with the suffix fits, in one pass, and removes its probes', () => {
    const element = label('Hello World');
    let result!: ReturnType<typeof updateTruncation>;
    const probes = probesOf(element, () => { result = updateTruncation(ELLIPSIS, null, 'Hello World', 60, element, measureWith()); });
    // five units and the suffix make 60; the fit is drawn next and verified after
    expect(result.truncationData).toEqual({ text: 'Hello World', truncatedText: 'Hello', lastText: 'Hello World' });
    expect(result.changed).toBe(true);
    expect(result.checkTruncation).toBe(true);
    expect(probes.appended).toBeGreaterThan(0);
    expect(probes.left).toBe(0);
  });

  it('verifies the drawn fit on the next pass with one probe of the next longer candidate and settles it as drawn', () => {
    const measure = measureWith();
    const element = label('Hello World');
    const fitted = updateTruncation(ELLIPSIS, null, 'Hello World', 60, element, measure).truncationData;
    element.textContent = 'Hello' + ELLIPSIS;
    let result!: ReturnType<typeof updateTruncation>;
    // "Hello W" with the suffix, 80, is the next prefix that draws longer: "Hello " draws as "Hello"
    const probes = probesOf(element, () => { result = updateTruncation(ELLIPSIS, fitted, 'Hello World', 60, element, measure); });
    expect(result.truncationData).toEqual({ text: 'Hello World', truncatedText: 'Hello', lastText: 'Hello' });
    expect(result.checkTruncation).toBe(false);
    expect(result.changed).toBe(false);
    expect(probes).toEqual({ appended: 1, left: 0 });
  });

  it('grows the drawn fit to the next longer candidate when that fits too, and settles it on the next pass with no further growth', () => {
    // the suffix kerns tight against an r, which the prefix table cannot see: "Er." draws 15 wide, "Err." 25
    kerns = { 'r.': -15 };
    const measure = measureWith();
    const element = label('Error bars');
    const fitted = updateTruncation('.', null, 'Error bars', 26, element, measure).truncationData;
    expect(fitted).toEqual({ text: 'Error bars', truncatedText: 'E', lastText: 'Error bars' });
    element.textContent = 'E.';
    const grown = updateTruncation('.', fitted, 'Error bars', 26, element, measure);
    expect(grown.truncationData).toEqual({ text: 'Error bars', truncatedText: 'Er', lastText: 'E' });
    expect(grown.changed).toBe(true);
    expect(grown.checkTruncation).toBe(true);
    element.textContent = 'Er.';
    let settled!: ReturnType<typeof updateTruncation>;
    const probes = probesOf(element, () => { settled = updateTruncation('.', grown.truncationData, 'Error bars', 26, element, measure); });
    expect(settled.truncationData).toEqual({ text: 'Error bars', truncatedText: 'Er', lastText: 'Er' });
    expect(settled.checkTruncation).toBe(false);
    expect(settled.changed).toBe(false);
    expect(probes.appended).toBe(0);
  });

  it('costs a label at most two renders after its fit', () => {
    kerns = { 'r.': -15, Te: -4 };
    expect(settle('Error bars', 26, '.').renders).toBe(2);
    expect(settle('Tea party', 19, '.').renders).toBe(2);
    expect(settle('Hello World', 60).renders).toBe(1);
  });

  // Regression: a verification deferred to a settled pass never ran for a host whose props stood still through a build's last
  // frame, and a fit a hair wider than its room ("Fi..." at 26.672 px in 26.667) stayed drawn
  it('verifies a drawn fit on a tween pass too', () => {
    const measure = measureWith();
    const element = label('Hello World');
    const fitted = updateTruncation(ELLIPSIS, null, 'Hello World', 60, element, measure).truncationData;
    element.textContent = 'Hello' + ELLIPSIS;
    (element as any).getSubStringLength = () => 60.5;
    measure.cache.beginPass(false, 0);
    const verified = updateTruncation(ELLIPSIS, fitted, 'Hello World', 60, element, measure);
    expect(verified.truncationData).toEqual({ text: 'Hello World', truncatedText: 'Hell', lastText: 'Hell' });
    expect(verified.checkTruncation).toBe(false);
  });

  it('shrinks the drawn fit by one unit when it overflows at rest', () => {
    const measure = measureWith();
    const element = label('Hello World');
    const fitted = updateTruncation(ELLIPSIS, null, 'Hello World', 60, element, measure).truncationData;
    element.textContent = 'Hello' + ELLIPSIS;
    // a shaping the prefix table cannot see (a ligature across the cut) makes the drawn text a hair wider
    (element as any).getSubStringLength = () => 60.5;
    const { checkTruncation, changed, truncationData } = updateTruncation(ELLIPSIS, fitted, 'Hello World', 60, element, measure);
    expect(truncationData).toEqual({ text: 'Hello World', truncatedText: 'Hell', lastText: 'Hell' });
    expect(checkTruncation).toBe(false);
    expect(changed).toBe(true);
  });

  it('settles on the bare suffix when not even one unit fits with it', () => {
    const measure = measureWith();
    const element = label('Hello');
    const fitted = updateTruncation(ELLIPSIS, null, 'Hello', 5, element, measure);
    expect(fitted.truncationData).toEqual({ text: 'Hello', truncatedText: '', lastText: 'Hello' });
    element.textContent = ELLIPSIS;
    const { checkTruncation, truncationData } = updateTruncation(ELLIPSIS, fitted.truncationData, 'Hello', 5, element, measure);
    expect(truncationData).toEqual({ text: 'Hello', truncatedText: '', lastText: '' });
    expect(checkTruncation).toBe(false);
  });

  it('fits each label of a list to its own room', () => {
    const elements = [label('Hello World'), label('Hi')];
    const { checkTruncation, changed, truncationData } = updateTruncation(ELLIPSIS, null, ['Hello World', 'Hi'], [60, 100], elements, measureWith());
    expect(truncationData).toEqual([
      { text: 'Hello World', truncatedText: 'Hello', lastText: 'Hello World' },
      { text: 'Hi', truncatedText: 'Hi', lastText: 'Hi' }
    ]);
    expect(checkTruncation).toBe(true);
    expect(changed).toBe(true);
  });

  it('reads the suffix width once per font', () => {
    const measure = measureWith();
    const first = label('Hello World');
    const firstProbes = probesOf(first, () => updateTruncation(ELLIPSIS, null, 'Hello World', 60, first, measure));
    expect(firstProbes.appended).toBe(1);
    const second = label('World Hello');
    const secondProbes = probesOf(second, () => updateTruncation(ELLIPSIS, null, 'World Hello', 60, second, measure));
    expect(secondProbes.appended).toBe(0);
  });

  // the prefix widths come off the full run, which kerns across the cut and not with the suffix; the verification corrects
  // both, so every booking of a pair's kern lands on the prefix whose drawn width fits
  describe.each(KERN_BOOKINGS)('kerning booked %s', booking => {
    beforeEach(() => {
      kernBooking = booking;
    });

    it('removes the kern the cut takes away', () => {
      kerns = { Te: -4 };
      // "T." is 20 wide drawn alone; the run's "T" reads 6 to 10, which fits a 19 px room on paper and then overflows it
      expect(settle('Tea party', 19, '.').drawn).toBe('.');
      expect(settle('Tea party', 20, '.').drawn).toBe('T.');
    });

    it('adds the kern the suffix brings', () => {
      kerns = { 'r.': -2 };
      // "Er..." is 48 wide drawn alone; the prefix table says 50 and stops at "E", which the verification grows
      expect(settle('Error bars', 48, '...').drawn).toBe('Er...');
    });

    it('cuts after a space as the one unit shorter', () => {
      kerns = { 'a.': -3 };
      // "Tea" is 30 and "Tea." 37 drawn; "Tea " with the suffix is the same candidate, so a 37 px room fits "Tea."
      expect(settle('Tea party', 37, '.').drawn).toBe('Tea.');
      expect(settle('Tea party', 36, '.').drawn).toBe('Te.');
    });
  });

  // the synthetic font leaves letter-spacing out of every read, as WebKit does; the cache adds a gap after every unit
  // but the last to a whole text, and the fit must add the same gaps to a prefix and one more before the suffix
  describe('letter-spacing the engine leaves out of its reads', () => {
    const nativeGetComputedStyle = globalThis.getComputedStyle;

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
    });

    function spacedMeasure(): TruncationMeasure {
      const cache = new TextWidthCache();
      cache.beginPass(true, 0);
      return { cache, fontKey: element => cache.fontKey('ticks', element) };
    }

    it('fits the prefix whose drawn width, gaps included, is the longest in the room', () => {
      // without spacing "Hello Wor…" is 100; with 3px gaps it draws 127 and "Hello…" 75, the longest under 100 ("Hello W…" is 101)
      expect(settle('Hello World', 100).drawn).toBe('Hello Wor…');
      const spaced = settle('Hello World', 100, ELLIPSIS, spacedMeasure(), 'letter-spacing: 3px');
      expect(spaced.drawn).toBe('Hello…');
      expect(spaced.renders).toBe(1);
    });
  });

  // WebKit's getSubStringLength spans one run of writing direction, so a right-to-left label with its suffix reads as the
  // label alone; the cache reads such a text with getComputedTextLength and a prefix from a probe holding it
  describe('right-to-left text whose reads stop at the suffix', () => {
    const svgProto = globalThis.SVGElement.prototype as any;
    const rightToLeft = (char: string): boolean => /[\u0590-\u08ff]/.test(char);
    let wholeGetSubStringLength: unknown;

    beforeEach(() => {
      wholeGetSubStringLength = svgProto.getSubStringLength;
      svgProto.getSubStringLength = function (this: SVGElement, charnum: number, nchars: number): number {
        const text = getRenderedText(this);
        let run = 0;
        while (run < nchars && rightToLeft(text[charnum + run]) === rightToLeft(text[charnum])) {
          run++;
        }
        return subStringWidth(text, charnum, run);
      };
    });

    afterEach(() => {
      svgProto.getSubStringLength = wholeGetSubStringLength;
    });

    it('fits the prefix whose drawn width with the suffix is the longest in the room', () => {
      // "القاه..." is 80 drawn; the one-run read says 50, which would let the verification grow it to "القاهر..." at 90
      const settled = settle('القاهرة الإسكندرية', 80, '...');
      expect(settled.drawn).toBe('القاه...');
      expect(settled.renders).toBe(1);
    });
  });

  // slicing by UTF-16 code unit cut astral characters in half and emitted a lone surrogate, which renders as U+FFFD; every cut lands on a user-perceived character boundary instead
  describe('multi-code-unit characters', () => {
    const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
    const fit = (text: string, maxLength: number): string => {
      const truncatedText = (updateTruncation(ELLIPSIS, null, text, maxLength, label(text), measureWith()).truncationData as TruncationData).truncatedText!;
      expect(truncatedText).not.toMatch(loneSurrogate);
      return truncatedText;
    };

    it('never splits an emoji', () => {
      expect(fit('😀😀😀😀😀', 35)).toBe('😀😀');
    });

    // a flag is two regional-indicator code points, so this one needs grapheme segmentation
    it('keeps a flag whole', () => {
      expect(fit('🇺🇸🇺🇸 flag', 55)).toBe('🇺🇸🇺🇸');
    });

    it('keeps a combining mark with its base character', () => {
      const acuteE = 'é';
      const truncatedText = fit(acuteE.repeat(3), 35);
      expect(truncatedText).toBe(acuteE);
    });
  });
});
