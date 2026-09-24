import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';
import { getValueAxisFocusContexts } from '../utils/FocusValue.js';
import { accessibilityActive } from '../utils/utils.js';
import { NONE } from '../config/core/constants.js';

import CategoryAxis from './CategoryAxis.js';
import ValueAxis from './ValueAxis.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';
import type { AxisData, CategoryAxisData, ValueAxisData, SeriesData } from '../types/data.js';
import type { FocusData } from '../types/animation.js';
import type { AxisLayoutInfo, CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout.js';

interface AxisContainerProps {
  front: boolean;
  mochartConfig: EnhancedMochartConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  valueAxisLayoutInfos: Record<string, AxisLayoutInfo>;
  plotLayoutInfo: SpacingLayoutInfo;
  seriesData: SeriesData;
  focusData: FocusData;
  axisData: AxisData & { category: CategoryAxisData; value: ValueAxisData };
  categoryAxisTitleClipPathUniqueId: string;
  categoryAxisTickLabelClipPathUniqueId: string;
  categoryAxisMinorTickLabelClipPathUniqueId: string;
  valueAxisTitleClipPathUniqueIds: Record<string, string>;
  onFocus: (focus: { valueAxisId: string | null }) => void;
}

export default class AxisContainer extends Renderer<AxisContainerProps> {
  root = svgEl('g');
  categoryAxis = this.slot(this.root);
  valueAxes = this.rendererList(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos, plotLayoutInfo,
      seriesData, focusData, axisData, categoryAxisTitleClipPathUniqueId,
      categoryAxisTickLabelClipPathUniqueId, categoryAxisMinorTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, onFocus } = this.props;
    const { categoryFocusDomainPercentages = [], valueAxisComputedFocusDomainPercentages = {} } = focusData;
    const { category: categoryAxisData, value: valueAxisData } = axisData;

    const { categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs, accessibility: accessibilityConfig } = mochartConfig;
    const accessibility = accessibilityActive(accessibilityConfig);

    this.root.set({ className: mochartCssClasses['axisContainer'] });

    this.categoryAxis.set(CategoryAxis, { front, categoryAxisConfig, categoryAxisLayoutInfo,
      focusPercentages: categoryFocusDomainPercentages, categoryAxisData,
      titleClipPathUniqueId: categoryAxisTitleClipPathUniqueId,
      tickLabelClipPathUniqueId: categoryAxisTickLabelClipPathUniqueId,
      minorTickLabelClipPathUniqueId: categoryAxisMinorTickLabelClipPathUniqueId,
      plotLayoutInfo, accessibility, chartFont: mochartConfig.chart.font,
      accessibleLabel: getAxisAccessibleLabel(categoryAxisConfig.title.text, accessibilityConfig.categoryAxisLabel) });

    this.valueAxes.sync(getValueAxisFocusContexts(valueAxisConfigs, focusData).map(({ axisConfig, id, key, axisFocusPercentage, seriesFocusPercentage }) => {
      return {
        key,
        ctor: ValueAxis,
        props: { front, valueAxisConfig: axisConfig,
          valueAxisLayoutInfo: valueAxisLayoutInfos[id], seriesCount: seriesData.axisSeriesCounts[id],
          focusPercentages: valueAxisComputedFocusDomainPercentages[id] ?? [], valueAxisData,
          axisFocusPercentage, seriesFocusPercentage,
          titleClipPathUniqueId: valueAxisTitleClipPathUniqueIds[id],
          focusedValueAxisId: focusData.focusedValueAxisId,
          plotLayoutInfo, onFocus, accessibility, chartFont: mochartConfig.chart.font,
          accessibleLabel: getAxisAccessibleLabel(axisConfig.title.text, accessibilityConfig.valueAxisLabel) }
      };
    }));
  }
}

// the untruncated title names the axis group; the drawn title may be truncated
export function getAxisAccessibleLabel(title: string | null, defaultLabel: string): string {
  return title === NONE || title === '' ? defaultLabel : title!;
}
