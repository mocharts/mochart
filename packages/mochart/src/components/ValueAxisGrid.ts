import { Renderer, Slot } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';

import AxisGrid from './AxisGrid.js';
import type { PlotConfig } from '../types/config.js';
import type { EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { ValueAxisData } from '../types/data.js';
import type { LayoutInfo } from '../types/layout.js';

interface ValueAxisGridProps {
  front: boolean;
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
    const { front, plotConfig, valueAxisConfig, seriesLayoutInfo, axisFocusPercentage, seriesFocusPercentage, seriesCount, valueAxisData } = this.props;
    if (valueAxisConfig.visibleWhenAllFiltered || seriesCount > 0) {
      const axisId = valueAxisConfig.id;
      this.grid!.set(AxisGrid, { front, vertical: !plotConfig.inverted, axisConfig: valueAxisConfig, seriesLayoutInfo,
        axisGridClass: mochartCssClasses['valueAxisGrid'] + axisId,
        axisFocusPercentage, seriesFocusPercentage,
        axisTicks: valueAxisData.axisTickData[axisId] });
    }
    else {
      this.grid!.set(null);
    }
  }
}
