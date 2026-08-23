import { describe, it, expect } from 'vitest';
import {
  prepareTruncation,
  getTruncatedText,
  truncateSVGText,
  updateTruncation,
  type TruncationData
} from '../../src/utils/TextTruncation';

// jsdom does not implement getComputedTextLength; stub the one method the
// truncation logic reads off an SVGTextContentElement.
const el = (len: number) => ({ getComputedTextLength: () => len } as unknown as SVGTextContentElement);

const ELLIPSIS = '…';

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

  it('truncates only the entries that changed in an array', () => {
    const data: TruncationData[] = [
      { text: 'Hello', truncatedText: 'Hel' },
      { text: 'Hi', truncatedText: 'Hi' }
    ];
    expect(getTruncatedText(true, ELLIPSIS, ['Hello', 'Hi'], data)).toEqual(['Hel' + ELLIPSIS, 'Hi']);
  });
});

describe('truncateSVGText', () => {
  it('settles empty text immediately', () => {
    expect(truncateSVGText(el(0), 100, ELLIPSIS, { text: '' })).toEqual({ text: '', truncatedText: '', lastText: '' });
  });

  it('returns unchanged once truncatedText equals lastText (settled)', () => {
    const data: TruncationData = { text: 'Hello', truncatedText: 'Hel', lastText: 'Hel' };
    expect(truncateSVGText(el(50), 100, ELLIPSIS, data)).toBe(data);
  });

  it('makes an initial proportional guess when over the limit for the first time', () => {
    // length 200, max 100 => keep ~half minus the suffix: floor((100/200)*11)-1=4 chars of "Hello World"
    const out = truncateSVGText(el(200), 100, ELLIPSIS, { text: 'Hello World' });
    expect(out).toEqual({ text: 'Hello World', truncatedText: 'Hell', lastText: 'Hel' });
  });

  it('guesses from the rendered truncated length after a reset', () => {
    // rendered is "Hello Wo" + ellipsis (9 chars) at length 180, max 60 => floor((60/180)*9)-1=2 chars
    const out = truncateSVGText(el(180), 60, ELLIPSIS, { text: 'Hello World', truncatedText: 'Hello Wo' });
    expect(out).toEqual({ text: 'Hello World', truncatedText: 'He', lastText: 'H' });
  });

  it('shrinks by one character on a subsequent over-limit pass', () => {
    const out = truncateSVGText(el(150), 100, ELLIPSIS, { text: 'Hello World', truncatedText: 'Hello', lastText: 'Hello World' });
    expect(out).toEqual({ text: 'Hello World', truncatedText: 'Hell', lastText: 'Hello' });
  });

  // Regression: shrinking past an empty truncatedText sliced to -1 (the whole text minus one) and the
  // state cycled forever whenever the bare suffix still overflowed
  it('settles empty instead of cycling when the suffix alone is wider than the limit', () => {
    const out = truncateSVGText(el(8), 5, ELLIPSIS, { text: 'Hello', truncatedText: '', lastText: 'H' });
    expect(out).toEqual({ text: 'Hello', truncatedText: '', lastText: '' });
    expect(truncateSVGText(el(8), 5, ELLIPSIS, out)).toBe(out);
  });

  it('grows by one character when back under the limit', () => {
    const out = truncateSVGText(el(50), 100, ELLIPSIS, { text: 'Hello', truncatedText: 'He', lastText: 'H' });
    expect(out).toEqual({ text: 'Hello', truncatedText: 'Hel', lastText: 'He' });
  });

  it('settles when under the limit and no longer growing', () => {
    const out = truncateSVGText(el(50), 100, ELLIPSIS, { text: 'Hello', truncatedText: 'He', lastText: 'Hel' });
    expect(out).toEqual({ text: 'Hello', truncatedText: 'He', lastText: 'He' });
  });

  // slicing by UTF-16 code unit cut astral characters in half and emitted a lone surrogate, which renders as U+FFFD; every cut lands on a user-perceived character boundary instead
  describe('multi-code-unit characters', () => {
    // a high surrogate not followed by a low one, or a low one not preceded by a high one
    const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
    const noLoneSurrogate = (text: string) => expect(text).not.toMatch(loneSurrogate);

    it('never splits an emoji on the initial proportional guess', () => {
      // five emoji, each two code units: the old code kept 2.5 of them
      const out = truncateSVGText(el(130), 65, ELLIPSIS, { text: '😀😀😀😀😀' });
      noLoneSurrogate(out.truncatedText!);
      expect(Array.from(out.truncatedText!).every(unit => unit === '😀')).toBe(true);
    });

    it('never splits an emoji when shrinking by one', () => {
      const out = truncateSVGText(el(150), 100, ELLIPSIS, { text: '😀😀😀', truncatedText: '😀😀', lastText: '😀😀😀' });
      expect(out.truncatedText).toBe('😀');
      noLoneSurrogate(out.truncatedText!);
    });

    it('never splits an emoji when growing by one', () => {
      const out = truncateSVGText(el(50), 100, ELLIPSIS, { text: '😀😀😀', truncatedText: '😀', lastText: '' });
      expect(out.truncatedText).toBe('😀😀');
      noLoneSurrogate(out.truncatedText!);
    });

    // a flag is two regional-indicator code points, so this one needs grapheme segmentation
    it('keeps a flag whole', () => {
      // 7 characters ("🇺🇸", "🇺🇸", " ", f, l, a, g): floor((100/200)*7)-1 = 2
      const out = truncateSVGText(el(200), 100, ELLIPSIS, { text: '🇺🇸🇺🇸 flag' });
      expect(out.truncatedText).toBe('🇺🇸🇺🇸');
      noLoneSurrogate(out.truncatedText!);
    });

    it('keeps a combining mark with its base character', () => {
      const acuteE = 'e\u0301';
      const out = truncateSVGText(el(120), 60, ELLIPSIS, { text: acuteE.repeat(3) });
      // a whole number of base+mark pairs, so nothing is left holding a dangling accent
      expect(out.truncatedText!.split(acuteE).join('')).toBe('');
    });
  });
});

describe('updateTruncation', () => {
  it('seeds single truncation data and skips measuring when there is no dom element', () => {
    const { checkTruncation, truncationData } = updateTruncation(ELLIPSIS, null, 'Hello', 100, null);
    expect(checkTruncation).toBe(false);
    expect(truncationData).toEqual({ text: 'Hello' });
  });

  it('measures and truncates a single element that overflows', () => {
    const { checkTruncation, truncationData } = updateTruncation(ELLIPSIS, null, 'Hello World', 100, el(200));
    expect(checkTruncation).toBe(true);
    expect(truncationData).toEqual({ text: 'Hello World', truncatedText: 'Hell', lastText: 'Hel' });
  });

  // Regression: the single path pushed a settled first pass through setState while the array path did not
  it('asks for no further check when a first pass already fits, single or array', () => {
    const single = updateTruncation(ELLIPSIS, null, 'Hello', 100, el(50));
    expect(single.checkTruncation).toBe(false);
    expect(single.truncationData).toEqual({ text: 'Hello', truncatedText: 'Hello', lastText: 'Hello' });
    const array = updateTruncation(ELLIPSIS, null, ['ab', 'cd'], 100, [el(50), el(50)]);
    expect(array.checkTruncation).toBe(false);
  });

  it('seeds and measures an array of elements', () => {
    const { truncationData } = updateTruncation(ELLIPSIS, null, ['ab', 'cd'], 100, [el(50), el(50)]);
    expect(Array.isArray(truncationData)).toBe(true);
    expect(truncationData).toHaveLength(2);
  });
});
