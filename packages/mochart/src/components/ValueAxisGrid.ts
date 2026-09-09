import { Renderer, Slot } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';

import AxisGrid from './AxisGrid';
import type { PlotConfig } from '../types/config';
import type { EnhancedValueAxisConfig } from '../types/enhanced';
import type { ValueAxisData } from '../types/data';
import type { LayoutInfo } from '../types/layout';

interface ValueAxisGridProps {
  plotConfig: PlotConfig;
  valueAxisConfig: EnhancedValueAxisConfig;
  seriesLayoutInfo: LayoutInfo;
  axisFocusPercentage: number | null;
  seriesFocusPercentage: number | null;
  seriesCount: number;
  valueAxisData: ValueAxisData;
}

export default class ValueAxisGrid extends Renderer<ValueAxisGridProps> {
  grid: Slot | null = null;

  create() {
    this.grid = this.slot();
    return null;
  }

  sync() {
    const { plotConfig, valueAxisConfig, seriesLayoutInfo, axisFocusPercentage, seriesFocusPercentage, seriesCount, valueAxisData } = this.props;
    if (valueAxisConfig.visibleWhenAllFiltered || seriesCount > 0) {
      const axisId = valueAxisConfig.id;
      this.grid!.set(AxisGrid, { vertical: !plotConfig.inverted, axisConfig: valueAxisConfig, seriesLayoutInfo,
        axisGridClass: mochartCssClasses['valueAxisGrid'] + axisId,
        axisFocusPercentage, seriesFocusPercentage,
        axisTicks: valueAxisData.axisTickData[axisId] });
    }
    else {
      this.grid!.set(null);
    }
  }
}
