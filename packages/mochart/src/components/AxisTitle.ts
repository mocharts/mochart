import { Renderer, svgEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo';
import { getTruncatedText, TruncationTracker, TruncationTooltip } from '../utils/TextTruncation';
import { getClipPathReference } from '../utils/svgUtils';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { NONE } from '../config/core/constants';
import Background from './Background';
import type { AxisConfigBase } from '../types/config';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisLayoutInfo } from '../types/layout';
import type { FocusPercentage } from '../types/animation';
import type { TruncationState } from '../utils/TextTruncation';

type AxisTitleConfig = AxisConfigBase & Partial<Pick<EnhancedValueAxisConfig, 'useSeriesFocus'>>;

interface AxisTitleProps {
  axisConfig: AxisTitleConfig;
  axisLayoutInfo: AxisLayoutInfo;
  titleClipPathUniqueId: string;
  axisFocusPercentage: FocusPercentage;
  seriesFocusPercentage: FocusPercentage;
  ariaHidden: boolean;
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
    const { axisConfig, axisLayoutInfo } = props;
    const truncationEnabled = axisConfig.title.text !== NONE && axisConfig.title.truncation.enabled;
    const truncationChanged = truncationEnabled && layoutInfoExtentChanged(prevProps.axisLayoutInfo, axisLayoutInfo);
    return this.truncation.prepare(truncationEnabled, truncationChanged, prevProps.axisConfig.title.text !== axisConfig.title.text);
  }

  create() {
    this.text.append(this.textValue);
    this.root.append(this.text);
    return this.root.node;
  }

  sync() {
    const { axisConfig } = this.props;
    if (axisConfig.title.text !== NONE) {
      const { axisLayoutInfo, titleClipPathUniqueId, axisFocusPercentage, seriesFocusPercentage } = this.props;
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
        fill, fillOpacity, strokeWidth });
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
