import { Renderer, Slot } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';

import AxisGrid from './AxisGrid';
import type { CategoryAxisConfig, PlotConfig } from '../types/config';
import type { CategoryAxisData } from '../types/data';
import type { LayoutInfo } from '../types/layout';

interface CategoryAxisGridProps {
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
    const { plotConfig, categoryAxisConfig, seriesLayoutInfo, categoryAxisData } = this.props;

    this.grid!.set(AxisGrid, { vertical: plotConfig.inverted, axisConfig: categoryAxisConfig, seriesLayoutInfo,
      axisGridClass: mochartCssClasses['categoryAxisGrid'], axisTicks: categoryAxisData.axisTickData });
  }
}
