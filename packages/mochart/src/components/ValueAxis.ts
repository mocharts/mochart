import { Renderer, Slot } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { isHoverPointer } from '../utils/utils';

import Axis from './Axis';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { FontConfig } from '../types/config';
import type { AxisTick, ValueAxisData } from '../types/data';
import type { AxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface ValueAxisFocus { valueAxisId: string | null; pin?: boolean }
interface ValueAxisProps {
  front: boolean;
  valueAxisConfig: EnhancedValueAxisConfig;
  valueAxisLayoutInfo: AxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  focusPercentages: number[];
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
  seriesCount: number;
  valueAxisData: ValueAxisData & { axisTickData: Record<string, AxisTick[]> };
  titleClipPathUniqueId: string;
  focusedValueAxisId: string | null;
  onFocus: (focus: ValueAxisFocus) => void;
  accessibility: boolean;
  accessibleLabel: string;
  chartFont: FontConfig;
}
interface ValueAxisState {
  onValueAxisEnter: (event: Event) => void;
  onValueAxisLeave: () => void;
  onValueAxisClick: () => void;
}

const noOp = () => {};

export default class ValueAxis extends Renderer<ValueAxisProps, ValueAxisState> {
  axis: Slot | null = null;
  // leave mirrors the enter that actually fired: an ignored touch enter must not clear focus set elsewhere
  hoverActive = false;

  constructor() {
    super();
    this.state = { onValueAxisEnter: noOp, onValueAxisLeave: noOp, onValueAxisClick: noOp };
  }

  derive(props: ValueAxisProps, _state: ValueAxisState, prevProps: ValueAxisProps | null): Partial<ValueAxisState> | null {
    if (prevProps === null) {
      return this.buildEventListeners(props);
    }
    const { valueAxisConfig, onFocus } = props;
    if (valueAxisConfig !== prevProps.valueAxisConfig || onFocus !== prevProps.onFocus) {
      return this.buildEventListeners(props);
    }
    return null;
  }

  buildEventListeners(props: ValueAxisProps): ValueAxisState {
    const { valueAxisConfig, onFocus } = props;
    const valueAxisId = valueAxisConfig.id;

    let onValueAxisEnter: ValueAxisState['onValueAxisEnter'] = noOp;
    let onValueAxisLeave = noOp;
    let onValueAxisClick = noOp;

    if (valueAxisConfig.focusOnHover) {
      onValueAxisEnter = (event: Event) => { if (isHoverPointer(event)) { this.hoverActive = true; onFocus({ valueAxisId }); } };
      onValueAxisLeave = () => { if (this.hoverActive) { this.hoverActive = false; onFocus({ valueAxisId: null }); } };
    }
    if (valueAxisConfig.focusOnClick) {
      // a click pins the axis (hover only previews it); a click on the pinned one releases it, matching series/legend clicks
      onValueAxisClick = () => { onFocus({ valueAxisId, pin: true }); };
    }

    return { onValueAxisEnter, onValueAxisLeave, onValueAxisClick };
  }

  create() {
    this.axis = this.slot();
    return null;
  }

  sync() {
    const { front, valueAxisConfig, valueAxisLayoutInfo, plotLayoutInfo, focusPercentages, axisFocusPercentage, seriesFocusPercentage,
      seriesCount, valueAxisData, titleClipPathUniqueId, accessibility, accessibleLabel, chartFont } = this.props;
    const { onValueAxisEnter, onValueAxisLeave, onValueAxisClick } = this.state;
    if (valueAxisConfig.visibleWhenAllFiltered || seriesCount > 0) {
      const axisId = valueAxisConfig.id;
      this.axis!.set(Axis, { front, axisClass: mochartCssClasses['valueAxis'] + axisId, axisConfig: valueAxisConfig,
        axisLayoutInfo: valueAxisLayoutInfo, plotLayoutInfo,
        focusPercentages, axisTicks: valueAxisData.axisTickData[axisId],
        axisFocusPercentage, seriesFocusPercentage,
        titleClipPathUniqueId, onPointerEnter: onValueAxisEnter,
        onPointerLeave: onValueAxisLeave, onClick: onValueAxisClick, accessibility, accessibleLabel, chartFont });
    }
    else {
      this.axis!.set(null);
    }
  }
}
