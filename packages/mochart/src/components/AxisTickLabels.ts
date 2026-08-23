import { Renderer, svgEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo';
import { getTruncatedText, TruncationTracker } from '../utils/TextTruncation';
import { SCALE_ORDINAL } from '../config/core/constants';
import { translate } from '../utils/utils';
import { getClipPathReference } from '../utils/svgUtils';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import Background from './Background';
import type { El, TextEl } from '../render';
import type { AxisConfigBase, AxisTickLabelConfig, CategoryAxisConfig, CategoryAxisTickLabelConfig } from '../types/config';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisTick } from '../types/data';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';
import type { FocusPercentage } from '../types/animation';
import type { TruncationDataValue, TruncationState } from '../utils/TextTruncation';
import type { Anchor } from '../config/core/constants';

const emptyArray: string[] = [];
const hiddenStyle = { visibility: 'hidden' };

type AxisDisplayConfig = Omit<AxisConfigBase, 'tickLabel'> &
  Pick<CategoryAxisConfig, 'scale'> &
  { tickLabel: AxisTickLabelConfig & Partial<Pick<CategoryAxisTickLabelConfig, 'truncationEnabled' | 'truncationText' | 'truncationMinLength' | 'truncationMaxFraction'>> } &
  Partial<Pick<EnhancedValueAxisConfig, 'useSeriesFocus'>>;

interface AxisTickLabelsProps {
  axisConfig: AxisDisplayConfig;
  axisLayoutInfo: AxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  axisTicks: AxisTick[];
  tickSpacing: number | null;
  tickLabelClipPathUniqueId?: string;
  axisFocusPercentage: FocusPercentage;
  seriesFocusPercentage: FocusPercentage;
  accessibility: boolean;
}
type AxisTickLabelsState = TruncationState;
type SizeLabelEl = El & { textHandle: El; valueHandle: TextEl };
interface TickLabelHandle { root: El; text: El; value: TextEl }

function getTruncationChanged(sizeChanged: boolean, ticksChanged: boolean, oldProps: AxisTickLabelsProps, newProps: AxisTickLabelsProps): boolean {
  if (sizeChanged) {
    return true;
  }
  else if (ticksChanged) {
    const { axisTicks: oldTicks } = oldProps;
    const { axisTicks: newTicks } = newProps;
    if (oldTicks.length === newTicks.length) {
      const tickLength = oldTicks.length;
      let i;
      for (i = 0; i < tickLength; i++) {
        if (oldTicks[i].label !== newTicks[i].label) {
          return true;
        }
      }
      return false;
    }
    return true;
  }
  else {
    return false;
  }
}

export default class AxisTickLabels extends Renderer<AxisTickLabelsProps, AxisTickLabelsState> {
  root = svgEl('g');
  background = this.slot(this.root);
  tickLabelsGroup = svgEl('g');
  tickLabels = this.elList<AxisTick, TickLabelHandle>(this.tickLabelsGroup);
  sizeTickLabel = this.elSlot(this.tickLabelsGroup);
  truncation = new TruncationTracker();
  // rebuilt only when the ticks array changes; sync runs every focus-tween frame
  tickLabelStrings = emptyArray;
  truncatedLabels = emptyArray;
  truncatedLabelsSource: { labels: string[]; value: string; data: TruncationDataValue } | null = null;
  tickTextStyle: { textAnchor: Anchor } | null = null;
  hiddenTickTextStyle: { textAnchor: Anchor; visibility: string } | null = null;

  constructor() {
    super();
    this.state = { truncationData: null };
  }

  derive(props: AxisTickLabelsProps, _state: AxisTickLabelsState, prevProps: AxisTickLabelsProps | null): Partial<AxisTickLabelsState> | null {
    if (prevProps === null || props.axisTicks !== prevProps.axisTicks) {
      this.tickLabelStrings = props.axisTicks.map(tick => String(tick.label));
    }
    if (prevProps === null) {
      return this.truncation.mount(props.axisConfig.tickLabel.truncationEnabled ?? false);
    }
    const { axisConfig, axisLayoutInfo, plotLayoutInfo, axisTicks, tickSpacing } = props;

    const truncationEnabled = axisConfig.tickLabel.truncationEnabled ?? false;
    let truncationChanged = false;
    let integrityChanged = true;
    if (truncationEnabled) {
      const sizeChanged = layoutInfoExtentChanged(prevProps.axisLayoutInfo, axisLayoutInfo) ||
        layoutInfoExtentChanged(prevProps.plotLayoutInfo, plotLayoutInfo) ||
        axisLayoutInfo.totalTitleSize !== prevProps.axisLayoutInfo.totalTitleSize || axisLayoutInfo.totalTickLabelSize !== prevProps.axisLayoutInfo.totalTickLabelSize ||
        axisLayoutInfo.tickLabelParallel !== prevProps.axisLayoutInfo.tickLabelParallel ||
        tickSpacing !== prevProps.tickSpacing;
      const ticksChanged = axisTicks !== prevProps.axisTicks;
      truncationChanged = getTruncationChanged(sizeChanged, ticksChanged, prevProps, props);
      const axisTickCount = axisTicks !== null ? axisTicks.length : 0;
      integrityChanged = Array.isArray(this.truncation.data) && axisTickCount === this.truncation.data.length;
    }
    return this.truncation.prepare(truncationEnabled, truncationChanged, false, integrityChanged,
      truncationChanged ? this.tickLabelStrings : undefined);
  }

  getTruncatedLabels(truncationEnabled: boolean, truncationText: string, truncationData: TruncationDataValue): string[] {
    const labels = this.tickLabelStrings;
    if (!truncationEnabled || truncationData === null) {
      return labels;
    }
    const source = this.truncatedLabelsSource;
    if (source === null || source.labels !== labels || source.value !== truncationText || source.data !== truncationData) {
      this.truncatedLabels = getTruncatedText(true, truncationText, labels, truncationData);
      this.truncatedLabelsSource = { labels, value: truncationText, data: truncationData };
    }
    return this.truncatedLabels;
  }

  // stable style objects let El.set skip the style diff for every unchanged tick
  updateTickTextStyles(tickLabelAnchor: Anchor): void {
    if (this.tickTextStyle === null || this.tickTextStyle.textAnchor !== tickLabelAnchor) {
      this.tickTextStyle = { textAnchor: tickLabelAnchor };
      this.hiddenTickTextStyle = { textAnchor: tickLabelAnchor, visibility: hiddenStyle.visibility };
    }
  }

  create() {
    this.root.append(this.tickLabelsGroup);
    return this.root.node;
  }

  sync() {
    const { axisConfig, axisLayoutInfo, axisTicks, tickLabelClipPathUniqueId, axisFocusPercentage, seriesFocusPercentage, accessibility } = this.props;
    const { truncationData } = this.state;
    const { vertical, tickLabelAnchor, tickTextX, tickTextY } = axisLayoutInfo;
    const { rotation: tickLabelRotation } = axisConfig.tickLabel;

    this.updateTickTextStyles(tickLabelAnchor);
    const tickTextStyle = this.tickTextStyle!;
    const hiddenTickTextStyle = this.hiddenTickTextStyle!;

    const tickTextDY = '0.35em';

    let tickX = 0;
    let tickY = 0;

    const tickRotationTransform = tickLabelRotation === 0 ? null : 'rotate(' + tickLabelRotation + ')';

    const truncationEnabled = axisConfig.tickLabel.truncationEnabled ?? false;
    const truncationText = axisConfig.tickLabel.truncationText ?? '';
    const useSeriesFocus = axisConfig.useSeriesFocus ?? false;
    const tickLabels = this.getTruncatedLabels(truncationEnabled, truncationText, truncationData);

    const clipPath = truncationEnabled && tickLabelClipPathUniqueId ? getClipPathReference(tickLabelClipPathUniqueId) : null;

    // destructured rather than spread whole: this attribute order is what the golden snapshots record
    const { stroke, strokeOpacity, strokeWidth, fill, fillOpacity } = styleToAttributes(
      getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, axisConfig.tickLabel.textStyle));

    this.root.set({ className: mochartCssClasses['axisTickLabels'] });
    this.background.set(Background, { config: axisConfig.tickLabel, classKey: 'axisTickLabelBackground', spacingRelative: false, spacingLayoutInfo: axisLayoutInfo.tickLabelLayoutInfo });

    this.tickLabels.sync(axisTicks, {
      key: (_tick, i) => 'tick-label-' + i,
      create: () => {
        const root = svgEl('g');
        const text = svgEl('text');
        const value = textEl();
        text.append(value);
        root.append(text);
        return { root, text, value };
      },
      update: (handle, tick, i) => {
        if (vertical) {
          tickY = tick.position;
        }
        else {
          tickX = tick.position;
        }
        handle.root.set({ className: mochartCssClasses['axisTickLabel'] + i,
          transform: translate(tickX + tickTextX, tickY + tickTextY), clipPath });
        // an overlap-suppressed label is not read, and an ellipsised one is read in full
        const fullLabel = this.tickLabelStrings[i];
        handle.text.set({ style: tick.hidden ? hiddenTickTextStyle : tickTextStyle, dy: tickTextDY, transform: tickRotationTransform,
          stroke, strokeOpacity, fill, fillOpacity, strokeWidth,
          ariaHidden: accessibility && tick.hidden ? 'true' : null,
          ariaLabel: accessibility && !tick.hidden && tickLabels[i] !== fullLabel ? fullLabel : null });
        handle.value.set(tickLabels[i]);
      }
    });

    if (axisConfig.scale === SCALE_ORDINAL && truncationEnabled) {
      const sizeLabel = this.sizeTickLabel.set('size-label', () => {
        const group = svgEl('g') as SizeLabelEl;
        const text = svgEl('text');
        const value = textEl();
        text.append(value);
        group.append(text);
        group.textHandle = text;
        group.valueHandle = value;
        return group;
      });
      const typedSizeLabel = sizeLabel as SizeLabelEl;
      // a width probe, not a label: its text is nonsense to read out
      typedSizeLabel.set({ className: mochartCssClasses['axisSizeTickLabel'],
        ariaHidden: accessibility ? 'true' : null });
      typedSizeLabel.textHandle.set({ style: hiddenStyle });
      typedSizeLabel.valueHandle.set('W' + truncationText);
    }
    else {
      this.sizeTickLabel.set(null);
    }
  }

  measure(prevProps: AxisTickLabelsProps | null) {
    if (prevProps === null) {
      // truncation is only rechecked after updates; the initial sync renders untruncated
      return;
    }
    if (this.truncation.check) {
      const domElements = this.tickLabelsGroup.node.querySelectorAll<SVGTextContentElement>(getAxisTickLabelsCssSelector());

      const { axisLayoutInfo, tickSpacing, axisConfig, plotLayoutInfo } = this.props;
      const { vertical } = axisLayoutInfo;
      const tickLabelTruncationText = axisConfig.tickLabel.truncationText ?? '';
      // the labels only seed fresh truncation data; an existing entry set is refined in place
      const axisTickLabels = this.state.truncationData === null ? this.tickLabelStrings : emptyArray;
      let maxLength = tickSpacing ?? 0;
      if (!axisLayoutInfo.tickLabelParallel) {
        maxLength = Math.max(axisConfig.tickLabel.truncationMinLength ?? 0,
          (axisConfig.tickLabel.truncationMaxFraction ?? 0) * (vertical ? plotLayoutInfo.width : plotLayoutInfo.height));
      }

      this.truncation.update(this, tickLabelTruncationText, axisTickLabels, maxLength, domElements);
    }
  }
}

function getAxisTickLabelsCssSelector() {
  return '.' + mochartCssClasses['axisTickLabel'].split(' ')[0] + ' text';
}
