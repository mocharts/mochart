import { Renderer, svgEl, textEl, Slot } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo.js';
import { getTruncatedText, TruncationTracker, TruncationTooltip } from '../utils/TextTruncation.js';
import { NONE } from '../config/core/constants.js';
import { onClickDisabled, centerTextY, translate, translateObject } from '../utils/utils.js';
import { getClipPathReference } from '../utils/svgUtils.js';
import { styleToAttributes } from '../utils/style.js';
import { resolveFontStyle } from '../utils/font.js';
import { getSpacingWidth } from '../layout/SpacingLayoutInfo.js';
import Background from './Background.js';
import type { El, TextEl } from '../render/index.js';
import type { Style } from '../types/config.js';
import type { FontInlineStyle } from '../utils/font.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';
import type { SpacingLayoutInfo } from '../types/layout.js';
import type { TruncationState } from '../utils/TextTruncation.js';

type TitleSectionKey = 'titlePrefix' | 'titleText' | 'titleTextRaw' | 'titleSuffix';
type TitleBackgroundKey = 'titlePrefixBackground' | 'titleTextBackground' | 'titleSuffixBackground';
interface TitleSection {
  root: El;
  backgroundSlot: Slot;
  clipGroup: El;
  text: El;
  value: TextEl;
}
interface TitleProps {
  mochartConfig: EnhancedMochartConfig;
  titleLayoutInfo: SpacingLayoutInfo;
  titlePrefixLayoutInfo: SpacingLayoutInfo;
  titleTextLayoutInfo: SpacingLayoutInfo;
  titleTextRawLayoutInfo: SpacingLayoutInfo;
  titleSuffixLayoutInfo: SpacingLayoutInfo;
  titleClipPathUniqueId: string;
  accessibility: boolean;
  onClick?: () => void;
}
type TitleState = TruncationState;

function titleFits(titleLayoutInfo: SpacingLayoutInfo, titleTextLayoutInfo: SpacingLayoutInfo, titleTextRawLayoutInfo: SpacingLayoutInfo): boolean {
  return titleTextLayoutInfo.width === titleTextRawLayoutInfo.width && titleLayoutInfo.default !== true;
}

export default class Title extends Renderer<TitleProps, TitleState> {
  root = svgEl('g');
  background = this.slot(this.root);
  wrapper = this.elSlot(this.root);
  truncation = new TruncationTracker();
  tooltip = new TruncationTooltip();
  sections: Partial<Record<TitleSectionKey, TitleSection>> = {};

  constructor() {
    super();
    this.state = { truncationData: null };
    this.sections = {};
  }

  chartTitleClick = () => {
    const { onClick } = this.props;
    if (onClick) {
      onClick();
    }
  }

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.chartTitleClick();
    }
  }

  derive(props: TitleProps, _state: TitleState, prevProps: TitleProps | null): Partial<TitleState> | null {
    if (prevProps === null) {
      return this.truncation.mount(props.mochartConfig.title.truncation.enabled);
    }
    const { mochartConfig, titleLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo } = props;
    const { title: titleConfig } = mochartConfig;
    const truncationEnabled = titleConfig.text !== NONE && titleConfig.truncation.enabled;
    const truncationChanged = truncationEnabled &&
      (layoutInfoExtentChanged(prevProps.titleTextLayoutInfo, titleTextLayoutInfo) || layoutInfoExtentChanged(prevProps.titleTextRawLayoutInfo, titleTextRawLayoutInfo));
    // the raw extent covers a font change; the truncation text replaced the prefix's tail, so a new one starts over
    const titleChanged = prevProps.mochartConfig.title.text !== titleConfig.text || prevProps.mochartConfig.title.truncation.text !== titleConfig.truncation.text;
    // reset only on settling, not on every update while settled: each reset re-arms a forced-layout measure
    const truncationFinished = titleFits(titleLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo) &&
      !titleFits(prevProps.titleLayoutInfo, prevProps.titleTextLayoutInfo, prevProps.titleTextRawLayoutInfo);
    return this.truncation.prepare(truncationEnabled, truncationChanged, titleChanged || truncationFinished);
  }

  create() {
    return this.root.node;
  }

  /** One prefix/text/raw/suffix block: g[style] > [Background?, g[clipPath] > text]. Built once, reused. */
  getSection(titleKey: TitleSectionKey): TitleSection {
    let section = this.sections[titleKey];
    if (section === undefined) {
      const root = svgEl('g');
      const backgroundSlot = new Slot(root.node, null);
      const clipGroup = svgEl('g');
      const text = svgEl('text');
      const value = textEl();
      text.append(value);
      clipGroup.append(text);
      root.append(clipGroup);
      section = this.sections[titleKey] = { root, backgroundSlot, clipGroup, text, value };
    }
    return section;
  }

  syncSection(wrapperEl: El, titleKey: TitleSectionKey, titleBackgroundKey: TitleBackgroundKey, titleValue: string | null, titleSectionLayoutInfo: SpacingLayoutInfo, backgroundStyle: Style, textStyle: Style, font: FontInlineStyle | null, visible: boolean, clipPath: string | null = null, ariaHidden = false): void {
    if (titleValue) {
      const section = this.getSection(titleKey);
      const { paddingBounds } = titleSectionLayoutInfo;
      const { dy, transform } = centerTextY(paddingBounds);

      const containerStyle = visible ? null : { visibility: 'hidden' };

      section.root.set({ style: containerStyle });
      if (visible) {
        section.backgroundSlot.set(Background, { config: { backgroundStyle }, classKey: titleBackgroundKey, spacingRelative: false, spacingLayoutInfo: titleSectionLayoutInfo });
      }
      else {
        section.backgroundSlot.set(null);
      }
      section.clipGroup.set({ clipPath });
      section.text.set({ ...styleToAttributes(textStyle), className: mochartCssClasses[titleKey], dy, transform,
        ariaHidden: ariaHidden ? 'true' : null, style: font });
      section.value.set(titleValue);
      wrapperEl.node.appendChild(section.root.node);
    }
    else {
      const section = this.sections[titleKey];
      if (section !== undefined && section.root.node.parentNode) {
        section.root.node.parentNode.removeChild(section.root.node);
      }
    }
  }

  sync() {
    const { mochartConfig, titleLayoutInfo, titlePrefixLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo, titleSuffixLayoutInfo, titleClipPathUniqueId, accessibility, onClick } = this.props;
    const { title: titleConfig } = mochartConfig;

    if (titleConfig.text !== NONE) {
      const { text: title, prefix, suffix, truncation, link, linkDisabled,
        textBackgroundStyle: titleBackgroundStyle, textStyle: titleTextStyle
      } = titleConfig;
      const { enabled: truncationEnabled, text: truncationText, tooltipEnabled: truncationTooltipEnabled } = truncation;
      const { text: titlePrefix, backgroundStyle: prefixBackgroundStyle, textStyle: prefixTextStyle } = prefix;
      const { text: titleSuffix, backgroundStyle: suffixBackgroundStyle, textStyle: suffixTextStyle } = suffix;
      const chartFont = mochartConfig.chart.font;
      const titleFont = resolveFontStyle(titleConfig.font, chartFont);
      const prefixFont = resolveFontStyle(prefix.font, chartFont);
      const suffixFont = resolveFontStyle(suffix.font, chartFont);

      const { truncationData } = this.state;
      const titleText = getTruncatedText(truncationEnabled, truncationText, title, truncationData);

      const titleTransform = translateObject(titleLayoutInfo);
      const { paddingRelativeBounds } = titleLayoutInfo;
      const titleSpacingTransform = translate(0, paddingRelativeBounds.y);

      const clipPath = truncationEnabled ? getClipPathReference(titleClipPathUniqueId) : null;

      this.setPresent(true);
      // a clickable title is a control, so it needs button semantics; a linked title already has them
      const interactive = accessibility && onClick !== undefined && !link;
      this.root.set({ className: mochartCssClasses['title'], transform: titleTransform,
        onClick: onClick !== undefined ? this.chartTitleClick : null,
        tabindex: interactive ? '0' : null,
        role: interactive ? 'button' : null,
        ariaLabel: interactive ? [titlePrefix, title, titleSuffix].filter(Boolean).join(' ') : null,
        onKeyDown: interactive ? this.onKeyDown : null,
        // the click works whatever accessibility says, so the cursor says so too
        cursor: onClick !== undefined && !link ? 'pointer' : null });
      this.background.set(Background, { config: titleConfig, classKey: 'titleBackground', spacingRelative: true, spacingLayoutInfo: titleLayoutInfo });

      let wrapperEl: El;
      if (link) {
        const onLinkClick = linkDisabled ? onClickDisabled : null;
        wrapperEl = this.wrapper.set('a', () => svgEl('a'))!;
        // an svg <a href> is natively focusable, so a decorative chart has to opt it out by hand
        wrapperEl.set({ href: link, onClick: onLinkClick, transform: titleSpacingTransform,
          tabindex: mochartConfig.accessibility.hidden ? '-1' : null });
      }
      else {
        wrapperEl = this.wrapper.set('g', () => svgEl('g'))!;
        wrapperEl.set({ transform: titleSpacingTransform });
      }

      // (re-)append in order; appendChild moves already-attached nodes
      this.syncSection(wrapperEl, 'titlePrefix', 'titlePrefixBackground',
        titlePrefix, titlePrefixLayoutInfo, prefixBackgroundStyle, prefixTextStyle, prefixFont, true);
      // the svg is already named from the full title text, so the drawn copy would read twice in a row;
      // a linked title keeps its text readable because that text is the link's name
      this.syncSection(wrapperEl, 'titleText', 'titleTextBackground',
        titleText, titleTextLayoutInfo, titleBackgroundStyle, titleTextStyle, titleFont, true, clipPath, accessibility && !link);
      this.syncSection(wrapperEl, 'titleTextRaw', 'titleTextBackground',
        title, titleTextRawLayoutInfo, titleBackgroundStyle, titleTextStyle, titleFont, false);
      this.syncSection(wrapperEl, 'titleSuffix', 'titleSuffixBackground',
        titleSuffix, titleSuffixLayoutInfo, suffixBackgroundStyle, suffixTextStyle, suffixFont, true);
      const textSection = this.sections.titleText;
      if (textSection !== undefined) {
        this.tooltip.sync(textSection.text, truncationTooltipEnabled, title, titleText);
      }
    }
    else {
      this.setPresent(false);
    }
  }

  measure() {
    this.refreshTruncation();
  }

  refreshTruncation() {
    if (this.truncation.check && this.present) {
      const domElement = this.root.node.querySelector<SVGTextContentElement>(getTitleTextCssSelector());
      const { mochartConfig, titleTextLayoutInfo } = this.props;
      const { title: titleConfig } = mochartConfig;
      const { width } = titleTextLayoutInfo;
      const { text: title, truncation: { text: truncationText }, textMargin, textPadding } = titleConfig;
      const maxLength = Math.max(width - getSpacingWidth(textMargin, textPadding), 0);
      this.truncation.update(this, truncationText, title!, maxLength, domElement);
    }
  }

  destroy(removeDom = true) {
    for (const titleKey of Object.keys(this.sections) as TitleSectionKey[]) {
      this.sections[titleKey]!.backgroundSlot.destroy(false);
    }
    super.destroy(removeDom);
  }
}

function getTitleTextCssSelector() {
  return '.' + mochartCssClasses['titleText'];
}
