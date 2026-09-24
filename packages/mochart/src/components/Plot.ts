import { Renderer, svgEl } from '../render/index.js';

import { mochartCssClasses } from '../utils/ChartDom.js';

import Background from './Background.js';
import AxisGridContainer from './AxisGridContainer.js';
import AxisBaseContainer from './AxisBaseContainer.js';
import AxisContainer from './AxisContainer.js';
import AxisThresholdContainer from './AxisThresholdContainer.js';
import SeriesContainer from './SeriesContainer.js';
import type { SeriesShapeA11yProps } from './SeriesBackground.js';
import Crosshair from './Crosshair.js';
import ClipIndicator from './ClipIndicator.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';
import type { ClippedEdges } from '../types/data.js';
import type { InternalFocus } from '../types/chart.js';
import type { AxisData, ChartData, CategoryAxisData, ValueAxisData, StackData } from '../types/data.js';
import type { FocusData } from '../types/animation.js';
import type { AxisLayoutInfo, CategoryAxisLayoutInfo, LayoutInfo, SpacingLayoutInfo } from '../types/layout.js';

type CompleteAxisData = AxisData & { category: CategoryAxisData; value: ValueAxisData };

interface PlotFrontBackProps {
  front: boolean;
  fontsVersion: number;
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
  categoryAxisMinorTickLabelClipPathUniqueId: string;
  valueAxisTitleClipPathUniqueIds: Record<string, string>;
  seriesClipPathUniqueId: string;
  clippedEdges: ClippedEdges;
  clipIndicatorPatternUniqueId: string;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  onFocus: (focus: InternalFocus) => void;
}

interface PlotProps extends Omit<PlotFrontBackProps, 'front'> {
  stackData: StackData;
  categoryValueData: CategoryAxisData['valueData'];
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
      categoryAxisTickLabelClipPathUniqueId, categoryAxisMinorTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, onFocus } = this.props;
    const { seriesData } = chartData;

    // not aria-hidden: the axis tick labels and titles under here are text a screen reader should read
    this.root.set({ className: mochartCssClasses[front ? 'plotFront' : 'plotBack'] });

    this.gridContainer.set(AxisGridContainer, { front, mochartConfig, seriesLayoutInfo,
      seriesData, focusData, axisData });

    this.baseContainer.set(AxisBaseContainer, { front, mochartConfig, seriesLayoutInfo,
      seriesData, focusData });

    this.axisContainer.set(AxisContainer, { front, fontsVersion: this.props.fontsVersion, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos,
      plotLayoutInfo, seriesData, focusData, axisData,
      categoryAxisTitleClipPathUniqueId, categoryAxisTickLabelClipPathUniqueId, categoryAxisMinorTickLabelClipPathUniqueId,
      valueAxisTitleClipPathUniqueIds, onFocus });

    const { gradientIdMap, patternIdMap } = this.props;
    this.thresholdContainer.set(AxisThresholdContainer, { front, mochartConfig, categoryAxisLayoutInfo, valueAxisLayoutInfos,
      seriesLayoutInfo, chartData, focusData, axisData, gradientIdMap, patternIdMap });
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
      categoryAxisTickLabelClipPathUniqueId, categoryAxisMinorTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, tooltipClipPathUniqueId, tooltipClipPresent, seriesClipPathUniqueId, clippedEdges, clipIndicatorPatternUniqueId, onFocus, onSeriesShapeClick, shapeRef, a11yProps } = this.props;
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
      categoryAxisMinorTickLabelClipPathUniqueId,
      valueAxisTitleClipPathUniqueIds,
      gradientIdMap,
      patternIdMap,
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
