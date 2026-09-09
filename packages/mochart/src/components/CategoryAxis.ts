import { Renderer, Slot } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';

import Axis from './Axis';
import type { CategoryAxisConfig } from '../types/config';
import type { CategoryAxisData } from '../types/data';
import type { CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

interface CategoryAxisProps {
  front: boolean;
  categoryAxisConfig: CategoryAxisConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  focusPercentages: number[];
  categoryAxisData: CategoryAxisData;
  titleClipPathUniqueId: string;
  tickLabelClipPathUniqueId: string;
  accessibility: boolean;
  accessibleLabel: string;
}

export default class CategoryAxis extends Renderer<CategoryAxisProps> {
  axis: Slot | null = null;

  create() {
    this.axis = this.slot();
    return null;
  }

  sync() {
    const { front, categoryAxisConfig, categoryAxisLayoutInfo, plotLayoutInfo, focusPercentages,
      categoryAxisData, titleClipPathUniqueId, tickLabelClipPathUniqueId, accessibility, accessibleLabel } = this.props;

    this.axis!.set(Axis, { front, axisClass: mochartCssClasses['categoryAxis'], axisConfig: categoryAxisConfig, axisLayoutInfo: categoryAxisLayoutInfo,
      plotLayoutInfo, axisTicks: categoryAxisData.axisTickData,
      focusPercentages, tickSpacing: categoryAxisData.maxTickLabelLength,
      titleClipPathUniqueId, tickLabelClipPathUniqueId, accessibility, accessibleLabel });
  }
}
