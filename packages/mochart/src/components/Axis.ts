import { Renderer, svgEl } from '../render/index.js';

import AxisBackground from './AxisBackground.js';
import AxisLine from './AxisLine.js';
import AxisTitle from './AxisTitle.js';
import AxisTickMarks from './AxisTickMarks.js';
import AxisTickLabels from './AxisTickLabels.js';
import AxisFocusTickMarks from './AxisFocusTickMarks.js';
import AxisFocusRange from './AxisFocusRange.js';

import { translateObject } from '../utils/utils.js';
import { getMinorTickLabel, getMinorTickMark } from '../config/core/minorConfig.js';
import type { CategoryAxisConfig, FontConfig } from '../types/config.js';
import type { EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { AxisTick } from '../types/data.js';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout.js';

interface AxisProps {
  front: boolean;
  /** Bumped when a web font finishes loading: the fitted tick labels and title belong to the font they were measured in. */
  fontsVersion: number;
  axisConfig: CategoryAxisConfig | EnhancedValueAxisConfig;
  axisLayoutInfo: AxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  axisClass: string;
  axisTicks: AxisTick[];
  axisFocusPercentage?: number | null;
  seriesFocusPercentage?: number | null;
  focusPercentages: number[];
  tickSpacing?: number | null;
  minorTickSpacing?: number | null;
  titleClipPathUniqueId: string;
  tickLabelClipPathUniqueId?: string;
  minorTickLabelClipPathUniqueId?: string;
  onPointerEnter?: ((event: Event) => void) | null;
  onPointerLeave?: (() => void) | null;
  onClick?: (() => void) | null;
  accessibility: boolean;
  accessibleLabel: string;
  chartFont: FontConfig;
}

export default class Axis extends Renderer<AxisProps> {
  root = svgEl('g');
  inner = svgEl('g');
  backgroundSlot = this.slot(this.inner);
  lineSlot = this.slot(this.inner);
  focusRangeSlot = this.slot(this.inner);
  tickMarksSlot = this.slot(this.inner);
  tickLabelsSlot = this.slot(this.inner);
  titleSlot = this.slot(this.inner);
  focusTickMarksSlot = this.slot(this.inner);

  create() {
    this.root.append(this.inner);
    return this.root.node;
  }

  sync() {
    const { front, axisConfig, axisLayoutInfo, plotLayoutInfo, axisClass, axisTicks, axisFocusPercentage, seriesFocusPercentage,
      focusPercentages, tickSpacing, minorTickSpacing, titleClipPathUniqueId, tickLabelClipPathUniqueId, minorTickLabelClipPathUniqueId,
      onPointerEnter, onPointerLeave, onClick, accessibility, accessibleLabel, chartFont } = this.props;
    if (axisConfig.visible) {
      const { backgroundFront } = axisConfig;
      const axisLineFront = axisConfig.axisLine.front, focusRangeFront = axisConfig.focusRange.front, focusTickMarkFront = axisConfig.focusTickMark.front,
        tickLabelFront = axisConfig.tickLabel.front, tickMarkFront = axisConfig.tickMark.front, titleFront = axisConfig.title.front;
      const minorTickLabel = getMinorTickLabel(axisConfig.tickLabel);
      const minorTickMark = getMinorTickMark(axisConfig.tickMark);
      // a pass draws the labels or marks of either kind that are visible and drawn in it
      const tickLabelsInPass = (front === tickLabelFront && axisConfig.tickLabel.visible) || (front === minorTickLabel.front && minorTickLabel.visible);
      const tickMarksInPass = (front === tickMarkFront && axisConfig.tickMark.visible) || (front === minorTickMark.front && minorTickMark.visible);

      // the front and back passes split one axis in two; only the half that draws tick labels is a named group, and
      // an axis drawing none has no group (hidden major labels hide the minor ones too, so that is the major half)
      const labelFront = axisConfig.tickLabel.visible && axisTicks.length > 0 ? tickLabelFront : null;
      const namedGroup = labelFront === front;

      this.setPresent(true);
      this.root.set({ className: axisClass,
        role: accessibility && namedGroup ? 'group' : null,
        ariaLabel: accessibility && namedGroup ? accessibleLabel : null });
      this.inner.set({ transform: translateObject(axisLayoutInfo), onPointerEnter, onPointerLeave, onClick });

      if (front !== backgroundFront) {
        this.backgroundSlot.set(null);
      }
      else {
        this.backgroundSlot.set(AxisBackground, { axisConfig, axisLayoutInfo });
      }

      if (front !== axisLineFront) {
        this.lineSlot.set(null);
      }
      else {
        this.lineSlot.set(AxisLine, { axisConfig, axisLayoutInfo, axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null });
      }

      if (front !== focusRangeFront) {
        this.focusRangeSlot.set(null);
      }
      else {
        this.focusRangeSlot.set(AxisFocusRange, { axisConfig, axisLayoutInfo, focusPercentages });
      }

      if (!tickMarksInPass) {
        this.tickMarksSlot.set(null);
      }
      else {
        this.tickMarksSlot.set(AxisTickMarks, { front, axisConfig, axisLayoutInfo, axisTicks, axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null });
      }

      if (!tickLabelsInPass) {
        this.tickLabelsSlot.set(null);
      }
      else {
        this.tickLabelsSlot.set(AxisTickLabels, { front, fontsVersion: this.props.fontsVersion, axisLayoutInfo, plotLayoutInfo,
          axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null,
          axisConfig, axisTicks,
          tickSpacing: tickSpacing ?? null, minorTickSpacing: minorTickSpacing ?? null, tickLabelClipPathUniqueId, minorTickLabelClipPathUniqueId, accessibility, chartFont });
      }

      if (front !== titleFront) {
        this.titleSlot.set(null);
      }
      else {
        // the named group (in whichever half) already reads the title, so the drawn title stays hidden even when it draws in the other half
        this.titleSlot.set(AxisTitle, { fontsVersion: this.props.fontsVersion, axisConfig, axisLayoutInfo, titleClipPathUniqueId, axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null, ariaHidden: accessibility && labelFront !== null, chartFont });
      }

      if (front !== focusTickMarkFront) {
        this.focusTickMarksSlot.set(null);
      }
      else {
        this.focusTickMarksSlot.set(AxisFocusTickMarks, { axisConfig, axisLayoutInfo, focusPercentages });
      }
    }
    else {
      this.setPresent(false);
    }
  }
}
