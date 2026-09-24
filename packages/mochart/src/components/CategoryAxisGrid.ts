import { Renderer, Slot } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';

import AxisGrid from './AxisGrid.js';
import type { CategoryAxisConfig, PlotConfig } from '../types/config.js';
import type { CategoryAxisData } from '../types/data.js';
import type { LayoutInfo } from '../types/layout.js';

interface CategoryAxisGridProps {
  front: boolean;
  plotConfig: PlotConfig;
  categoryAxisConfig: CategoryAxisConfig;
  seriesLayoutInfo: LayoutInfo;
  categoryAxisData: CategoryAxisData;
}

export default class CategoryAxisGrid extends Renderer<CategoryAxisGridProps> {
  grid: Slot | null = null;

  create() {
    this.grid = this.slot();
    return null;
  }

  sync() {
    const { front, plotConfig, categoryAxisConfig, seriesLayoutInfo, categoryAxisData } = this.props;

    this.grid!.set(AxisGrid, { front, vertical: plotConfig.inverted, axisConfig: categoryAxisConfig, seriesLayoutInfo,
      axisGridClass: mochartCssClasses['categoryAxisGrid'], axisTicks: categoryAxisData.axisTickData });
  }
}
