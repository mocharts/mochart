import { Renderer, svgEl } from '../render';

import { getSeriesConfigsOrderedByFocus } from '../data/FocusData';
import { getPieSliceAngles, sweepPieSliceAngles } from '../data/PieData';
import type { PieSliceAngles } from '../data/PieData';
import { getRadialLayoutInfo } from '../layout/RadialLayout';
import { mochartCssClasses } from '../utils/ChartDom';
import { accessibilityActive } from '../utils/utils';
import { moveRovingFocus, seriesNodesInConfigOrder, resolveRovingId, focusedSeriesNode, restoreSeriesFocus, sliceIsInteractive } from '../utils/RovingFocus';

import SeriesBackground from './SeriesBackground';
import type { SeriesShapeA11yProps } from './SeriesBackground';
import PieSeries from './PieSeries';
import PieCenter from './PieCenter';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { SeriesData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { LayoutInfo } from '../types/layout';

interface PieSeriesContainerProps {
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  seriesData: SeriesData;
  focusData: FocusData;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  /** 0..1 while the initial value tween runs (drives the sweep-in), else null. */
  initialAnimationPercentage: number | null;
  onFocus: (focus: { seriesId?: string | null; categoryIndex?: number | null }) => void;
  onSliceClick?: (payload: { seriesId: string }) => void;
  shapeRef: (element: Element | null) => void;
  a11yProps: SeriesShapeA11yProps | null;
}

interface PieSeriesContainerState { rovingSeriesId: string | null }

export default class PieSeriesContainer extends Renderer<PieSeriesContainerProps, PieSeriesContainerState> {
  root = svgEl('g');
  background = this.slot(this.root);
  series = this.rendererList(this.root);
  center = this.slot(this.root);

  constructor() {
    super();
    this.state = { rovingSeriesId: null };
  }

  /** any focus landing on a slice (Tab, arrows, mouse) makes it the roving tab stop */
  sliceFocusIn = (event: Event) => {
    const seriesId = (event.target as Element).getAttribute?.('data-series-id');
    if (seriesId != null && seriesId !== this.state.rovingSeriesId) {
      this.setState({ rovingSeriesId: seriesId });
    }
  }

  sliceKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    const target = event.target as Element;
    if (target.getAttribute?.('data-series-id') == null) {
      return; // not a slice (e.g. the plot-area rect handles its own keys)
    }
    if (key === 'Escape' || key === 'Enter' || key === ' ') {
      // mirror the plot rect: Enter/Space toggles the tooltip (and announces),
      // Escape closes it — the slice itself handles only focus/selection
      // a pie has one category, so unlike a cartesian series no category is invented here
      this.props.a11yProps?.onKeyDown(event);
      return;
    }
    moveRovingFocus(event, seriesNodesInConfigOrder(this.root.node, this.props.mochartConfig.series));
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { mochartConfig, seriesLayoutInfo, seriesData, focusData, gradientIdMap, patternIdMap, initialAnimationPercentage, onFocus, onSliceClick, shapeRef, a11yProps } = this.props;
    const { pie: pieConfig, colorPalette: colorPaletteConfig, seriesIndicesById: seriesConfigIndicesById } = mochartConfig;
    const { values: filteredValues } = seriesData.filtered;

    // Angles come from the config-order slice map (focus reordering must not move geometry);
    // recomputing every sync is what animates them — filtered values are tweened mid-animation.
    let sliceAngles = getPieSliceAngles(mochartConfig.series, filteredValues, pieConfig);
    const radialLayoutInfo = getRadialLayoutInfo(seriesLayoutInfo, pieConfig);

    // When labels or the center total should ignore filtering, their
    // fractions/total come from the raw values (which keep filtered series).
    let rawSliceAngles: Record<string, PieSliceAngles> | null = null;
    if (!pieConfig.label.adjustForFiltering || !pieConfig.centerTotal.adjustForFiltering) {
      rawSliceAngles = getPieSliceAngles(mochartConfig.series, seriesData.raw.values, pieConfig);
    }

    // On the initial animation the whole pie sweeps in from the start angle;
    // labels stay hidden until the sweep settles.
    const sweeping = initialAnimationPercentage !== null && initialAnimationPercentage < 1;
    if (sweeping) {
      sliceAngles = sweepPieSliceAngles(sliceAngles, pieConfig, initialAnimationPercentage);
    }

    // Focused slices draw last so their stroke sits above their neighbours'.
    const orderedSeriesConfigs = getSeriesConfigsOrderedByFocus(mochartConfig, focusData);

    const accessibility = accessibilityActive(mochartConfig.accessibility);
    // zero-fraction slices render nothing (see PieSeries.sync), so they hold no tab stop
    const interactiveIds = mochartConfig.series
      .filter(sc => sliceIsInteractive(accessibility, sc, onSliceClick) && (sliceAngles[sc.id]?.fraction ?? 0) > 0)
      .map(sc => sc.id);
    const effectiveRovingId = resolveRovingId(this.state.rovingSeriesId, interactiveIds, seriesConfigIndicesById);

    // the roving slices are one group, named like the legend's
    const anyInteractive = interactiveIds.length > 0;

    this.root.set({ className: mochartCssClasses['seriesContainer'],
      role: anyInteractive ? 'group' : null,
      ariaLabel: anyInteractive ? mochartConfig.accessibility.seriesLabel : null,
      onKeyDown: anyInteractive ? this.sliceKeyDown : null,
      onFocusIn: anyInteractive ? this.sliceFocusIn : null });
    this.background.set(SeriesBackground, { seriesLayoutInfo, shapeRef, a11yProps });

    // reordering below moves the focused slice's node, which drops DOM focus
    const focusedSlice = focusedSeriesNode(this.root.node);

    this.series.sync(orderedSeriesConfigs.map(seriesConfig => ({
      key: 'series-' + seriesConfig.id,
      ctor: PieSeries,
      props: { colorPaletteConfig, pieConfig, seriesConfig,
        seriesIndex: seriesConfigIndicesById[seriesConfig.id],
        seriesLayoutInfo, radialLayoutInfo,
        sliceAngles: sliceAngles[seriesConfig.id],
        labelFraction: pieConfig.label.adjustForFiltering
          ? sliceAngles[seriesConfig.id]?.fraction ?? 0
          : rawSliceAngles![seriesConfig.id]?.fraction ?? 0,
        focusData, gradientIdMap, patternIdMap, hideLabels: sweeping, onFocus, onSliceClick,
        accessibility, tabStop: seriesConfig.id === effectiveRovingId }
    })));

    // a filtered-out focused slice hands focus to the one that inherited the tab stop
    restoreSeriesFocus(this.root.node, focusedSlice, effectiveRovingId);

    // The center total sums the current (possibly mid-tween) values, counting along with value
    // changes — and with filtering, unless centerTotal.adjustForFiltering turns that off.
    const totalAngles = pieConfig.centerTotal.adjustForFiltering ? sliceAngles : rawSliceAngles!;
    let total = 0;
    for (const id of Object.keys(totalAngles)) {
      total += totalAngles[id].value;
    }
    this.center.set(PieCenter, { pieConfig, seriesLayoutInfo, radialLayoutInfo, total, accessibility });
  }
}
