import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getCategorySpacingInfo } from '../data/AxisData';
import { getValueAxisFocusContexts } from '../utils/FocusValue';
import { accessibilityActive } from '../utils/utils';

import AxisThreshold from './AxisThreshold';
import { SCALE_ORDINAL } from '../config/core/constants';
import type { ThresholdCategoryPositions } from './AxisThresholdShape';

import type { EnhancedMochartConfig } from '../types/enhanced';
import type { AxisData, CategoryAxisData, CategoryValue, ChartData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { AxisLayoutInfo, CategoryAxisLayoutInfo, LayoutInfo } from '../types/layout';

interface AxisThresholdContainerProps {
  front: boolean;
  mochartConfig: EnhancedMochartConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  valueAxisLayoutInfos: Record<string, AxisLayoutInfo>;
  seriesLayoutInfo: LayoutInfo;
  chartData: ChartData;
  focusData: FocusData;
  axisData: AxisData & { category: CategoryAxisData };
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
}

const fullPositionRange: [number, number] = [0, 1];

/** The category axis's threshold key, distinct from any value axis id. */
export const CATEGORY_AXIS_THRESHOLD_KEY = 'categoryAxis';
export function getValueAxisThresholdKey(axisId: string): string {
  return 'valueAxis__' + axisId;
}

export default class AxisThresholdContainer extends Renderer<AxisThresholdContainerProps> {
  root = svgEl('g');
  categoryThreshold = this.slot(this.root);
  seriesThresholds = this.rendererList(this.root);

  /** kept while config and domain hold, so AxisThreshold's shallow-equal skip is not defeated by a fresh array */
  private categoryRange: { axisConfig: unknown; axisDomain: unknown; categoryValueInterval: number | null; range: [number, number] } | null = null;

  private getCategoryPositionRange(axisConfig: AxisThresholdContainerProps['mochartConfig']['categoryAxis'], categoryData: ChartData['categoryData']): [number, number] {
    const cached = this.categoryRange;
    const { renderAxisDomain: axisDomain, categoryValueInterval } = categoryData;
    if (cached === null || cached.axisConfig !== axisConfig || cached.axisDomain !== axisDomain || cached.categoryValueInterval !== categoryValueInterval) {
      this.categoryRange = { axisConfig, axisDomain, categoryValueInterval, range: getCategorySpacingInfo(axisConfig, axisDomain, 1, categoryValueInterval).categoryRange };
    }
    return this.categoryRange!.range;
  }

  /** the ordinal slot positions, kept while their inputs hold so the shape renderers' shallow-equal skips see one object */
  private categoryPositions: { values: unknown; keys: unknown; positions: unknown; axisExtent: number; result: ThresholdCategoryPositions } | null = null;

  private getCategoryPositions(values: readonly CategoryValue[], keys: readonly CategoryValue[], positions: number[], axisExtent: number): ThresholdCategoryPositions {
    const cached = this.categoryPositions;
    if (cached === null || cached.values !== values || cached.keys !== keys || cached.positions !== positions || cached.axisExtent !== axisExtent) {
      this.categoryPositions = { values, keys, positions, axisExtent,
        result: { values, keys, positions, slotExtent: positions.length > 1 ? Math.abs(positions[1]! - positions[0]!) : axisExtent } };
    }
    return this.categoryPositions!.result;
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos, seriesLayoutInfo, chartData, focusData, axisData, gradientIdMap, patternIdMap } = this.props;
    const { plot: plotConfig, categoryAxis: categoryAxisConfig, valueAxes: valueAxisConfigs } = mochartConfig;
    const { inverted } = plotConfig;
    const { categoryData, seriesData } = chartData;
    const categoryAxisDomain = categoryData.renderAxisDomain;
    const { axisSeriesCounts } = seriesData;
    const valueAxisRawDomains = seriesData.raw.renderAxisDomains;
    const valueAxisFilteredDomains = seriesData.filtered.renderAxisDomains;

    // threshold titles annotate the geometry rather than name the data, so they stay out of the reading order
    this.root.set({ className: mochartCssClasses['axisThresholdContainer'],
      ariaHidden: accessibilityActive(mochartConfig.accessibility) ? 'true' : null });

    // the category scale maps its domain onto the slot-inset range (like the focus range does), so thresholds line up with ticks and data
    const categoryPositionRange = this.getCategoryPositionRange(categoryAxisConfig, categoryData);
    // an ordinal axis places thresholds by category slot: the positions the ticks and shapes already use
    let categoryPositions: ThresholdCategoryPositions | null = null;
    if (categoryAxisConfig.scale === SCALE_ORDINAL) {
      const { positions } = axisData.category.valueData;
      const axisExtent = inverted ? seriesLayoutInfo.height : seriesLayoutInfo.width;
      categoryPositions = this.getCategoryPositions(categoryData.values.parsed, categoryData.values.key, positions, axisExtent);
    }
    // ascending: a category axis renders ascending, a value axis only when horizontal (inverted); reversed flips either
    this.categoryThreshold.set(AxisThreshold, { front, plotConfig, axisConfig: categoryAxisConfig, axisLayoutInfo: categoryAxisLayoutInfo,
      hidden: false, seriesLayoutInfo, axisDomain: categoryAxisDomain, vertical: inverted, ascending: !categoryAxisConfig.reversed, positionRange: categoryPositionRange,
      axisFocusPercentage: null, seriesFocusPercentage: null, axisThresholdClass: mochartCssClasses['categoryAxisThreshold'],
      axisKey: CATEGORY_AXIS_THRESHOLD_KEY, axisName: 'categoryAxis', categoryPositions, gradientIdMap, patternIdMap, chartFont: mochartConfig.chart.font });

    this.seriesThresholds.sync(getValueAxisFocusContexts(valueAxisConfigs, focusData).map(({ axisConfig, id, key, axisFocusPercentage, seriesFocusPercentage }) => {
      const valueAxisDomain = axisConfig.adjustForFiltering ? valueAxisFilteredDomains[id] : valueAxisRawDomains[id];
      return {
        key,
        ctor: AxisThreshold,
        props: { front, plotConfig, axisConfig, axisLayoutInfo: valueAxisLayoutInfos[id],
          hidden: !axisConfig.visibleWhenAllFiltered && axisSeriesCounts[id] === 0, seriesLayoutInfo, axisDomain: valueAxisDomain, vertical: !inverted, ascending: inverted !== axisConfig.reversed, positionRange: fullPositionRange,
          axisFocusPercentage, seriesFocusPercentage, axisThresholdClass: mochartCssClasses['valueAxisThreshold'] + id,
          axisKey: getValueAxisThresholdKey(id), axisName: 'value axis ' + id, categoryPositions: null, gradientIdMap, patternIdMap, chartFont: mochartConfig.chart.font }
      };
    }));
  }
}
