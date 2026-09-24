import { Renderer, Slot } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';

import Axis from './Axis.js';
import type { CategoryAxisConfig, FontConfig } from '../types/config.js';
import type { CategoryAxisData } from '../types/data.js';
import type { CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout.js';

interface CategoryAxisProps {
  front: boolean;
  categoryAxisConfig: CategoryAxisConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  focusPercentages: number[];
  categoryAxisData: CategoryAxisData;
  titleClipPathUniqueId: string;
  tickLabelClipPathUniqueId: string;
  minorTickLabelClipPathUniqueId: string;
  accessibility: boolean;
  accessibleLabel: string;
  chartFont: FontConfig;
}

export default class CategoryAxis extends Renderer<CategoryAxisProps> {
  axis: Slot | null = null;

  create() {
    this.axis = this.slot();
    return null;
  }

  sync() {
    const { front, categoryAxisConfig, categoryAxisLayoutInfo, plotLayoutInfo, focusPercentages,
      categoryAxisData, titleClipPathUniqueId, tickLabelClipPathUniqueId, minorTickLabelClipPathUniqueId, accessibility, accessibleLabel, chartFont } = this.props;

    this.axis!.set(Axis, { front, axisClass: mochartCssClasses['categoryAxis'], axisConfig: categoryAxisConfig, axisLayoutInfo: categoryAxisLayoutInfo,
      plotLayoutInfo, axisTicks: categoryAxisData.axisTickData,
      focusPercentages, tickSpacing: categoryAxisData.maxTickLabelLength, minorTickSpacing: categoryAxisData.maxMinorTickLabelLength,
      titleClipPathUniqueId, tickLabelClipPathUniqueId, minorTickLabelClipPathUniqueId, accessibility, accessibleLabel, chartFont });
  }
}
