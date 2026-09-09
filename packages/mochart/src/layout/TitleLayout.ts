import { NONE, ALIGN_LEFT, ALIGN_CENTER, VERTICAL_ALIGN_TOP, VERTICAL_ALIGN_MIDDLE } from '../config/core/constants';
import type { VerticalAlign } from '../config/core/constants';
import { getSpacingWidth, getSpacingOuterWidth, getSpacingOuterHeight, getSpacingHeight, getMaxSpacingHeight } from './SpacingLayoutInfo';
import { createSpacingLayoutInfo, getSpacingLeft } from './SpacingLayoutInfo';
import type { MarginPadding, Bounds } from '../types/geometry';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ChartTextBoundsData, LayoutInfo, SpacingLayoutInfo, TitleLayoutResult } from '../types/layout';

function createTitleLayoutInfo(x: number, y: number, width: number, height: number, margin: MarginPadding, padding: MarginPadding, titleHeight: number, titleMargin: MarginPadding, titlePadding: MarginPadding, verticalAlign: VerticalAlign, expand: number): SpacingLayoutInfo {
  const titleSpacingHeight = titleHeight - getSpacingHeight(titleMargin, titlePadding);
  let textY = 0;
  if (width > 0 && height < titleSpacingHeight) {
    const extraHeight = titleSpacingHeight - height;
    if (expand > 0) {
      const expansion = Math.min(extraHeight, expand);
      height+= expansion;
      if (verticalAlign === VERTICAL_ALIGN_TOP) {
        padding = {...padding, bottom: padding.bottom + expansion};
      }
      else if (verticalAlign === VERTICAL_ALIGN_MIDDLE) {
        const halfExpansion = expansion / 2.0;
        padding = { ...padding, top: padding.top + halfExpansion, bottom: padding.bottom + halfExpansion };
      }
      else {
        padding = { ...padding, top: padding.top + expansion };
      }
    }
    else if (verticalAlign !== VERTICAL_ALIGN_TOP) {
      textY = verticalAlign === VERTICAL_ALIGN_MIDDLE ? (extraHeight / 2.0) : extraHeight;
    }
  }
  return createSpacingLayoutInfo({ x, y: y + textY, width, height}, margin, padding);
}

export function getTitleHeight(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData): number {
  const { title: titleConfig } = mochartConfig;
  const { titleTextRawBounds, titlePrefixBounds, titleSuffixBounds } = chartTextBoundsData;
  let titleHeight = 0;
  if (titleConfig.text !== NONE) {
    const { margin, padding, textMargin, textPadding } = titleConfig;
    const { text: prefix, margin: prefixMargin, padding: prefixPadding } = titleConfig.prefix;
    const { text: suffix, margin: suffixMargin, padding: suffixPadding } = titleConfig.suffix;

    titleHeight = getSpacingOuterHeight(titleTextRawBounds, textMargin, textPadding);
    if (prefix !== NONE) {
      titleHeight = getMaxSpacingHeight(titleHeight, titlePrefixBounds, prefixMargin, prefixPadding);
    }
    if (suffix !== NONE) {
      titleHeight = getMaxSpacingHeight(titleHeight, titleSuffixBounds, suffixMargin, suffixPadding);
    }
    titleHeight += getSpacingHeight(margin, padding);
  }
  return titleHeight;
}

export function getTitleLayoutInfo(mochartConfig: EnhancedMochartConfig, chartTextBoundsData: ChartTextBoundsData, contentBounds: Bounds, seriesLayoutInfo: LayoutInfo, titleHeight: number, titleY: number): TitleLayoutResult {
  const { title: titleConfig } = mochartConfig;
  const { text: title, alignedToAxes, align, verticalAlign, verticalExpand, margin, padding, textMargin, textPadding } = titleConfig;
  const { text: titlePrefix, margin: prefixMargin, padding: prefixPadding } = titleConfig.prefix;
  const { text: titleSuffix, margin: suffixMargin, padding: suffixPadding } = titleConfig.suffix;
  const spacingLeft = getSpacingLeft(margin, padding);
  const { titlePrefixBounds, titleTextBounds, titleTextRawBounds, titleSuffixBounds } = chartTextBoundsData;
  const hasDefaultBounds = titlePrefixBounds.default || titleTextBounds.default || titleTextRawBounds.default || titleSuffixBounds.default;
  const { x, width } = contentBounds;
  const hasTitle = title !== NONE;
  const hasPrefix = hasTitle && titlePrefix !== NONE;
  const hasSuffix = hasTitle && titleSuffix !== NONE

  const spacingWidth = hasTitle ? getSpacingWidth(margin, padding) : 0;
  const prefixWidth = hasPrefix ? getSpacingOuterWidth(titlePrefixBounds, prefixMargin, prefixPadding) : 0;
  const suffixWidth = hasSuffix ? getSpacingOuterWidth(titleSuffixBounds, suffixMargin, suffixPadding) : 0;
  const textSpacingWidth = getSpacingWidth(textMargin, textPadding);
  const fixedWidth = prefixWidth + suffixWidth;
  const marginWidth = width - spacingWidth;

  let textExpand = 0;
  let prefixExpand = 0;
  let suffixExpand = 0;
  if (verticalExpand) {
    const textPaddingHeight = hasTitle ? getSpacingOuterHeight(titleTextRawBounds, textPadding) : 0;
    const prefixPaddingHeight = hasPrefix ? getSpacingOuterHeight(titlePrefixBounds, prefixPadding) : 0;
    const suffixPaddingHeight = hasSuffix ? getSpacingOuterHeight(titleSuffixBounds, suffixPadding) : 0;
    const paddingHeight = Math.max(textPaddingHeight, prefixPaddingHeight, suffixPaddingHeight);
    textExpand = paddingHeight - textPaddingHeight;
    prefixExpand = paddingHeight - prefixPaddingHeight;
    suffixExpand = paddingHeight - suffixPaddingHeight;
  }

  const textHeight = hasTitle ? getSpacingOuterHeight(titleTextRawBounds, textMargin, textPadding) : 0;
  const prefixHeight = hasPrefix ? getSpacingOuterHeight(titlePrefixBounds, prefixMargin, prefixPadding) : 0;
  const suffixHeight = hasSuffix ? getSpacingOuterHeight(titleSuffixBounds, suffixMargin, suffixPadding) : 0;

  let textRawWidth = titleTextRawBounds.width + textSpacingWidth;
  let textWidth = titleTextBounds.width + textSpacingWidth;

  let titleOffset = x;
  let titleWidth = marginWidth;

  if (fixedWidth + spacingWidth + textSpacingWidth > width) {
    textWidth = 0;
    textRawWidth = 0;
  }
  else {
    // textRawWidth already carries the text margin/padding; this is the title's full outer width
    const textAllWidth = fixedWidth + spacingWidth + textRawWidth;
    const alignToAxes = alignedToAxes && textAllWidth <= seriesLayoutInfo.width;
    if (alignToAxes || textAllWidth <= width) {
      const { x: availableX, width: availableWidth } = alignToAxes ? seriesLayoutInfo : contentBounds;
      titleOffset = availableX;
      if (align !== ALIGN_LEFT) {
        const extraWidth = availableWidth - textAllWidth;
        titleOffset = Math.floor(availableX + (align === ALIGN_CENTER ? (extraWidth / 2.0) : extraWidth));
      }
      textWidth = textRawWidth;
      titleWidth = textAllWidth;
    }
    else {
      textWidth = Math.min(marginWidth - fixedWidth, textRawWidth);
      titleWidth = fixedWidth + spacingWidth + textWidth;
    }
  }

  return {
    titleLayoutInfo: createSpacingLayoutInfo({ x: titleOffset, y: titleY, width: titleWidth, height: titleHeight, default: hasDefaultBounds}, margin, padding),
    titlePrefixLayoutInfo: createTitleLayoutInfo(spacingLeft, 0, prefixWidth, prefixHeight, prefixMargin, prefixPadding, titleHeight, margin, padding, verticalAlign, prefixExpand),
    titleTextLayoutInfo: createTitleLayoutInfo(spacingLeft + prefixWidth, 0, textWidth, textHeight, textMargin, textPadding, titleHeight, margin, padding, verticalAlign, textExpand),
    titleTextRawLayoutInfo: createTitleLayoutInfo(spacingLeft + prefixWidth, 0, textRawWidth, textHeight, textMargin, textPadding, titleHeight, margin, padding, verticalAlign, textExpand),
    titleSuffixLayoutInfo: createTitleLayoutInfo(spacingLeft + prefixWidth + textWidth, 0, suffixWidth, suffixHeight, suffixMargin, suffixPadding, titleHeight, margin, padding, verticalAlign, suffixExpand)
  }
}
