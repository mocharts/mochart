import { Renderer, svgEl } from '../render';

import AxisBackground from './AxisBackground';
import AxisLine from './AxisLine';
import AxisTitle from './AxisTitle';
import AxisTickMarks from './AxisTickMarks';
import AxisTickLabels from './AxisTickLabels';
import AxisFocusTickMarks from './AxisFocusTickMarks';
import AxisFocusRange from './AxisFocusRange';

import { translateObject } from '../utils/utils';
import type { CategoryAxisConfig } from '../types/config';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisTick } from '../types/data';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface AxisProps {
  front: boolean;
  axisConfig: CategoryAxisConfig | EnhancedValueAxisConfig;
  axisLayoutInfo: AxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  axisClass: string;
  axisTicks: AxisTick[];
  axisFocusPercentage?: number | null;
  seriesFocusPercentage?: number | null;
  focusPercentages: number[];
  tickSpacing?: number | null;
  titleClipPathUniqueId: string;
  tickLabelClipPathUniqueId?: string;
  onPointerEnter?: ((event: Event) => void) | null;
  onPointerLeave?: (() => void) | null;
  onClick?: (() => void) | null;
  accessibility: boolean;
  accessibleLabel: string;
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
      focusPercentages, tickSpacing, titleClipPathUniqueId, tickLabelClipPathUniqueId,
      onPointerEnter, onPointerLeave, onClick, accessibility, accessibleLabel } = this.props;
    if (axisConfig.visible) {
      const { backgroundFront } = axisConfig;
      const axisLineFront = axisConfig.axisLine.front, focusRangeFront = axisConfig.focusRange.front, focusTickMarkFront = axisConfig.focusTickMark.front,
        tickLabelFront = axisConfig.tickLabel.front, tickMarkFront = axisConfig.tickMark.front, titleFront = axisConfig.title.front;

      // the front and back passes split one axis in two; only the half that draws tick labels is a named group
      const namedGroup = front === tickLabelFront && axisTicks.length > 0;

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

      if (front !== tickMarkFront) {
        this.tickMarksSlot.set(null);
      }
      else {
        this.tickMarksSlot.set(AxisTickMarks, { axisConfig, axisLayoutInfo, axisTicks, axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null });
      }

      if (front !== tickLabelFront) {
        this.tickLabelsSlot.set(null);
      }
      else {
        this.tickLabelsSlot.set(AxisTickLabels, { axisLayoutInfo, plotLayoutInfo,
          axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null,
          axisConfig, axisTicks,
          tickSpacing: tickSpacing ?? null, tickLabelClipPathUniqueId, accessibility });
      }

      if (front !== titleFront) {
        this.titleSlot.set(null);
      }
      else {
        // the named group (in whichever half) already reads the title, so the drawn title stays hidden even when it draws in the other half
        this.titleSlot.set(AxisTitle, { axisConfig, axisLayoutInfo, titleClipPathUniqueId, axisFocusPercentage: axisFocusPercentage ?? null, seriesFocusPercentage: seriesFocusPercentage ?? null, ariaHidden: accessibility && axisTicks.length > 0 });
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
