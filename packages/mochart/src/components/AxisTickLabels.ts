import { Renderer, svgEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { layoutInfoExtentChanged } from '../layout/LayoutInfo';
import { getTruncatedText, TruncationTracker, TruncationTooltip } from '../utils/TextTruncation';
import { SCALE_ORDINAL } from '../config/core/constants';
import { getMinorTickLabel } from '../config/core/minorConfig';
import { translate } from '../utils/utils';
import { getClipPathReference } from '../utils/svgUtils';
import { getAxisFocusStyle } from '../utils/FocusValue';
import { styleToAttributes } from '../utils/style';
import { fontStylesEqual, resolveFontStyle } from '../utils/font';
import Background from './Background';
import { getPassTicks } from './AxisLines';
import type { PassTick } from './AxisLines';
import type { El, TextEl } from '../render';
import type { MinorTickLabel } from '../config/core/minorConfig';
import type { AxisConfigBase, AxisTickLabelConfig, CategoryAxisConfig, CategoryAxisTickLabelConfig, FontConfig, TickLabelTruncationConfig } from '../types/config';
import type { FontInlineStyle } from '../utils/font';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisTick } from '../types/data';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';
import type { FocusPercentage } from '../types/animation';
import type { TruncationDataValue, TruncationState } from '../utils/TextTruncation';
import type { Anchor } from '../config/core/constants';

const emptyArray: string[] = [];
const emptyNumbers: number[] = [];
const emptyPassTicks: PassTick[] = [];
const hiddenStyle = { visibility: 'hidden' };

type AxisDisplayConfig = Omit<AxisConfigBase, 'tickLabel'> &
  Pick<CategoryAxisConfig, 'scale'> &
  { tickLabel: AxisTickLabelConfig & Partial<Pick<CategoryAxisTickLabelConfig, 'truncation' | 'minorTruncation'>> } &
  Partial<Pick<EnhancedValueAxisConfig, 'useSeriesFocus'>>;

interface AxisTickLabelsProps {
  front: boolean;
  axisConfig: AxisDisplayConfig;
  axisLayoutInfo: AxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  axisTicks: AxisTick[];
  tickSpacing: number | null;
  minorTickSpacing: number | null;
  tickLabelClipPathUniqueId?: string;
  minorTickLabelClipPathUniqueId?: string;
  axisFocusPercentage: FocusPercentage;
  seriesFocusPercentage: FocusPercentage;
  accessibility: boolean;
  chartFont: FontConfig;
}
type AxisTickLabelsState = TruncationState;
type SizeLabelEl = El & { textHandle: El; valueHandle: TextEl };
interface TickLabelHandle { root: El; text: El; value: TextEl; tooltip: TruncationTooltip }

/** The kinds of label a pass draws: those visible in the config and drawn in front or behind like the pass. */
function getPasses(props: AxisTickLabelsProps): { majorPass: boolean; minorPass: boolean; minorTickLabel: MinorTickLabel } {
  const { front, axisConfig } = props;
  const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
  return {
    majorPass: front === axisConfig.tickLabel.front && axisConfig.tickLabel.visible,
    minorPass: front === minorTickLabel.front && minorTickLabel.visible,
    minorTickLabel
  };
}

function labelsChanged(oldLabels: string[], newLabels: string[]): boolean {
  if (oldLabels.length !== newLabels.length) {
    return true;
  }
  for (let i = 0; i < newLabels.length; i++) {
    if (oldLabels[i] !== newLabels[i]) {
      return true;
    }
  }
  return false;
}

/** The room a kind of label truncates to: its share of the axis when parallel, else a fraction of the plot. */
function getTruncationLength(truncation: TickLabelTruncationConfig | undefined, parallel: boolean, tickSpacing: number | null, vertical: boolean, plotLayoutInfo: SpacingLayoutInfo): number {
  if (truncation === undefined || !truncation.enabled) {
    return Infinity;
  }
  if (parallel) {
    return tickSpacing ?? 0;
  }
  return Math.max(truncation.minLength, truncation.maxFraction * (vertical ? plotLayoutInfo.width : plotLayoutInfo.height));
}

export default class AxisTickLabels extends Renderer<AxisTickLabelsProps, AxisTickLabelsState> {
  root = svgEl('g');
  background = this.slot(this.root);
  minorBackground = this.slot(this.root);
  tickLabelsGroup = svgEl('g');
  tickLabels = this.elList<PassTick, TickLabelHandle>(this.tickLabelsGroup);
  sizeTickLabel = this.elSlot(this.tickLabelsGroup);
  minorSizeTickLabel = this.elSlot(this.tickLabelsGroup);
  truncation = new TruncationTracker();
  // rebuilt only when the ticks or the pass change; sync runs every focus-tween frame
  passTicks = emptyPassTicks;
  tickLabelStrings = emptyArray;
  truncationTexts: string | string[] = emptyArray;
  truncationLengths: number | number[] = emptyNumbers;
  truncatedLabels = emptyArray;
  truncatedLabelsSource: { labels: string[]; texts: string | string[]; data: TruncationDataValue } | null = null;
  tickTextStyle: Record<string, unknown> | null = null;
  hiddenTickTextStyle: Record<string, unknown> | null = null;
  sizeTickTextStyle: Record<string, unknown> | null = null;
  tickTextFontStyle: FontInlineStyle | null | undefined = undefined;
  minorTickTextStyle: Record<string, unknown> | null = null;
  hiddenMinorTickTextStyle: Record<string, unknown> | null = null;
  minorSizeTickTextStyle: Record<string, unknown> | null = null;
  minorTickTextFontStyle: FontInlineStyle | null | undefined = undefined;

  constructor() {
    super();
    this.state = { truncationData: null };
  }

  derive(props: AxisTickLabelsProps, _state: AxisTickLabelsState, prevProps: AxisTickLabelsProps | null): Partial<AxisTickLabelsState> | null {
    const { majorPass, minorPass, minorTickLabel } = getPasses(props);
    const { axisConfig, axisLayoutInfo, plotLayoutInfo, axisTicks, tickSpacing, minorTickSpacing } = props;
    const majorTruncation = majorPass ? axisConfig.tickLabel.truncation : undefined;
    const minorTruncation = minorPass ? minorTickLabel.truncation : undefined;
    const truncationEnabled = majorTruncation?.enabled === true || minorTruncation?.enabled === true;
    const previousLabels = this.tickLabelStrings;
    if (prevProps === null || axisTicks !== prevProps.axisTicks || axisConfig !== prevProps.axisConfig || props.front !== prevProps.front) {
      this.passTicks = getPassTicks(axisTicks, majorPass, minorPass);
      this.tickLabelStrings = this.passTicks.map(({ tick }) => String(tick.label));
      // each kind truncates with its own text; one text serves when only one kind is drawn
      this.truncationTexts = majorPass && minorPass && this.passTicks.some(({ tick }) => tick.minor === true)
        ? this.passTicks.map(({ tick }) => (tick.minor === true ? minorTruncation?.text : majorTruncation?.text) ?? '')
        : (minorPass && !majorPass ? minorTruncation?.text : majorTruncation?.text) ?? '';
    }
    if (truncationEnabled) {
      const { vertical } = axisLayoutInfo;
      const majorLength = getTruncationLength(majorTruncation, axisLayoutInfo.tickLabelParallel, tickSpacing, vertical, plotLayoutInfo);
      const minorLength = getTruncationLength(minorTruncation, axisLayoutInfo.minorTickLabelParallel, minorTickSpacing, vertical, plotLayoutInfo);
      this.truncationLengths = majorLength === minorLength ? majorLength : this.passTicks.map(({ tick }) => tick.minor === true ? minorLength : majorLength);
    }
    if (prevProps === null) {
      return this.truncation.mount(truncationEnabled);
    }

    let truncationChanged = false;
    let truncationReset = false;
    let dataIntact = true;
    if (truncationEnabled) {
      const sizeChanged = layoutInfoExtentChanged(prevProps.axisLayoutInfo, axisLayoutInfo) ||
        layoutInfoExtentChanged(prevProps.plotLayoutInfo, plotLayoutInfo) ||
        axisLayoutInfo.totalTitleSize !== prevProps.axisLayoutInfo.totalTitleSize || axisLayoutInfo.totalTickLabelSize !== prevProps.axisLayoutInfo.totalTickLabelSize ||
        axisLayoutInfo.totalMinorTickLabelSize !== prevProps.axisLayoutInfo.totalMinorTickLabelSize ||
        axisLayoutInfo.tickLabelParallel !== prevProps.axisLayoutInfo.tickLabelParallel || axisLayoutInfo.minorTickLabelParallel !== prevProps.axisLayoutInfo.minorTickLabelParallel ||
        tickSpacing !== prevProps.tickSpacing || minorTickSpacing !== prevProps.minorTickSpacing;
      // a fitted prefix belongs to the font it was measured in and to the text that replaced its tail: either changing starts over from the full label
      if (axisConfig !== prevProps.axisConfig || props.chartFont !== prevProps.chartFont) {
        const { minorTickLabel: prevMinorTickLabel } = getPasses(prevProps);
        truncationReset = majorTruncation?.text !== prevProps.axisConfig.tickLabel.truncation?.text ||
          minorTruncation?.text !== prevMinorTickLabel.truncation?.text ||
          !fontStylesEqual(resolveFontStyle(axisConfig.tickLabel.font, props.chartFont), resolveFontStyle(prevProps.axisConfig.tickLabel.font, prevProps.chartFont)) ||
          !fontStylesEqual(resolveFontStyle(minorTickLabel.font, props.chartFont), resolveFontStyle(prevMinorTickLabel.font, prevProps.chartFont));
      }
      truncationChanged = sizeChanged || truncationReset || (previousLabels !== this.tickLabelStrings && labelsChanged(previousLabels, this.tickLabelStrings));
      dataIntact = Array.isArray(this.truncation.data) && this.passTicks.length === this.truncation.data.length;
    }
    return this.truncation.prepare(truncationEnabled, truncationChanged, truncationReset, dataIntact,
      truncationChanged ? this.tickLabelStrings : undefined);
  }

  getTruncatedLabels(truncationEnabled: boolean, truncationData: TruncationDataValue): string[] {
    const labels = this.tickLabelStrings;
    if (!truncationEnabled || truncationData === null) {
      return labels;
    }
    const source = this.truncatedLabelsSource;
    const texts = this.truncationTexts;
    if (source === null || source.labels !== labels || source.texts !== texts || source.data !== truncationData) {
      this.truncatedLabels = getTruncatedText(true, texts, labels, truncationData);
      this.truncatedLabelsSource = { labels, texts, data: truncationData };
    }
    return this.truncatedLabels;
  }

  // stable style objects let El.set skip the style diff for every unchanged tick
  updateTickTextStyles(tickLabelAnchor: Anchor, fontStyle: FontInlineStyle | null, minorTickLabelAnchor: Anchor, minorFontStyle: FontInlineStyle | null): void {
    if (this.tickTextStyle === null || this.tickTextStyle.textAnchor !== tickLabelAnchor || this.tickTextFontStyle !== fontStyle) {
      this.tickTextFontStyle = fontStyle;
      this.tickTextStyle = { textAnchor: tickLabelAnchor, ...fontStyle };
      this.hiddenTickTextStyle = { textAnchor: tickLabelAnchor, visibility: hiddenStyle.visibility, ...fontStyle };
      this.sizeTickTextStyle = { ...hiddenStyle, ...fontStyle };
    }
    if (this.minorTickTextStyle === null || this.minorTickTextStyle.textAnchor !== minorTickLabelAnchor || this.minorTickTextFontStyle !== minorFontStyle) {
      this.minorTickTextFontStyle = minorFontStyle;
      this.minorTickTextStyle = { textAnchor: minorTickLabelAnchor, ...minorFontStyle };
      this.hiddenMinorTickTextStyle = { textAnchor: minorTickLabelAnchor, visibility: hiddenStyle.visibility, ...minorFontStyle };
      this.minorSizeTickTextStyle = { ...hiddenStyle, ...minorFontStyle };
    }
  }

  create() {
    this.root.append(this.tickLabelsGroup);
    return this.root.node;
  }

  syncSizeLabel(slot: typeof this.sizeTickLabel, present: boolean, className: string, style: Record<string, unknown> | null, truncationText: string, accessibility: boolean): void {
    if (!present) {
      slot.set(null);
      return;
    }
    const sizeLabel = slot.set('size-label', () => {
      const group = svgEl('g') as SizeLabelEl;
      const text = svgEl('text');
      const value = textEl();
      text.append(value);
      group.append(text);
      group.textHandle = text;
      group.valueHandle = value;
      return group;
    }) as SizeLabelEl;
    // a width probe, not a label: its text is nonsense to read out
    sizeLabel.set({ className, ariaHidden: accessibility ? 'true' : null });
    sizeLabel.textHandle.set({ style });
    sizeLabel.valueHandle.set('W' + truncationText);
  }

  sync() {
    const { axisConfig, axisLayoutInfo, tickLabelClipPathUniqueId, minorTickLabelClipPathUniqueId, axisFocusPercentage, seriesFocusPercentage, accessibility, chartFont } = this.props;
    const { truncationData } = this.state;
    const { majorPass, minorPass, minorTickLabel } = getPasses(this.props);
    const { vertical, tickLabelAnchor, tickTextX, tickTextY, minorTickLabelAnchor, minorTickTextX, minorTickTextY } = axisLayoutInfo;

    this.updateTickTextStyles(tickLabelAnchor, resolveFontStyle(axisConfig.tickLabel.font, chartFont), minorTickLabelAnchor, resolveFontStyle(minorTickLabel.font, chartFont));
    const tickTextStyle = this.tickTextStyle!;
    const hiddenTickTextStyle = this.hiddenTickTextStyle!;
    const minorTickTextStyle = this.minorTickTextStyle!;
    const hiddenMinorTickTextStyle = this.hiddenMinorTickTextStyle!;

    const tickTextDY = '0.35em';

    let tickX = 0;
    let tickY = 0;

    const { rotation: tickLabelRotation } = axisConfig.tickLabel;
    const tickRotationTransform = tickLabelRotation === 0 ? null : 'rotate(' + tickLabelRotation + ')';
    const minorTickRotationTransform = minorTickLabel.rotation === 0 ? null : 'rotate(' + minorTickLabel.rotation + ')';

    const majorTruncation = majorPass ? axisConfig.tickLabel.truncation : undefined;
    const minorTruncation = minorPass ? minorTickLabel.truncation : undefined;
    const truncationEnabled = majorTruncation?.enabled === true || minorTruncation?.enabled === true;
    const useSeriesFocus = axisConfig.useSeriesFocus ?? false;
    const tickLabels = this.getTruncatedLabels(truncationEnabled, truncationData);

    // each kind clips to its own rect: the other kind's may not exist, and its rotation and anchor differ
    const clipPath = majorTruncation?.enabled === true && tickLabelClipPathUniqueId ? getClipPathReference(tickLabelClipPathUniqueId) : null;
    const minorClipPath = minorTruncation?.enabled === true && minorTickLabelClipPathUniqueId ? getClipPathReference(minorTickLabelClipPathUniqueId) : null;

    // destructured rather than spread whole: this attribute order is what the golden snapshots record
    const { stroke, strokeOpacity, strokeWidth, fill, fillOpacity } = styleToAttributes(
      getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, axisConfig.tickLabel.textStyle));
    const minorAttributes = styleToAttributes(getAxisFocusStyle(axisFocusPercentage, seriesFocusPercentage, useSeriesFocus, minorTickLabel.textStyle));

    this.root.set({ className: mochartCssClasses['axisTickLabels'] });
    this.background.set(majorPass ? Background : null, { config: axisConfig.tickLabel, classKey: 'axisTickLabelBackground', spacingRelative: false, spacingLayoutInfo: axisLayoutInfo.tickLabelLayoutInfo });
    // the minor labels' own box, only once there is a minor label to put in it
    const minorPresent = minorPass && this.passTicks.some(({ tick }) => tick.minor === true);
    this.minorBackground.set(minorPresent ? Background : null, { config: minorTickLabel, classKey: 'axisMinorTickLabelBackground', spacingRelative: false, spacingLayoutInfo: axisLayoutInfo.minorTickLabelLayoutInfo });

    this.tickLabels.sync(this.passTicks, {
      key: (passTick) => 'tick-label-' + passTick.index,
      create: () => {
        const root = svgEl('g');
        const text = svgEl('text');
        const value = textEl();
        text.append(value);
        root.append(text);
        return { root, text, value, tooltip: new TruncationTooltip() };
      },
      update: (handle, { tick, index }, i) => {
        const minor = tick.minor === true;
        if (vertical) {
          tickY = tick.position;
        }
        else {
          tickX = tick.position;
        }
        handle.root.set({ className: minor ? mochartCssClasses['axisTickLabel'] + index + ' ' + mochartCssClasses['axisMinorTickLabel'] : mochartCssClasses['axisTickLabel'] + index,
          transform: translate(tickX + (minor ? minorTickTextX : tickTextX), tickY + (minor ? minorTickTextY : tickTextY)), clipPath: minor ? minorClipPath : clipPath });
        // an overlap-suppressed label is not read, and a truncated one is read in full
        const fullLabel = this.tickLabelStrings[i];
        const attributes = minor ? minorAttributes : { stroke, strokeOpacity, fill, fillOpacity, strokeWidth };
        handle.text.set({ style: tick.hidden ? (minor ? hiddenMinorTickTextStyle : hiddenTickTextStyle) : (minor ? minorTickTextStyle : tickTextStyle), dy: tickTextDY,
          transform: minor ? minorTickRotationTransform : tickRotationTransform,
          stroke: attributes.stroke, strokeOpacity: attributes.strokeOpacity, fill: attributes.fill, fillOpacity: attributes.fillOpacity, strokeWidth: attributes.strokeWidth,
          ariaHidden: accessibility && tick.hidden ? 'true' : null,
          ariaLabel: accessibility && !tick.hidden && tickLabels[i] !== fullLabel ? fullLabel : null });
        handle.value.set(tickLabels[i]);
        const tooltipEnabled = (minor ? minorTruncation : majorTruncation)?.tooltipEnabled ?? false;
        handle.tooltip.sync(handle.text, tooltipEnabled && !tick.hidden, fullLabel, tickLabels[i]);
      }
    });

    const ordinal = axisConfig.scale === SCALE_ORDINAL;
    this.syncSizeLabel(this.sizeTickLabel, ordinal && majorTruncation?.enabled === true, mochartCssClasses['axisSizeTickLabel'], this.sizeTickTextStyle, majorTruncation?.text ?? '', accessibility);
    this.syncSizeLabel(this.minorSizeTickLabel, ordinal && minorPresent && minorTruncation?.enabled === true, mochartCssClasses['axisMinorSizeTickLabel'], this.minorSizeTickTextStyle, minorTruncation?.text ?? '', accessibility);
  }

  measure(prevProps: AxisTickLabelsProps | null) {
    if (prevProps === null) {
      // truncation is only rechecked after updates; the initial sync renders untruncated
      return;
    }
    if (this.truncation.check) {
      const domElements = this.tickLabelsGroup.node.querySelectorAll<SVGTextContentElement>(getAxisTickLabelsCssSelector());
      // the labels only seed fresh truncation data; an existing entry set is refined in place
      const axisTickLabels = this.state.truncationData === null ? this.tickLabelStrings : emptyArray;
      this.truncation.update(this, this.truncationTexts, axisTickLabels, this.truncationLengths, domElements);
    }
  }
}

function getAxisTickLabelsCssSelector() {
  return '.' + mochartCssClasses['axisTickLabel'].split(' ')[0] + ' text';
}
