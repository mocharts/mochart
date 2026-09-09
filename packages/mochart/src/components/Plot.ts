import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';

import Background from './Background';
import AxisGridContainer from './AxisGridContainer';
import AxisBaseContainer from './AxisBaseContainer';
import AxisContainer from './AxisContainer';
import AxisThresholdContainer from './AxisThresholdContainer';
import SeriesContainer from './SeriesContainer';
import type { SeriesShapeA11yProps } from './SeriesBackground';
import Crosshair from './Crosshair';
import ClipIndicator from './ClipIndicator';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ClippedEdges } from '../types/data';
import type { InternalFocus } from '../types/chart';
import type { AxisData, ChartData, CategoryAxisData, ValueAxisData, StackData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { AxisLayoutInfo, CategoryAxisLayoutInfo, LayoutInfo, SpacingLayoutInfo } from '../types/layout';

type CompleteAxisData = AxisData & { category: CategoryAxisData; value: ValueAxisData };

interface PlotFrontBackProps {
  front: boolean;
  mochartConfig: EnhancedMochartConfig;
  categoryAxisLayoutInfo: CategoryAxisLayoutInfo;
  valueAxisLayoutInfos: Record<string, AxisLayoutInfo>;
  seriesLayoutInfo: LayoutInfo;
  plotLayoutInfo: SpacingLayoutInfo;
  chartData: ChartData;
  focusData: FocusData;
  axisData: CompleteAxisData;
  categoryAxisTitleClipPathUniqueId: string;
  categoryAxisTickLabelClipPathUniqueId: string;
  valueAxisTitleClipPathUniqueIds: Record<string, string>;
  seriesClipPathUniqueId: string;
  clippedEdges: ClippedEdges;
  clipIndicatorPatternUniqueId: string;
  onFocus: (focus: InternalFocus) => void;
}

interface PlotProps extends Omit<PlotFrontBackProps, 'front'> {
  stackData: StackData;
  categoryValueData: CategoryAxisData['valueData'];
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  tooltipClipPathUniqueId: string;
  /** TooltipClip only mounts its node while the tooltip is visible; the crosshair must not reference it otherwise. */
  tooltipClipPresent: boolean;
  onSeriesShapeClick: ((seriesId: string, categoryIndex: number, event: Event) => void) | null;
  shapeRef: (element: Element | null) => void;
  a11yProps: SeriesShapeA11yProps | null;
}

class PlotFrontBack extends Renderer<PlotFrontBackProps> {
  root = svgEl('g');
  gridContainer = this.slot(this.root);
  baseContainer = this.slot(this.root);
  axisContainer = this.slot(this.root);
  thresholdContainer = this.slot(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos, seriesLayoutInfo, plotLayoutInfo,
      chartData, focusData, axisData, categoryAxisTitleClipPathUniqueId,
      categoryAxisTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, onFocus } = this.props;
    const { seriesData } = chartData;

    // not aria-hidden: the axis tick labels and titles under here are text a screen reader should read
    this.root.set({ className: mochartCssClasses[front ? 'plotFront' : 'plotBack'] });

    this.gridContainer.set(AxisGridContainer, { front, mochartConfig, seriesLayoutInfo,
      seriesData, focusData, axisData });

    this.baseContainer.set(AxisBaseContainer, { front, mochartConfig, seriesLayoutInfo,
      seriesData, focusData });

    this.axisContainer.set(AxisContainer, { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos,
      plotLayoutInfo, seriesData, focusData, axisData,
      categoryAxisTitleClipPathUniqueId, categoryAxisTickLabelClipPathUniqueId,
      valueAxisTitleClipPathUniqueIds, onFocus });

    this.thresholdContainer.set(AxisThresholdContainer, { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos,
      seriesLayoutInfo, chartData, focusData });
  }
}

export default class Plot extends Renderer<PlotProps> {
  root = svgEl('g');
  background = this.slot(this.root);
  back = this.slot(this.root);
  clipIndicatorBack = this.slot(this.root);
  seriesContainer = this.slot(this.root);
  front = this.slot(this.root);
  clipIndicatorFront = this.slot(this.root);
  crosshair = this.slot(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos, seriesLayoutInfo, plotLayoutInfo,
      chartData, focusData, axisData, stackData, categoryValueData, gradientIdMap, patternIdMap, categoryAxisTitleClipPathUniqueId,
      categoryAxisTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, tooltipClipPathUniqueId, tooltipClipPresent, seriesClipPathUniqueId, clippedEdges, clipIndicatorPatternUniqueId, onFocus, onSeriesShapeClick, shapeRef, a11yProps } = this.props;
    const { plot: plotConfig } = mochartConfig;
    const { categoryFocusDomainPercentages = [], seriesFocusDomainPercentages = [] } = focusData;
    const { value: valueAxisData } = axisData;

    const frontBackProps = (front: boolean) => ({
      front,
      mochartConfig,
      categoryAxisLayoutInfo,
      valueAxisLayoutInfos,
      seriesLayoutInfo,
      plotLayoutInfo,
      chartData,
      focusData,
      axisData,
      categoryAxisTitleClipPathUniqueId,
      categoryAxisTickLabelClipPathUniqueId,
      valueAxisTitleClipPathUniqueIds,
      onFocus
    });

    // TODO - consider adding front/back support for the plot background
    this.root.set({ className: mochartCssClasses['plot'] });

    this.background.set(Background, { config: plotConfig, classKey: 'plotBackground', spacingRelative: false, spacingLayoutInfo: plotLayoutInfo });

    this.back.set(PlotFrontBack, frontBackProps(false));

    this.seriesContainer.set(SeriesContainer, { mochartConfig, seriesLayoutInfo, seriesData: chartData.seriesData,
      valueAxisData, stackData, focusData, onFocus, onSeriesShapeClick, categoryValueData,
      gradientIdMap, patternIdMap, shapeRef, a11yProps, seriesClipPathUniqueId });

    this.front.set(PlotFrontBack, frontBackProps(true));

    // one slot each side of the series container; only the chosen one is populated
    const clipIndicatorProps = { mochartConfig, seriesLayoutInfo, clippedEdges, clipIndicatorPatternUniqueId };
    this.clipIndicatorFront.set(mochartConfig.clipIndicator.front ? ClipIndicator : null, clipIndicatorProps);
    this.clipIndicatorBack.set(mochartConfig.clipIndicator.front ? null : ClipIndicator, clipIndicatorProps);

    this.crosshair.set(Crosshair, { mochartConfig, seriesLayoutInfo,
      categoryPercentages: categoryFocusDomainPercentages, seriesPercentages: seriesFocusDomainPercentages,
      tooltipClipPathUniqueId, tooltipClipPresent });
  }
}
