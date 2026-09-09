import { Renderer, svgEl } from '../render';
import type { RendererList, Slot } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';

import Axis from './Axis';
import { getAxisAccessibleLabel } from './AxisContainer';
import { accessibilityActive } from '../utils/utils';
import type { EnhancedMochartConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisTick } from '../types/data';
import type { AxisLayoutInfo, CategoryAxisLayoutInfo, SpacingLayoutInfo } from '../types/layout';

const emptyFocusPercentages: number[] = [];
const emptyTicks: AxisTick[] = [];

interface PlotEmptyProps {
  mochartConfig: EnhancedMochartConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  valueAxisLayoutInfos: Record<string, AxisLayoutInfo>;
  plotLayoutInfo: SpacingLayoutInfo;
  /** series per value axis id, as the layout sized the axes with: absent while loading */
  valueAxisSeriesCounts: Record<string, number>;
  categoryAxisTitleClipPathUniqueId: string;
  categoryAxisTickLabelClipPathUniqueId: string;
  valueAxisTitleClipPathUniqueIds: Record<string, string>;
}

export default class PlotEmpty extends Renderer<PlotEmptyProps> {
  root = svgEl('g');
  // the axes split their parts across a back and a front pass like the populated plot does
  categoryAxisBack = this.slot(this.root);
  valueAxesBack = this.rendererList(this.root);
  categoryAxisFront = this.slot(this.root);
  valueAxesFront = this.rendererList(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos, plotLayoutInfo, valueAxisSeriesCounts,
      categoryAxisTitleClipPathUniqueId, categoryAxisTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds } = this.props;
    const { categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs, accessibility: accessibilityConfig } = mochartConfig;

    const commonProps = {
      plotLayoutInfo,
      focusPercentages: emptyFocusPercentages,
      tickSpacing: null,
      axisTicks: emptyTicks,
      accessibility: accessibilityActive(accessibilityConfig)
    };

    this.root.set({ className: mochartCssClasses['plot'] });

    const syncAxes = (front: boolean, categoryAxis: Slot, valueAxes: RendererList) => {
      categoryAxis.set(Axis, { front, axisClass: mochartCssClasses['categoryAxis'], axisConfig: categoryAxisConfig, axisLayoutInfo: categoryAxisLayoutInfo,
        titleClipPathUniqueId: categoryAxisTitleClipPathUniqueId, tickLabelClipPathUniqueId: categoryAxisTickLabelClipPathUniqueId,
        accessibleLabel: getAxisAccessibleLabel(categoryAxisConfig.title.text, accessibilityConfig.categoryAxisLabel),
        ...commonProps });

      // the same gate ValueAxis and the layout apply: an axis hidden with its filtered series has no band to draw in
      valueAxes.sync(valueAxisConfigs.filter(axisConfig => axisConfig.visibleWhenAllFiltered || (valueAxisSeriesCounts[axisConfig.id] ?? 0) > 0).map((axisConfig: EnhancedValueAxisConfig) => {
        const { id } = axisConfig;
        return {
          key: 'value-axis-' + id,
          ctor: Axis,
          props: { front, axisClass: mochartCssClasses['valueAxis'] + id, axisConfig,
            axisLayoutInfo: valueAxisLayoutInfos[id], titleClipPathUniqueId: valueAxisTitleClipPathUniqueIds[id],
            accessibleLabel: getAxisAccessibleLabel(axisConfig.title.text, accessibilityConfig.valueAxisLabel),
            ...commonProps }
        };
      }));
    };
    syncAxes(false, this.categoryAxisBack, this.valueAxesBack);
    syncAxes(true, this.categoryAxisFront, this.valueAxesFront);
  }
}
