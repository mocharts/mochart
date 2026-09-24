import { Renderer, svgEl, textEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo.js';
import { getTruncatedText, TruncationTracker, TruncationTooltip } from '../utils/TextTruncation.js';
import { getClipPathReference } from '../utils/svgUtils.js';
import { getAxisFocusStyle } from '../utils/FocusValue.js';
import { styleToAttributes } from '../utils/style.js';
import { fontStylesEqual, resolveFontStyle } from '../utils/font.js';
import { NONE } from '../config/core/constants.js';
import Background from './Background.js';
import type { AxisConfigBase, FontConfig } from '../types/config.js';
import type { EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { AxisLayoutInfo } from '../types/layout.js';
import type { FocusPercentage } from '../types/animation.js';
import type { TruncationState } from '../utils/TextTruncation.js';

type AxisTitleConfig = AxisConfigBase & Partial<Pick<EnhancedValueAxisConfig, 'useSeriesFocus'>>;

interface AxisTitleProps {
  fontsVersion: number;
  axisConfig: AxisTitleConfig;
  axisLayoutInfo: AxisLayoutInfo;
  titleClipPathUniqueId: string;
  axisFocusPercentage: FocusPercentage;
  seriesFocusPercentage: FocusPercentage;
  ariaHidden: boolean;
  chartFont: FontConfig;
}
type AxisTitleState = TruncationState;

export default class AxisTitle extends Renderer<AxisTitleProps, AxisTitleState> {
  root = svgEl('g');
  background = this.slot(this.root);
  text = svgEl('text');
  textValue = textEl();
  truncation = new TruncationTracker();
  tooltip = new TruncationTooltip();

  constructor() {
    super();
    this.state = { truncationData: null };
  }

  derive(props: AxisTitleProps, _state: AxisTitleState, prevProps: AxisTitleProps | null): Partial<AxisTitleState> | null {
    if (prevProps === null) {
      return this.truncation.mount(props.axisConfig.title.truncation.enabled);
    }
    const { axisConfig, axisLayoutInfo, chartFont } = props;
    const { title: titleConfig } = axisConfig;
    const { title: prevTitleConfig } = prevProps.axisConfig;
    const truncationEnabled = titleConfig.text !== NONE && titleConfig.truncation.enabled;
    const truncationChanged = truncationEnabled && layoutInfoExtentChanged(prevProps.axisLayoutInfo, axisLayoutInfo);
    // a fitted prefix belongs to the font it was measured in and to the text that replaced its tail: either changing starts over
    const truncationReset = props.fontsVersion !== prevProps.fontsVersion ||
      prevTitleConfig.text !== titleConfig.text || prevTitleConfig.truncation.text !== titleConfig.truncation.text ||
      !fontStylesEqual(resolveFontStyle(titleConfig.font, chartFont), resolveFontStyle(prevTitleConfig.font, prevProps.chartFont));
    return this.truncation.prepare(truncationEnabled, truncationChanged, truncationReset);
  }

  create() {
    this.text.append(this.textValue);
    this.root.append(this.text);
    return this.root.node;
  }

  sync() {
    const { axisConfig } = this.props;
    if (axisConfig.title.text !== NONE) {
      const { axisLayoutInfo, titleClipPathUniqueId, axisFocusPercentage, seriesFocusPercentage, chartFont } = this.props;
      const { truncationData } = this.state;
      const title = getTruncatedText(axisConfig.title.truncation.enabled, axisConfig.title.truncation.text, axisConfig.title.text!, truncationData);

      const titleTextDY = '0.35em'; // more or less centers the text vertically http://stackoverflow.com/questions/12250403/vertical-alignment-of-text-element-in-svg
      const titleTextAnchor = 'middle';
      const { titleTextX, titleTextY, titleTextAngle } = axisLayoutInfo;
      const titleTextTransform = 'translate(' + Math.floor(titleTextX) + ',' + Math.floor(titleTextY) + ') rotate(' + titleTextAngle + ')';

      const clipPath = axisConfig.title.truncation.enabled ? getClipPathReference(titleClipPathUniqueId) : null;

      const useSeriesFocus = axisConfig.useSeriesFocus ?? false;
      // destructured rather than spread whole: this attribute order is what the golden snapshots record
      const { stroke, strokeOpacity, strokeWidth, fill, fillOpacity } = styleToAttributes(
        getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, axisConfig.title.textStyle));

      this.setPresent(true);
      // hidden when the sibling tick labels are grouped: this same string, untruncated, is that group's name
      this.root.set({ className: mochartCssClasses['axisTitle'], clipPath,
        ariaHidden: this.props.ariaHidden ? 'true' : null });
      this.background.set(Background, { config: axisConfig.title, classKey: 'axisTitleBackground', spacingRelative: false, spacingLayoutInfo: axisLayoutInfo.titleLayoutInfo });
      this.text.set({ transform: titleTextTransform, textAnchor: titleTextAnchor, dy: titleTextDY,
        stroke, strokeOpacity,
        fill, fillOpacity, strokeWidth, style: resolveFontStyle(axisConfig.title.font, chartFont) });
      this.textValue.set(title);
      this.tooltip.sync(this.text, axisConfig.title.truncation.tooltipEnabled, axisConfig.title.text!, title);
    }
    else {
      this.setPresent(false);
    }
  }

  measure(prevProps: AxisTitleProps | null) {
    if (prevProps === null) {
      // truncation is only rechecked after updates; the initial sync renders untruncated
      return;
    }
    if (this.truncation.check && this.present) {
      const domElement = this.root.node.querySelector<SVGTextContentElement>(getAxisTitleCssSelector());
      const { axisConfig, axisLayoutInfo } = this.props;
      const maxLength = axisLayoutInfo.vertical ? axisLayoutInfo.height : axisLayoutInfo.width;
      const { text: title, truncation: { text: titleTruncationText } } = axisConfig.title;
      this.truncation.update(this, titleTruncationText, title!, maxLength, domElement);
    }
  }
}

function getAxisTitleCssSelector() {
  return 'text';
}
