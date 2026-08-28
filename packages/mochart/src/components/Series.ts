import { Renderer, svgEl, ElList } from '../render';

import { getSeriesPositionData } from '../utils/SeriesPositions';
import { getLineGenerator, getRangeLineGenerator, getAreaGenerator, getColumnGenerator } from '../utils/SeriesShapes';
import { getSeriesColorGenerator, usesCategoryIndexColor } from '../utils/SeriesColors';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { getSeriesTitle } from '../utils/SeriesTitle';
import { seriesIsInteractive } from '../utils/RovingFocus';
import { mochartCssClasses } from '../utils/ChartDom';
import { areArraysAndEqual, translateObject, isHoverPointer } from '../utils/utils';
import { NONE, RENDERER_AREA, RENDERER_LINE, RENDERER_BAR } from '../config/core/constants';
import { getSeriesFillColor, getSeriesStrokeColor } from '../utils/SeriesColors';
import { getGradientReference, getPatternReference } from '../utils/svgUtils';
import { getFocusStyle, getCategoryFocusPercentage } from '../utils/FocusValue';

import SeriesErrorBars from './SeriesErrorBars';
import SeriesMarkers from './SeriesMarkers';
import SeriesLabels from './SeriesLabels';
import type { El, ElListAdapter } from '../render';
import type { ColorPaletteConfig, CategoryAxisConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { FocusData } from '../types/animation';
import type { AxisScale, CategoryAxisData, NullableDomain, SeriesDomainObject, SeriesPositionData, SeriesValueObject, StackData } from '../types/data';
import type { LayoutInfo } from '../types/layout';
import { CategoryShapeCache } from '../utils/CategoryShapes';
import type { CategoryShape } from '../utils/CategoryShapes';

const noOp = () => {};
const noOpCategory = (_categoryIndex: number) => {};

interface SeriesFocusUpdate {
  seriesId?: string | null;
  categoryIndex?: number | null;
}

interface SeriesProps {
  categoryAxisConfig: CategoryAxisConfig;
  colorPaletteConfig: ColorPaletteConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  stackData: StackData;
  seriesLayoutInfo: LayoutInfo;
  focusData: FocusData | null;
  categoryValueData: CategoryAxisData['valueData'];
  valueAxisScale: AxisScale;
  rawValueAxisDomain: NullableDomain;
  rawDomains: SeriesDomainObject;
  filteredValues: SeriesValueObject;
  gradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
  onFocus: (focus: SeriesFocusUpdate) => void;
  /** Reports shape clicks up to the chart's `onSeriesClick`; null when that callback is unset. */
  onSeriesShapeClick: ((seriesId: string, categoryIndex: number, event: Event) => void) | null;
  /** When true, the decorative series geometry is hidden from assistive tech. */
  accessibility: boolean;
  /** Whether this series holds the container's roving tab stop. */
  tabStop: boolean;
}

interface SeriesState {
  seriesPositionData: SeriesPositionData | null;
  onSeriesEnter: (event: Event) => void;
  onSeriesLeave: () => void;
  onSeriesClick: (event: Event) => void;
  onCategoryEnter: (categoryIndex: number) => void;
  onCategoryLeave: (categoryIndex: number) => void;
  onCategoryClick: (categoryIndex: number, event: Event) => void;
}

interface BarHandle { root: El }

const barAdapter: ElListAdapter<CategoryShape, BarHandle> = {
  key: (bar: CategoryShape) => bar.key,
  create: () => ({ root: svgEl('path') }),
  update: (handle: BarHandle, bar: CategoryShape) => {
    handle.root.set(bar.attrs);
  }
};

export default class Series extends Renderer<SeriesProps, SeriesState> {
  root = svgEl('g');
  shape = this.elSlot(this.root);
  rangeShape = this.elSlot(this.root); // second line of a ranged line series
  errorBars = this.slot(this.root); // declaration order fixes DOM order: shape, then error bars, then markers/labels above them
  markers = this.slot(this.root);
  labels = this.slot(this.root);
  barsGroup = svgEl('g');
  bars = new ElList<CategoryShape, BarHandle>(this.barsGroup.node, null);
  barShapes = new CategoryShapeCache('seriesBar', () => this.state);
  // leave mirrors the enter that actually fired: an ignored touch enter must not clear focus set elsewhere
  hoverActive = false;

  constructor() {
    super();
    this.state = { seriesPositionData: null, onSeriesEnter: noOp, onSeriesLeave: noOp, onSeriesClick: noOp,
      onCategoryEnter: noOpCategory, onCategoryLeave: noOpCategory, onCategoryClick: noOpCategory };
  }

  derive(props: SeriesProps, state: SeriesState, prevProps: SeriesProps | null): Partial<SeriesState> | null {
    if (prevProps === null) {
      const initial = this.computeSeriesPositionData(props);
      const { seriesPositionData } = initial;
      return { ...initial, ...this.buildEventListeners(props, seriesPositionData) };
    }
    const { categoryAxisConfig, seriesConfig, focusData, onFocus, onSeriesShapeClick, categoryValueData, valueAxisScale, filteredValues } = props;
    let categoryFocusChanged = false;
    let seriesFocusChanged = false;
    let { seriesPositionData } = state;
    if (focusData !== prevProps.focusData) {
      if (focusData === null || prevProps.focusData === null) {
        categoryFocusChanged = true;
        seriesFocusChanged = true;
      }
      else {
        categoryFocusChanged = focusData.focusedCategoryIndex !== prevProps.focusData.focusedCategoryIndex;
        seriesFocusChanged = focusData.focusedSeriesId !== prevProps.focusData.focusedSeriesId;
      }
    }
    const oldValueAxisScale = prevProps.valueAxisScale;
    let valueAxisScaleChanged = false;
    if (valueAxisScale !== oldValueAxisScale) {
      if (valueAxisScale === null || oldValueAxisScale === null) {
        valueAxisScaleChanged = true;
      }
      else {
        valueAxisScaleChanged = !areArraysAndEqual(valueAxisScale.domain(), oldValueAxisScale.domain()) ||
                                 !areArraysAndEqual(valueAxisScale.range(), oldValueAxisScale.range());
      }
    }

    let delta: Partial<SeriesState> = {};
    let updateState = false;
    let positionsChanged = false;
    if (categoryAxisConfig !== prevProps.categoryAxisConfig || seriesConfig !== prevProps.seriesConfig ||
      categoryValueData !== prevProps.categoryValueData || valueAxisScaleChanged || filteredValues !== prevProps.filteredValues) {
      delta = this.computeSeriesPositionData(props);
      seriesPositionData = delta.seriesPositionData ?? null;
      positionsChanged = true;
      updateState = true;
    }
    // positionsChanged: the category-index listeners close over skipCategoryIndexMap
    if (positionsChanged || categoryFocusChanged || seriesFocusChanged || onFocus !== prevProps.onFocus || onSeriesShapeClick !== prevProps.onSeriesShapeClick) {
      delta = { ...delta, ...this.buildEventListeners(props, seriesPositionData) };
      updateState = true;
    }
    return updateState ? delta : null;
  }

  buildEventListeners(props: SeriesProps, seriesPositionData: SeriesPositionData | null): Pick<SeriesState, 'onSeriesEnter' | 'onSeriesLeave' | 'onSeriesClick' | 'onCategoryEnter' | 'onCategoryLeave' | 'onCategoryClick'> {
    const { seriesConfig, focusData, onFocus, onSeriesShapeClick } = props;
    // a follower series (followSeries) focuses as its leader, so clicking a
    // candlestick wick focuses (and toggles) the whole candle
    const seriesId = seriesConfig.followSeries ?? seriesConfig.id;
    const focusedCategoryIndex = focusData ? focusData.focusedCategoryIndex : -1;
    const focusedSeriesId = focusData ? focusData.focusedSeriesId : null;
    const skipCategoryIndexMap = seriesPositionData ? seriesPositionData.skipCategoryIndexMap : {};
    const getCategoryIndex = seriesPositionData?.skipped ? (categoryIndex: number) => skipCategoryIndexMap[categoryIndex] : (categoryIndex: number) => categoryIndex;

    let onSeriesEnter: SeriesState['onSeriesEnter'] = noOp;
    let onSeriesLeave = noOp;
    let onSeriesClick: SeriesState['onSeriesClick'] = noOp;
    let onCategoryEnter = noOpCategory;
    let onCategoryLeave = noOpCategory;
    let onCategoryClick: SeriesState['onCategoryClick'] = noOpCategory;

    if (seriesConfig.focusOnHover) {
      onSeriesEnter = (event: Event) => { if (isHoverPointer(event)) { this.hoverActive = true; onFocus({ seriesId }); } };
      onSeriesLeave = () => { if (this.hoverActive) { this.hoverActive = false; onFocus({ seriesId: null }); } };
      if (seriesConfig.focusCategoryOnHover) {
        onCategoryEnter = (categoryIndex: number) => { onFocus({ seriesId, categoryIndex: getCategoryIndex(categoryIndex) }); };
        onCategoryLeave = (_categoryIndex: number) => { onFocus({ seriesId: null, categoryIndex: null }); };
      }
      else {
        onCategoryEnter = (_categoryIndex: number) => { onFocus({ seriesId }); };
        onCategoryLeave = (_categoryIndex: number) => { onFocus({ seriesId: null }); };
      }
    }
    else if (seriesConfig.focusCategoryOnHover) {
      onCategoryEnter = (categoryIndex: number) => { onFocus({ categoryIndex: getCategoryIndex(categoryIndex) }); };
      onCategoryLeave = (_categoryIndex: number) => { onFocus({ categoryIndex: null }); };
    }
    // clicks toggle focus per the focus*OnClick configs, and (independently)
    // report up to onSeriesClick when it is set — same pattern as PieSeries
    if (seriesConfig.focusOnClick || onSeriesShapeClick !== null) {
      onSeriesClick = (event: Event) => {
        if (seriesConfig.focusOnClick) {
          onFocus({ seriesId: seriesId === focusedSeriesId ? null : seriesId });
        }
        onSeriesShapeClick?.(seriesId, -1, event);
      };
      onCategoryClick = (categoryIndex: number, event: Event) => {
        const dataCategoryIndex = getCategoryIndex(categoryIndex);
        if (seriesConfig.focusOnClick) {
          onFocus(seriesConfig.focusCategoryOnClick
            ? { seriesId: seriesId === focusedSeriesId ? null : seriesId, categoryIndex: dataCategoryIndex === focusedCategoryIndex ? -1 : dataCategoryIndex }
            : { seriesId: seriesId === focusedSeriesId ? null : seriesId });
        }
        else if (seriesConfig.focusCategoryOnClick) {
          onFocus({ categoryIndex: dataCategoryIndex === focusedCategoryIndex ? -1 : dataCategoryIndex });
        }
        onSeriesShapeClick?.(seriesId, dataCategoryIndex, event);
      };
    }
    else if (seriesConfig.focusCategoryOnClick) {
      onCategoryClick = (categoryIndex: number) => { onFocus({ categoryIndex: getCategoryIndex(categoryIndex) === focusedCategoryIndex ? -1 : getCategoryIndex(categoryIndex) }); };
    }

    return { onSeriesEnter, onSeriesLeave, onSeriesClick, onCategoryEnter, onCategoryLeave, onCategoryClick };
  }

  onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      // activation is the focus toggle / onSeriesClick only: the tooltip belongs to the plot rect
      this.state.onSeriesClick(event);
    }
  }

  computeSeriesPositionData(props: SeriesProps): Pick<SeriesState, 'seriesPositionData'> {
    const { categoryAxisConfig, seriesConfig, categoryValueData, valueAxisScale, filteredValues, seriesLayoutInfo } = props;
    const seriesPositionData = filteredValues.plain !== null ? getSeriesPositionData(categoryAxisConfig, seriesConfig, categoryValueData, valueAxisScale, filteredValues, seriesLayoutInfo) : null;
    return {
      seriesPositionData
    };
  }

  create() {
    return this.root.node;
  }

  sync() {
    const { colorPaletteConfig, seriesConfig, seriesIndex, stackData, seriesLayoutInfo, focusData, valueAxisScale, rawValueAxisDomain, filteredValues, rawDomains, gradientIdMap, patternIdMap } = this.props;
    const { seriesPositionData, onSeriesEnter, onSeriesLeave, onSeriesClick, onCategoryEnter, onCategoryLeave, onCategoryClick } = this.state;

    const seriesId = seriesConfig.id;

    if (filteredValues.plain !== null && seriesPositionData !== null && focusData !== null) {
      const { inverted } = seriesLayoutInfo;
      const { categoryFocusPercentages, valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
      const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);

      const seriesStrokeColor = getSeriesStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
      let seriesFillColor = seriesConfig.renderer === RENDERER_LINE ? 'none' : getSeriesFillColor(colorPaletteConfig, seriesConfig, seriesIndex, seriesFocusPercentage);
      let seriesColorGenerator = null;
      if (seriesConfig.colorProperty !== NONE) {
        seriesColorGenerator = getSeriesColorGenerator(seriesConfig, rawDomains, filteredValues);
      }
      const { strokeWidth: seriesStrokeWidth, strokeDashArray: seriesStrokeDashArray, strokeOpacity: seriesStrokeOpacity, fillOpacity: seriesFillOpacity } = getFocusStyle(seriesFocusPercentage, seriesConfig.shapeStyle);

      if (seriesConfig.renderer === RENDERER_LINE) {
        const lineGenerator = getLineGenerator(seriesConfig, seriesPositionData, inverted);
        this.shape.set('line', () => svgEl('path'))!.set({
          d: lineGenerator(), className: mochartCssClasses['seriesLine'], strokeWidth: seriesStrokeWidth,
          strokeDasharray: seriesStrokeDashArray, stroke: seriesStrokeColor, strokeOpacity: seriesStrokeOpacity, fill: seriesFillColor,
          onPointerEnter: onSeriesEnter, onPointerLeave: onSeriesLeave, onClick: onSeriesClick });
        if (seriesConfig.rangeProperty !== NONE) { // a ranged line series draws its rangeProperty bound as a second line
          const rangeLineGenerator = getRangeLineGenerator(seriesConfig, seriesPositionData, inverted);
          this.rangeShape.set('line', () => svgEl('path'))!.set({
            d: rangeLineGenerator(), className: mochartCssClasses['seriesLine'], strokeWidth: seriesStrokeWidth,
            strokeDasharray: seriesStrokeDashArray, stroke: seriesStrokeColor, strokeOpacity: seriesStrokeOpacity, fill: seriesFillColor,
            onPointerEnter: onSeriesEnter, onPointerLeave: onSeriesLeave, onClick: onSeriesClick });
        }
        else {
          this.rangeShape.set(null);
        }
      }
      else if (seriesConfig.renderer === RENDERER_AREA) {
        if (seriesConfig.pattern !== NONE) {
          seriesFillColor = getPatternReference(patternIdMap[seriesConfig.id]);
        }
        else if (seriesConfig.gradient !== NONE) {
          seriesFillColor = getGradientReference(gradientIdMap[seriesConfig.gradient]);
        }
        const areaGenerator = getAreaGenerator(seriesConfig, seriesPositionData, inverted);
        this.shape.set('area', () => svgEl('path'))!.set({
          d: areaGenerator(), className: mochartCssClasses['seriesArea'], strokeWidth: seriesStrokeWidth,
          strokeDasharray: seriesStrokeDashArray,
          stroke: seriesStrokeColor, strokeOpacity: seriesStrokeOpacity, fill: seriesFillColor, fillOpacity: seriesFillOpacity,
          onPointerEnter: onSeriesEnter, onPointerLeave: onSeriesLeave, onClick: onSeriesClick });
        this.rangeShape.set(null);
      }
      else if (seriesConfig.renderer === RENDERER_BAR) {
        const bars: CategoryShape[] = [];
        const columnGenerator = getColumnGenerator(seriesConfig, seriesPositionData, inverted, stackData);
        let barStrokeColor = seriesStrokeColor;
        let barFillColor = seriesFillColor;
        const patterned = seriesConfig.pattern !== NONE;
        if (patterned) {
          barFillColor = getPatternReference(patternIdMap[seriesConfig.id]);
        }
        else if (seriesConfig.gradient !== NONE) {
          barFillColor = getGradientReference(gradientIdMap[seriesConfig.gradient]);
        }
        // any state may name categoryIndex, and the state in force changes with the focus, so all three decide
        const hasDifferentStrokeColors = usesCategoryIndexColor(seriesConfig.shapeStyle, 'strokeColor');
        const hasDifferentFillColors = usesCategoryIndexColor(seriesConfig.shapeStyle, 'fillColor');
        const hasDifferentColors = hasDifferentStrokeColors || hasDifferentFillColors;
        let focusPercentage;
        const { skipped, skipCategoryIndexMap } = seriesPositionData;

        for (let i = 0; i < seriesPositionData.length; i++) {
          if (seriesPositionData.getDefined(null, i)) {
            // Positions may be compacted, but focus and color values stay
            // indexed by the raw category index.
            const skipI = skipped ? skipCategoryIndexMap[i] : i;
            focusPercentage = getCategoryFocusPercentage(categoryFocusPercentages[skipI], seriesFocusPercentage);
            if (seriesColorGenerator !== null) {
              // null = colorScale.missing is null: keep the series' own colors
              const generatedColor = seriesColorGenerator(skipI);
              barStrokeColor = generatedColor !== null ? generatedColor : seriesStrokeColor;
              if (!patterned) {
                barFillColor = generatedColor !== null ? generatedColor : seriesFillColor;
              }
            }
            else if (hasDifferentColors) {
              // the non-categoryIndex member still follows the per-bar focus, like the branch below
              const categoryFocused = focusPercentage !== seriesFocusPercentage;
              if (hasDifferentStrokeColors) {
                barStrokeColor = getSeriesStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
              }
              else {
                barStrokeColor = categoryFocused ? getSeriesStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage) : seriesStrokeColor;
              }
              if (!patterned) {
                if (hasDifferentFillColors) {
                  barFillColor = getSeriesFillColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
                }
                else if (seriesConfig.gradient === NONE) {
                  barFillColor = categoryFocused ? getSeriesFillColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage) : seriesFillColor;
                }
              }
            }
            else if (focusPercentage !== seriesFocusPercentage) {
              barStrokeColor = getSeriesStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage);
              if (seriesConfig.gradient === NONE && !patterned) {
                barFillColor = getSeriesFillColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage);
              }
            }
            else {
              barStrokeColor = seriesStrokeColor;
              if (seriesConfig.gradient === NONE && !patterned) {
                barFillColor = seriesFillColor;
              }
            }
            const { strokeWidth: barStrokeWidth, strokeDashArray: barStrokeDashArray, strokeOpacity: barStrokeOpacity, fillOpacity: barFillOpacity } = getFocusStyle(focusPercentage, seriesConfig.shapeStyle);
            const bar = this.barShapes.get(i);
            bar.attrs = { d: columnGenerator(i), className: bar.className,
              onPointerEnter: bar.onPointerEnter, onPointerLeave: bar.onPointerLeave, onClick: bar.onClick,
              stroke: barStrokeColor, strokeWidth: barStrokeWidth, strokeOpacity: barStrokeOpacity,
              strokeDasharray: barStrokeDashArray, fill: barFillColor, fillOpacity: barFillOpacity };
            bars.push(bar);
          }
        }
        this.shape.set('bars', () => this.barsGroup);
        this.bars.sync(bars, barAdapter);
        this.rangeShape.set(null);
      }
      else {
        // RENDERER_NONE (or anything unrecognized) renders no shape
        this.shape.set(null);
        this.rangeShape.set(null);
      }

      this.setPresent(true);
      // followers stay pointer-only — their clicks route to the leader
      const interactive = seriesIsInteractive(this.props.accessibility, seriesConfig, this.props.onSeriesShapeClick);
      this.root.set({ className: mochartCssClasses['series'] + seriesId,
        ariaHidden: this.props.accessibility && !interactive ? 'true' : null,
        dataSeriesId: interactive ? seriesId : null,
        tabindex: interactive ? (this.props.tabStop ? '0' : '-1') : null,
        role: interactive ? 'button' : null,
        ariaLabel: interactive ? getSeriesTitle(seriesConfig) : null,
        onKeyDown: interactive ? this.onKeyDown : null,
        cursor: seriesConfig.showPointer ? 'pointer' : null, // inherited: covers bars, markers, labels and paths
        transform: translateObject(seriesLayoutInfo) });
      this.errorBars.set(SeriesErrorBars, { colorPaletteConfig, seriesConfig, seriesIndex,
        seriesPositionData, valueAxisScale, filteredValues, inverted, focusData });
      this.markers.set(SeriesMarkers, { colorPaletteConfig, seriesConfig, seriesPositionData,
        filteredValues, rawDomains, inverted, seriesIndex,
        focusData, onCategoryEnter, onCategoryLeave, onCategoryClick });
      this.labels.set(SeriesLabels, { colorPaletteConfig, seriesConfig, valueAxisScale,
        rawValueAxisDomain, seriesPositionData, filteredValues, inverted,
        focusData, onCategoryEnter, onCategoryLeave, onCategoryClick, seriesIndex,
        accessibility: this.props.accessibility });
    }
    else {
      this.setPresent(false);
    }
  }
}
