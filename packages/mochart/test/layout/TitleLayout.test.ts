import { describe, expect, it } from 'vitest';
import { getTitleHeight, getTitleLayoutInfo } from '../../src/layout/TitleLayout';
import type { MarginPadding, TextBounds } from '../../src/types/geometry';
import type { TitleAffixConfig, TitleConfig } from '../../src/types/config';
import type { EnhancedMochartConfig } from '../../src/types/enhanced';
import type { ChartTextBoundsData, LayoutInfo } from '../../src/types/layout';

const zero: MarginPadding = { top: 0, right: 0, bottom: 0, left: 0 };
const box = (top: number, right: number, bottom: number, left: number): MarginPadding => ({ top, right, bottom, left });

const baseTitle: TitleConfig = {
  text: 'Title',
  prefix: {
    text: null,
    // prefix outer width 24, outer height = text height
    margin: box(0, 2, 0, 2),
    padding: zero
  },
  suffix: {
    text: null,
    // suffix outer width +2, outer height +2
    margin: zero,
    padding: box(1, 1, 1, 1)
  },
  alignedToAxes: false,
  align: 'left',
  verticalAlign: 'top',
  verticalExpand: false,
  // spacingWidth 20 (left 10, right 10), spacingHeight 6 (top 3, bottom 3)
  margin: box(2, 4, 2, 4),
  padding: box(1, 6, 1, 6),
  // textSpacingWidth 10, textSpacingHeight 6
  textMargin: box(0, 5, 0, 5),
  textPadding: box(3, 0, 3, 0)
} as TitleConfig;

const bounds = (width: number, height: number, extra: Partial<TextBounds> = {}): TextBounds => ({ width, height, ...extra });

const baseText: ChartTextBoundsData = {
  titleTextBounds: bounds(100, 20),
  titleTextRawBounds: bounds(100, 20),
  titlePrefixBounds: bounds(20, 10),
  titleSuffixBounds: bounds(30, 40)
} as ChartTextBoundsData;

// overrides merge the prefix / suffix groups one level deep, so a caller can set just the text or just a margin
type TitleOverrides = Partial<Omit<TitleConfig, 'prefix' | 'suffix'>> & { prefix?: Partial<TitleAffixConfig>; suffix?: Partial<TitleAffixConfig> };
const withTitle = (title: TitleOverrides): TitleConfig => ({
  ...baseTitle, ...title,
  prefix: { ...baseTitle.prefix, ...title.prefix },
  suffix: { ...baseTitle.suffix, ...title.suffix }
});
const config = (title: TitleOverrides = {}): EnhancedMochartConfig => ({ title: withTitle(title) }) as unknown as EnhancedMochartConfig;
const text = (overrides: Partial<ChartTextBoundsData> = {}): ChartTextBoundsData => ({ ...baseText, ...overrides });

const content = { x: 10, y: 0, width: 400, height: 300 };
const series = { x: 60, y: 40, width: 300, height: 200 } as LayoutInfo;

const rect = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => ({ x, y, width, height });

function layout(title: TitleOverrides = {}, textData: ChartTextBoundsData = baseText, contentBounds = content, seriesLayoutInfo = series, titleY = 0) {
  const mochartConfig = config(title);
  const titleHeight = getTitleHeight(mochartConfig, textData);
  return getTitleLayoutInfo(mochartConfig, textData, contentBounds, seriesLayoutInfo, titleHeight, titleY);
}

describe('getTitleHeight', () => {
  it('is zero without title text', () => {
    expect(getTitleHeight(config({ text: null }), baseText)).toBe(0);
  });

  it('adds the text and title spacing to the measured text height', () => {
    // 20 + text spacing 6 + title spacing 6
    expect(getTitleHeight(config(), baseText)).toBe(32);
  });

  it('takes the tallest of text, prefix and suffix', () => {
    // suffix 40 + 2 padding = 42, plus title spacing 6
    expect(getTitleHeight(config({ prefix: { text: 'A' }, suffix: { text: 'Z' } }), baseText)).toBe(48);
    expect(getTitleHeight(config({ prefix: { text: 'A' } }), baseText)).toBe(32);
    // a tall prefix wins when present
    expect(getTitleHeight(config({ prefix: { text: 'A' } }), text({ titlePrefixBounds: bounds(20, 50) }))).toBe(56);
  });

  it('ignores prefix and suffix bounds when they are not configured', () => {
    expect(getTitleHeight(config(), text({ titlePrefixBounds: bounds(20, 90), titleSuffixBounds: bounds(20, 90) }))).toBe(32);
  });
});

describe('getTitleLayoutInfo width branches', () => {
  it('lays out a title that fits the content bounds and centers it once the spacing is counted once', () => {
    // Regression for 67599100: the text spacing was added to the title width twice and the
    // centre offset came out 15px too far left (130 instead of 145).
    const { titleLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo, titlePrefixLayoutInfo, titleSuffixLayoutInfo } = layout({ align: 'center' });
    // outer width = spacing 20 + text 100 + text spacing 10 = 130; extra 270 / 2 = 135
    expect(rect(titleLayoutInfo)).toEqual({ x: 145, y: 0, width: 130, height: 32 });
    expect(titleLayoutInfo.marginBounds).toEqual({ x: 149, y: 2, width: 122, height: 28 });
    expect(titleLayoutInfo.paddingBounds).toEqual({ x: 155, y: 3, width: 110, height: 26 });
    expect(titleLayoutInfo.default).toBeFalsy();
    // text sits after the title spacing, offset relative to the title box
    expect(rect(titleTextLayoutInfo)).toEqual({ x: 10, y: 0, width: 110, height: 26 });
    expect(titleTextLayoutInfo.paddingBounds).toEqual({ x: 15, y: 3, width: 100, height: 20 });
    expect(rect(titleTextRawLayoutInfo)).toEqual(rect(titleTextLayoutInfo));
    expect(rect(titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 0, height: 0 });
    expect(rect(titleSuffixLayoutInfo)).toEqual({ x: 120, y: 0, width: 0, height: 0 });
  });

  it('aligns left and right within the content bounds', () => {
    expect(rect(layout({ align: 'left' }).titleLayoutInfo)).toEqual({ x: 10, y: 0, width: 130, height: 32 });
    expect(rect(layout({ align: 'right' }).titleLayoutInfo)).toEqual({ x: 280, y: 0, width: 130, height: 32 });
  });

  it('places the title at titleY', () => {
    const { titleLayoutInfo, titleTextLayoutInfo } = layout({}, baseText, content, series, 250);
    expect(titleLayoutInfo.y).toBe(250);
    expect(titleTextLayoutInfo.y).toBe(0);
  });

  it('aligns to the plot area when alignedToAxes and the title fits it', () => {
    // Regression for 67599100: the title spacing was subtracted from the plot width a second
    // time, pushing a right-aligned title 20px left of the plot's right edge.
    expect(rect(layout({ alignedToAxes: true, align: 'right' }).titleLayoutInfo)).toEqual({ x: 230, y: 0, width: 130, height: 32 });
    expect(rect(layout({ alignedToAxes: true, align: 'center' }).titleLayoutInfo)).toEqual({ x: 145, y: 0, width: 130, height: 32 });
    expect(rect(layout({ alignedToAxes: true, align: 'left' }).titleLayoutInfo)).toEqual({ x: 60, y: 0, width: 130, height: 32 });
  });

  it('falls back to the content bounds when the title is wider than the plot area', () => {
    const narrowSeries = { ...series, width: 100 } as LayoutInfo;
    expect(rect(layout({ alignedToAxes: true, align: 'center' }, baseText, content, narrowSeries).titleLayoutInfo)).toEqual({ x: 145, y: 0, width: 130, height: 32 });
  });

  it('truncates the text width when the title is wider than the content', () => {
    const narrow = { ...content, width: 120 };
    const { titleLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo } = layout({ align: 'center' }, baseText, narrow);
    // text width = content 120 - spacing 20; alignment is ignored
    expect(rect(titleLayoutInfo)).toEqual({ x: 10, y: 0, width: 120, height: 32 });
    expect(rect(titleTextLayoutInfo)).toEqual({ x: 10, y: 0, width: 100, height: 26 });
    // the raw layout keeps the untruncated width
    expect(rect(titleTextRawLayoutInfo)).toEqual({ x: 10, y: 0, width: 110, height: 26 });
  });

  it('truncates around the prefix and suffix', () => {
    const narrow = { ...content, width: 150 };
    const { titleLayoutInfo, titlePrefixLayoutInfo, titleTextLayoutInfo, titleSuffixLayoutInfo } = layout({ prefix: { text: 'A' }, suffix: { text: 'Z' } }, baseText, narrow);
    // text width = content 150 - spacing 20 - prefix 24 - suffix 32 = 74
    expect(rect(titleLayoutInfo)).toEqual({ x: 10, y: 0, width: 150, height: 48 });
    expect(rect(titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 24, height: 10 });
    expect(rect(titleTextLayoutInfo)).toEqual({ x: 34, y: 0, width: 74, height: 26 });
    expect(rect(titleSuffixLayoutInfo)).toEqual({ x: 108, y: 0, width: 32, height: 42 });
  });

  it('collapses the text when even the spacing does not fit', () => {
    const tiny = { ...content, width: 25 };
    const { titleLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo } = layout({ align: 'right' }, baseText, tiny);
    // title spacing 20 + text spacing 10 > 25: no text, title spans the margin width
    expect(rect(titleLayoutInfo)).toEqual({ x: 10, y: 0, width: 5, height: 32 });
    expect(rect(titleTextLayoutInfo)).toEqual({ x: 10, y: 0, width: 0, height: 26 });
    expect(rect(titleTextRawLayoutInfo)).toEqual({ x: 10, y: 0, width: 0, height: 26 });
  });

  it('places the prefix, text and suffix side by side', () => {
    const { titleLayoutInfo, titlePrefixLayoutInfo, titleTextLayoutInfo, titleSuffixLayoutInfo } = layout({ prefix: { text: 'A' }, suffix: { text: 'Z' } });
    // 20 + 24 + 110 + 32
    expect(rect(titleLayoutInfo)).toEqual({ x: 10, y: 0, width: 186, height: 48 });
    expect(rect(titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 24, height: 10 });
    expect(rect(titleTextLayoutInfo)).toEqual({ x: 34, y: 0, width: 110, height: 26 });
    expect(rect(titleSuffixLayoutInfo)).toEqual({ x: 144, y: 0, width: 32, height: 42 });
  });

  it('flags placeholder text bounds on the title layout', () => {
    expect(layout({}, text({ titleTextBounds: bounds(100, 20, { default: true }) })).titleLayoutInfo.default).toBe(true);
    expect(layout({}, text({ titleSuffixBounds: bounds(30, 40, { default: true }) })).titleLayoutInfo.default).toBe(true);
  });

  it('gives no width to the prefix and suffix without title text', () => {
    const { titleLayoutInfo, titlePrefixLayoutInfo, titleSuffixLayoutInfo } = layout({ text: null, prefix: { text: 'A' }, suffix: { text: 'Z' } });
    expect(titleLayoutInfo.height).toBe(0);
    expect(titlePrefixLayoutInfo.width).toBe(0);
    expect(titleSuffixLayoutInfo.width).toBe(0);
  });
});

describe('getTitleLayoutInfo vertical placement', () => {
  const titled: TitleOverrides = { prefix: { text: 'A' }, suffix: { text: 'Z' } };

  it('keeps every part at the top by default', () => {
    const { titlePrefixLayoutInfo, titleTextLayoutInfo, titleSuffixLayoutInfo } = layout(titled);
    expect(titlePrefixLayoutInfo.y).toBe(0);
    expect(titleTextLayoutInfo.y).toBe(0);
    expect(titleSuffixLayoutInfo.y).toBe(0);
  });

  it('offsets shorter parts to the middle or bottom of the tallest one', () => {
    // inner title height 42: prefix 10 has 32 spare, text 26 has 16 spare, suffix is the tallest
    const middle = layout({ ...titled, verticalAlign: 'middle' });
    expect(middle.titlePrefixLayoutInfo.y).toBe(16);
    expect(middle.titleTextLayoutInfo.y).toBe(8);
    expect(middle.titleTextRawLayoutInfo.y).toBe(8);
    expect(middle.titleSuffixLayoutInfo.y).toBe(0);
    expect(middle.titlePrefixLayoutInfo.height).toBe(10);

    const bottom = layout({ ...titled, verticalAlign: 'bottom' });
    expect(bottom.titlePrefixLayoutInfo.y).toBe(32);
    expect(bottom.titleTextLayoutInfo.y).toBe(16);
    expect(bottom.titleSuffixLayoutInfo.y).toBe(0);
  });

  it('does not offset a part that has been given no width', () => {
    const tiny = { ...content, width: 25 };
    expect(layout({ ...titled, verticalAlign: 'bottom' }, baseText, tiny).titleTextLayoutInfo.y).toBe(0);
  });

  it('expands shorter parts to the tallest padding height, growing the padding on the far side', () => {
    const top = layout({ ...titled, verticalExpand: true });
    // prefix grows 32 below its content, text grows 16 below its content
    expect(rect(top.titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 24, height: 42 });
    expect(top.titlePrefixLayoutInfo.paddingBounds).toEqual({ x: 12, y: 0, width: 20, height: 10 });
    expect(rect(top.titleTextLayoutInfo)).toEqual({ x: 34, y: 0, width: 110, height: 42 });
    expect(top.titleTextLayoutInfo.paddingBounds).toEqual({ x: 39, y: 3, width: 100, height: 20 });
    expect(rect(top.titleSuffixLayoutInfo)).toEqual({ x: 144, y: 0, width: 32, height: 42 });
    expect(top.titleSuffixLayoutInfo.paddingBounds).toEqual({ x: 145, y: 1, width: 30, height: 40 });

    const middle = layout({ ...titled, verticalAlign: 'middle', verticalExpand: true });
    expect(rect(middle.titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 24, height: 42 });
    expect(middle.titlePrefixLayoutInfo.paddingBounds).toEqual({ x: 12, y: 16, width: 20, height: 10 });
    expect(middle.titleTextLayoutInfo.paddingBounds).toEqual({ x: 39, y: 11, width: 100, height: 20 });

    const bottom = layout({ ...titled, verticalAlign: 'bottom', verticalExpand: true });
    expect(rect(bottom.titlePrefixLayoutInfo)).toEqual({ x: 10, y: 0, width: 24, height: 42 });
    expect(bottom.titlePrefixLayoutInfo.paddingBounds).toEqual({ x: 12, y: 32, width: 20, height: 10 });
    expect(bottom.titleTextLayoutInfo.paddingBounds).toEqual({ x: 39, y: 19, width: 100, height: 20 });
  });

  it('caps the expansion at the spare height when margins differ', () => {
    // prefix margin adds 4 of vertical space its padding-only expansion does not know about
    const { titlePrefixLayoutInfo } = layout({ ...titled, verticalExpand: true, prefix: { text: 'A', margin: box(2, 2, 2, 2) } });
    // outer prefix height 14 → 28 spare, but padding-based expansion asks for 32
    expect(titlePrefixLayoutInfo.height).toBe(42);
    expect(titlePrefixLayoutInfo.paddingBounds).toEqual({ x: 12, y: 2, width: 20, height: 10 });
  });
});
