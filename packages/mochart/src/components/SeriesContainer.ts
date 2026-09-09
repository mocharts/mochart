import { Renderer, svgEl } from '../render';

import { getSeriesConfigsOrderedByFocus } from '../data/FocusData';
import { mochartCssClasses } from '../utils/ChartDom';
import { accessibilityActive } from '../utils/utils';
import { getClipPathReference } from '../utils/svgUtils';
import { moveRovingFocus, seriesNodesInConfigOrder, resolveRovingId, focusedSeriesNode, restoreSeriesFocus, seriesIsInteractive } from '../utils/RovingFocus';

import SeriesBackground from './SeriesBackground';
import type { SeriesShapeA11yProps } from './SeriesBackground';
import Series from './Series';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { CategoryAxisData, ValueAxisData, SeriesData, StackData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { LayoutInfo } from '../types/layout';

interface SeriesContainerProps {
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  seriesClipPathUniqueId: string;
  seriesData: SeriesData;
  valueAxisData: ValueAxisData;
  stackData: StackData;
  focusData: FocusData;
  categoryValueData: CategoryAxisData['valueData'];
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  onFocus: (focus: { seriesId?: string | null; categoryIndex?: number | null }) => void;
  onSeriesShapeClick: ((seriesId: string, categoryIndex: number, event: Event) => void) | null;
  shapeRef: (element: Element | null) => void;
  a11yProps: SeriesShapeA11yProps | null;
}

interface SeriesContainerState { rovingSeriesId: string | null }

export default class SeriesContainer extends Renderer<SeriesContainerProps, SeriesContainerState> {
  root = svgEl('g');
  background = this.slot(this.root);
  series = this.rendererList(this.root);

  constructor() {
    super();
    this.state = { rovingSeriesId: null };
  }

  /** any focus landing on a series (Tab, arrows, mouse) makes it the roving tab stop */
  seriesFocusIn = (event: Event) => {
    const seriesId = (event.target as Element).getAttribute?.('data-series-id');
    if (seriesId != null && seriesId !== this.state.rovingSeriesId) {
      this.setState({ rovingSeriesId: seriesId });
    }
  }

  seriesKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    const target = event.target as Element;
    if (target.getAttribute?.('data-series-id') == null) {
      return; // not a series (e.g. the plot-area rect handles its own keys)
    }
    if (key === 'Escape') {
      // Escape is not a roving-group key, so it still reaches the plot rect and closes the tooltip
      this.props.a11yProps?.onKeyDown(event);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      // the series handles its own activation; a series spans every category, so
      // there is no category for it to open the tooltip at — the plot rect owns that
      return;
    }
    moveRovingFocus(event, seriesNodesInConfigOrder(this.root.node, this.props.mochartConfig.series));
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { mochartConfig, seriesLayoutInfo, seriesData, valueAxisData, stackData, focusData, categoryValueData, gradientIdMap, patternIdMap, onFocus, onSeriesShapeClick, shapeRef, a11yProps, seriesClipPathUniqueId } = this.props;

    const { categoryAxis: categoryAxisConfig, seriesIndicesById: seriesConfigIndicesById, colorPalette: colorPaletteConfig } = mochartConfig;

    const { raw, filtered } = seriesData;
    const { domains: rawDomains, renderAxisDomains: rawValueAxisDomains } = raw;
    const { values: filteredValues } = filtered;

    const orderedSeriesConfigs = getSeriesConfigsOrderedByFocus(mochartConfig, focusData);

    const accessibility = accessibilityActive(mochartConfig.accessibility);
    // filtered-out series render nothing (see Series.sync), so they hold no tab stop
    const interactiveIds = mochartConfig.series
      .filter(sc => seriesIsInteractive(accessibility, sc, onSeriesShapeClick) && filteredValues[sc.id].plain !== null)
      .map(sc => sc.id);
    const effectiveRovingId = resolveRovingId(this.state.rovingSeriesId, interactiveIds, seriesConfigIndicesById);

    // the roving series are one group, named like the legend's
    const anyInteractive = interactiveIds.length > 0;

    this.root.set({ className: mochartCssClasses['seriesContainer'],
      // an explicit axis min/max is a hard bound, so anything past it must not paint over the chrome
      clipPath: getClipPathReference(seriesClipPathUniqueId),
      role: anyInteractive ? 'group' : null,
      ariaLabel: anyInteractive ? mochartConfig.accessibility.seriesLabel : null,
      onKeyDown: anyInteractive ? this.seriesKeyDown : null,
      onFocusIn: anyInteractive ? this.seriesFocusIn : null });
    this.background.set(SeriesBackground, { seriesLayoutInfo, shapeRef, a11yProps });

    // reordering below moves the focused series' node, which drops DOM focus
    const focusedSeries = focusedSeriesNode(this.root.node);

    this.series.sync(orderedSeriesConfigs.map(seriesConfig => {
      const { id, axis } = seriesConfig;
      const index = seriesConfigIndicesById[seriesConfig.id];

      return {
        key: 'series-' + id,
        ctor: Series,
        props: { categoryAxisConfig, colorPaletteConfig,
          seriesConfig, seriesIndex: index, stackData,
          seriesLayoutInfo, focusData, categoryValueData,
          valueAxisScale: valueAxisData.axisScales[axis!],
          rawValueAxisDomain: rawValueAxisDomains[axis!], rawDomains: rawDomains[id],
          filteredValues: filteredValues[id],
          gradientIdMap, patternIdMap, onFocus, onSeriesShapeClick, accessibility,
          tabStop: id === effectiveRovingId }
      };
    }));

    // a filtered-out focused series hands focus to the one that inherited the tab stop
    restoreSeriesFocus(this.root.node, focusedSeries, effectiveRovingId);
  }
}
