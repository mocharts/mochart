import { Renderer, svgEl, htmlEl, El } from '../render';
import type { ElSlot, RendererItem, RendererList, Slot } from '../render';

import { getVersionString } from '../version';
import { hasConfigStructureChange } from '../config/core/mochartConfig';
import { isDataProviderValid, getCategorySeriesValueObject, getChartDataCategoryCount } from '../data/ChartData';
import { indexOfCategoryValue } from '../animation/CategoryAnimationData';
import type { CategorySeriesValueObject } from '../data/ChartData';
import { getChartLayoutInfo, getChartLayoutInfoWithMutations } from '../layout/ChartLayout';
import { getTooltipLayoutInfo, getTooltipLayoutInfoWithMutations } from '../layout/TooltipLayout';
import { getAxisData, getAxisDataWithMutations, getAxisDataForCategoryChange, getAxisDataForSeriesChange } from '../data/AxisData';
import { getStackData, getStackDataWithMutations } from '../data/StackData';
import { getChartTextBoundsData, getChartTextBoundsDataWithMutations, getTooltipBounds, getBoundsWithMutations } from '../utils/TextMeasurement';
import { mochartCssClasses, mochartVersionAttribute, getDomAccessors } from '../utils/ChartDom';
import { CHART_TYPE_PIE } from '../config/core/constants';

import Background from './Background';
import Title from './Title';
import Plot from './Plot';
import RadialPlot from './RadialPlot';
import PlotEmpty from './PlotEmpty';
import Legend from './Legend';
import LegendClip from './LegendClip';
import Tooltip from './Tooltip';
import TooltipClip from './TooltipClip';
import TitleClip from './TitleClip';
import AxisTitleClip from './AxisTitleClip';
import CategoryAxisTickLabelClip from './CategoryAxisTickLabelClip';
import SeriesClip from './SeriesClip';
import { getClippedEdgesWithMutations, noClippedEdges } from '../data/ClipData';
import SeriesColorGradient from './SeriesColorGradient';
import LinearGradient from './LinearGradient';
import RadialGradient from './RadialGradient';
import Pattern from './Pattern';
import { accessibilityActive, focusRestored, translateObject } from '../utils/utils';
import { getSeriesFillColor, getSeriesGradientColors } from '../utils/SeriesColors';
import { getTooltipAnnouncement } from '../utils/TooltipFormat';
import type { ChartFactoryContent, ChartFactoryContext, ChartContentFactory, ChartEventPayload, ChartSeriesClickPayload, ChartSliceClickPayload, InternalFocus } from '../types/chart';
import type { LinearGradientConfig, PatternConfig, RadialGradientConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisData, ChartData, ClippedEdges, DataProvider, StackData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { ChartLayoutInfo, ChartTextBoundsData, LayoutInfo } from '../types/layout';
import type { Bounds, Size } from '../types/geometry';

export interface ChartProps {
  // both null while the host is still loading them; the chart renders its loading/error states then
  mochartConfig: EnhancedMochartConfig | null;
  /** The host's own provider: what the state factories receive. */
  dataProvider: DataProvider | null;
  /** What the chart's own loading/error reads use; a fresh identity per refresh() so they re-run. Defaults to dataProvider. */
  readDataProvider?: DataProvider | null;
  chartData: ChartData | null;
  focusData: FocusData | null;
  /** 0..1 while the initial value tween runs (pie sweep-in), else null. */
  initialAnimationPercentage?: number | null;
  width: number;
  height: number;
  standalone?: boolean;
  style?: string | Record<string, string | number | null | undefined>;
  loading?: boolean;
  error?: unknown;
  onSeriesLayoutBoundsChange?: (bounds: Bounds) => void;
  onFocus?: (focus: InternalFocus) => void;
  onSeriesFilter?: (seriesId: string) => void;
  onChartClick?: (payload: ChartEventPayload) => void;
  onSliceClick?: (payload: ChartSliceClickPayload) => void;
  onSeriesClick?: (payload: ChartSeriesClickPayload) => void;
  onChartMouseEnter?: (payload: ChartEventPayload) => void;
  onChartMouseMove?: (payload: ChartEventPayload) => void;
  onChartMouseLeave?: (payload: ChartEventPayload) => void;
  onTitleClick?: () => void;
  getLoadingComponent?: ChartContentFactory;
  getErrorComponent?: ChartContentFactory;
  getNoDataComponent?: ChartContentFactory;
  getNoSizeComponent?: ChartContentFactory;
  getNoSeriesComponent?: ChartContentFactory;
  getConfigErrorComponent?: ChartContentFactory;
}

interface ChartUniqueIds {
  svgUniqueId: string;
  tooltipClipPathUniqueId: string;
  titleClipPathUniqueId: string;
  legendClipPathUniqueId: string;
  categoryAxisTitleClipPathUniqueId: string;
  categoryAxisTickLabelClipPathUniqueId: string;
  valueAxisTitleClipPathUniqueIds: Record<string, string>;
  seriesClipPathUniqueId: string;
  clipIndicatorPatternUniqueId: string;
  seriesColorGradientUniqueIds: Record<string, string>;
  gradientIdMap: Record<string, string>;
  linearGradientIdMap: Record<string, string>;
  radialGradientIdMap: Record<string, string>;
  patternIdMap: Record<string, string>;
}

interface ChartState {
  uniqueIds: ChartUniqueIds | null;
  layoutInfo: ChartLayoutInfo | null;
  tooltipLayoutInfo: Bounds | null;
  chartTextBoundsData: ChartTextBoundsData;
  tooltipBounds: Size | null;
  axisData: AxisData | null;
  stackData: StackData | null;
  clippedEdges: ClippedEdges;
  tooltipVisible: boolean;
  tooltipCategoryIndex: number;
  tooltipCategoryPercentage: number | null;
  tooltipSeriesPercentage: number | null;
  tooltipValueObject: CategorySeriesValueObject | null;
}

type ChartStateUpdate = Partial<ChartState>;
type ChartPointCallback = (chartX: number, chartY: number) => void;
// taps arrive as the browser's synthesized mouse events, so this is the only pointer event type the chart root sees
type ChartPointerEvent = MouseEvent;
type FactoryContent = ChartFactoryContent | El;
type FactoryEl = El & { _factory?: ChartContentFactory | null; _factoryContext?: ChartFactoryContext | null };

const emptyFilteredFlags = {};
const emptyAxisSeriesCounts: Record<string, number> = {};

const mochartChartIdPrefix = '__mochart__chart__';
const tooltipClipPathIdPrefix = 'tooltip__clippath__';
const titleClipPathIdPrefix = 'title__clippath__';
const legendClipPathIdPrefix = 'legend__clippath__';
const categoryAxisTitleClipPathIdPrefix = 'categoryaxistitle__clippath__';
const categoryAxisTickLabelClipPathIdPrefix = 'categoryaxisticklabel__clippath__';
const valueAxisTitleClipPathIdPrefix = 'valueaxistitle__clippath__';
const seriesClipPathIdPrefix = 'series__clippath__';
const clipIndicatorPatternIdPrefix = 'clipindicator__pattern__';
const linearGradientIdPrefix = 'linear__gradient__';
const radialGradientIdPrefix = 'radial__gradient__';
const seriesPatternIdPrefix = 'series__pattern__';
const seriesColorGradientIdPrefix = 'seriescolor__gradient__';
// on the global registry, not module state: two bundled copies of the library share one document's ids
const chartInstanceCounterKey = Symbol.for('mochart.chartInstanceCounter');
function nextChartInstanceId(): string {
  const scope = globalThis as unknown as Record<symbol, number | undefined>;
  const instance = (scope[chartInstanceCounterKey] ?? 0) + 1;
  scope[chartInstanceCounterKey] = instance;
  return '' + instance;
}

// Shared body for the getXxxComponent factory defaults (they return a DOM Node or string): fills the box,
// flex-centers the message (table-cell centering silently failed at 0-size), and quiets content drawing
// behind it with a color-agnostic blur + faint currentColor tint.
function buildMessageDiv(width: number, height: number, message: string): Node {
  const el = htmlEl('div');
  el.set({ style: {
    width: width > 0 ? width : '100%',
    height: height > 0 ? height : '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0 16px',
    boxSizing: 'border-box',
    overflowWrap: 'anywhere',
    backdropFilter: 'blur(3px)',
    background: 'color-mix(in srgb, currentColor 4%, transparent)'
  } });
  el.node.textContent = message;
  return el.node;
}

function getLoadingComponent({ width, height }: ChartFactoryContext): Node {
  return buildMessageDiv(width, height, 'Loading...');
}

// A provided error (including '' or 0) is the error state; null/undefined are not.
function isErrorActive(error: unknown): boolean {
  return error != null;
}

// Error instances show their message; JSON.stringify can throw (circular refs), so fall back to String.
function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === 'object') {
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return String(error);
}

function getErrorComponent({ width, height, error }: ChartFactoryContext): Node {
  const errorMessage = isErrorActive(error) ? formatErrorMessage(error) : 'Invalid Chart Config';
  return buildMessageDiv(width, height, errorMessage);
}

function getNoDataComponent({ width, height }: ChartFactoryContext): Node {
  return buildMessageDiv(width, height, 'No Data');
}

function getNoSizeComponent({ width, height }: ChartFactoryContext): Node {
  return buildMessageDiv(width, height, 'No Size');
}

function getNoSeriesComponent({ width, height }: ChartFactoryContext): Node {
  return buildMessageDiv(width, height, 'No Series');
}

function getConfigErrorComponent({ width, height }: ChartFactoryContext): Node {
  return buildMessageDiv(width, height, 'Mochart Config Error');
}

/** Normalize factory-produced content (Node | El | string | falsy) to a DOM node; null for falsy content. */
function factoryContentToNode(content: FactoryContent): Node | null {
  if (content === null || content === undefined || content === false) {
    return null;
  }
  if (content instanceof El) {
    return content.node;
  }
  if (typeof content === 'string' || typeof content === 'number') {
    return document.createTextNode(String(content));
  }
  return content;
}

/** True when a state factory would see the same inputs: same factory, same six context members. */
function sameFactoryInputs(
  lastFactory: ChartContentFactory | null | undefined, lastContext: ChartFactoryContext | null | undefined,
  factory: ChartContentFactory | null, context: ChartFactoryContext
): boolean {
  return lastFactory === factory && lastContext != null
    && lastContext.width === context.width && lastContext.height === context.height
    && lastContext.mochartConfig === context.mochartConfig && lastContext.dataProvider === context.dataProvider
    && lastContext.error === context.error && lastContext.hasData === context.hasData;
}

/** Replace a container's children with a factory's content; runs the factory only when its inputs changed. */
function syncFactoryContent(containerEl: FactoryEl, factory: ChartContentFactory, context: ChartFactoryContext): void {
  if (sameFactoryInputs(containerEl._factory, containerEl._factoryContext, factory, context)) {
    return;
  }
  containerEl._factory = factory;
  containerEl._factoryContext = context;
  const containerNode = containerEl.node;
  while (containerNode.firstChild) {
    containerNode.removeChild(containerNode.firstChild);
  }
  const node = factoryContentToNode(factory(context));
  if (node) {
    containerNode.appendChild(node);
  }
}

function getBoundsForSeriesLayoutInfo(seriesLayoutInfo: LayoutInfo): Bounds {
  return {
    x: seriesLayoutInfo.x, y: seriesLayoutInfo.y,
    width: seriesLayoutInfo.width, height: seriesLayoutInfo.height
  };
}

function getBoundsAreDifferent(oldBounds: Bounds, newBounds: Bounds): boolean {
  return oldBounds.x !== newBounds.x || oldBounds.y !== newBounds.y || oldBounds.width !== newBounds.width || oldBounds.height !== newBounds.height;
}

const getInitialState = (): ChartState => ({
  uniqueIds: null, layoutInfo: null, tooltipLayoutInfo: null, chartTextBoundsData: {} as ChartTextBoundsData, axisData: null, stackData: null, clippedEdges: noClippedEdges,
  ...getInitialTooltipState()
});

const getInitialTooltipState = (): Pick<ChartState, 'tooltipVisible' | 'tooltipCategoryIndex' | 'tooltipCategoryPercentage' | 'tooltipSeriesPercentage' | 'tooltipValueObject' | 'tooltipBounds'> => ({
  tooltipVisible: false,
  tooltipCategoryIndex: -1,
  tooltipCategoryPercentage: null,
  tooltipSeriesPercentage: null,
  tooltipValueObject: null,
  tooltipBounds: null
});

/**
 * The body of a valid chart: the svg (defs, background, title, plot, legend) plus the html overlay
 * containers and the tooltip. A pass-through renderer so the pieces sit directly under the chart's root div.
 */
interface ChartBodyProps {
  chart: Chart;
  /** The rendered config: sync() only mounts the body once it is non-null and valid. */
  mochartConfig: EnhancedMochartConfig;
  /** Change tokens that force the pass-through body to resync with its owner. */
  chartProps: ChartProps;
  chartState: ChartState;
  error: unknown;
  loading: boolean;
}

class ChartBody extends Renderer<ChartBodyProps> {
  svg!: El;
  defs!: El;
  clips!: RendererList;
  seriesColorGradients!: RendererList;
  linearGradients!: RendererList;
  radialGradients!: RendererList;
  patterns!: RendererList;
  background!: Slot;
  title!: Slot;
  contentGroup!: El;
  plot!: Slot;
  plotEmpty!: Slot;
  legend!: Slot;
  svgSlot!: ElSlot;
  noDataSlot!: ElSlot;
  noSeriesSlot!: ElSlot;
  loadingSlot!: ElSlot;
  tooltip!: Slot;
  liveRegionSlot!: ElSlot;
  // inputs of the last gradient/pattern defs sync; they only change with the config
  defsConfig: EnhancedMochartConfig | null = null;
  defsUniqueIds: ChartUniqueIds | null = null;
  create() {
    this.svg = svgEl('svg');
    this.defs = svgEl('defs');
    this.svg.append(this.defs);
    this.clips = this.rendererList(this.defs);
    this.seriesColorGradients = this.rendererList(this.defs);
    this.linearGradients = this.rendererList(this.defs);
    this.radialGradients = this.rendererList(this.defs);
    this.patterns = this.rendererList(this.defs);
    this.background = this.slot(this.svg);
    this.title = this.slot(this.svg);
    this.contentGroup = svgEl('g');
    this.svg.append(this.contentGroup);
    this.plot = this.slot(this.contentGroup);
    this.plotEmpty = this.slot(this.contentGroup);
    this.legend = this.slot(this.contentGroup);

    this.svgSlot = this.elSlot();
    this.noDataSlot = this.elSlot();
    this.noSeriesSlot = this.elSlot();
    this.loadingSlot = this.elSlot();
    this.tooltip = this.slot();
    this.liveRegionSlot = this.elSlot();
    return null;
  }

  sync() {
    const { chart } = this.props;
    chart.syncBody(this);
  }
}

const defaultChartStyle = { position: 'relative' };

// the tooltip and live region are positioned against the root, so a caller's style layers over the default; their own position still wins
function withDefaultChartStyle(style: ChartProps['style']): ChartProps['style'] {
  if (style === undefined) {
    return defaultChartStyle;
  }
  // later declarations win in cssText, as later keys do in the merged object
  return typeof style === 'string' ? 'position: relative;' + style : { ...defaultChartStyle, ...style };
}

// visually hidden but still read by assistive tech (the clipped-1px-box idiom)
const liveRegionStyle = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, border: 0,
  overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap'
};

// long enough to swallow a key repeat, short enough that a deliberate step still speaks promptly
const announceSettleDelay = 150;

export default class Chart extends Renderer<ChartProps, ChartState> {
  root = htmlEl('div');
  simpleContent = this.elSlot(this.root);
  body = this.slot(this.root);
  uniqueId: string;
  chartRef: Element | null = null;
  chartRectRef: Element | null = null;
  /** the no-data/error/loading message region while it is focusable: the fallback stop when a teardown removes the plot */
  messageRef: HTMLElement | null = null;
  isMouseWithinChart = false;
  chartEventHandler: Record<string, (event: ChartPointerEvent) => void>;
  _simpleFactory: ChartContentFactory | null = null;
  _simpleFactoryContext: ChartFactoryContext | null = null;
  /** what the last factory call put in the root: a fragment's children, recorded before insertion empties it */
  _simpleNodes: Node[] = [];

  constructor() {
    super();
    this.uniqueId = nextChartInstanceId();
    this.state = getInitialState();

    // set while the full chart body is rendered (mirrors the old render ref)
    this.chartRef = null;
    this.chartRectRef = null;
    this.isMouseWithinChart = false;

    // event handler used on the chart during render
    this.chartEventHandler = {
      onMouseEnter: (event: ChartPointerEvent) => {
        this.processChartMotionEvent(event);
      },
      onMouseMove: (event: ChartPointerEvent) => {
        this.processChartMotionEvent(event);
      },
      onMouseLeave: (event: ChartPointerEvent) => {
        this.processChartMotionEvent(event);
      },
      onClick: (event: ChartPointerEvent) => {
        this.processChartEvent(event, this.onChartClick);
      }
    };
  }

  processChartMotionEvent(event: ChartPointerEvent): void {
    if (this.isMouseWithinChart) {
      this.processChartEvent(event, this.onChartMouseMove, (chartX, chartY) => {
        this.isMouseWithinChart = false;
        this.onChartMouseLeave(chartX, chartY);
      });
    }
    else {
      this.processChartEvent(event, (chartX, chartY) => {
        this.isMouseWithinChart = true;
        this.onChartMouseEnter(chartX, chartY);
      });
    }
  }

  processChartEvent(event: ChartPointerEvent, mouseInCallback: ChartPointCallback, mouseOutCallback?: ChartPointCallback): void {
    // no plot rect to map onto: a child handler (a legend click) destroyed the chart before the event bubbled here
    if (this.chartRectRef === null) {
      return;
    }
    const { x, y, withinPlot } = this.toPlotLocalPoint(event.clientX, event.clientY);
    if (withinPlot) {
      mouseInCallback(x, y);
    }
    else if (mouseOutCallback) {
      mouseOutCallback(x, y);
    }
  }

  /** Client coordinates to plot-local SVG units: the rect is CSS pixels, the extents are logical. */
  toPlotLocalPoint(clientX: number, clientY: number): { x: number; y: number; withinPlot: boolean } {
    const plotRect = this.chartRectRef!.getBoundingClientRect();
    const seriesLayoutInfo = this.state.layoutInfo?.seriesLayoutInfo ?? null;
    const width = seriesLayoutInfo !== null ? seriesLayoutInfo.width : plotRect.width;
    const height = seriesLayoutInfo !== null ? seriesLayoutInfo.height : plotRect.height;
    const scaleX = plotRect.width > 0 ? width / plotRect.width : 1;
    const scaleY = plotRect.height > 0 ? height / plotRect.height : 1;
    const x = (clientX - plotRect.left) * scaleX;
    const y = (clientY - plotRect.top) * scaleY;
    return { x, y, withinPlot: x > 0 && y > 0 && x < width && y < height };
  }

  /** Non-null whenever chartRef, the chart body or a computed layout exist — sync() and init() gate all three on a valid config. */
  private renderedConfig(): EnhancedMochartConfig {
    return this.props.mochartConfig!;
  }

  /** Finalize a state delta carrying a new layoutInfo: reuse unchanged layout identities, queue
   * onSeriesLayoutBoundsChange when the series area moved, and refresh the tooltip layout. */
  applyLayoutInfo(mochartConfig: EnhancedMochartConfig, state: ChartStateUpdate & { layoutInfo: ChartLayoutInfo | null }): ChartStateUpdate {
    if (state.layoutInfo !== null) {
      state.layoutInfo = getChartLayoutInfoWithMutations(this.state.layoutInfo, state.layoutInfo);
      if (this.state.layoutInfo !== state.layoutInfo) {
        const newBounds = getBoundsForSeriesLayoutInfo(state.layoutInfo.seriesLayoutInfo);
        if (this.state.layoutInfo === null) {
          this.pendingSeriesLayoutBounds = newBounds;
        }
        else if (state.layoutInfo.seriesLayoutInfo !== this.state.layoutInfo.seriesLayoutInfo) {
          const oldBounds = getBoundsForSeriesLayoutInfo(this.state.layoutInfo.seriesLayoutInfo);
          if (getBoundsAreDifferent(oldBounds, newBounds)) {
            this.pendingSeriesLayoutBounds = newBounds;
          }
        }
      }
      state.tooltipLayoutInfo = getTooltipLayoutInfoWithMutations(this.state.tooltipLayoutInfo,
        this.getTooltipLayoutInfo(mochartConfig, state));
    }
    return state;
  }

  getTooltipLayoutInfo(mochartConfig: EnhancedMochartConfig, state: ChartStateUpdate): Bounds {
    const { layoutInfo, axisData, tooltipCategoryIndex, tooltipSeriesPercentage, tooltipCategoryPercentage, tooltipBounds } =
      { ...this.state, ...state };

    const categoryValueData = axisData?.category?.valueData;
    if (tooltipBounds === null) {
      return getTooltipLayoutInfo(mochartConfig, null);
    }
    return getTooltipLayoutInfo(mochartConfig, tooltipBounds, layoutInfo!, categoryValueData!, tooltipCategoryIndex,
      tooltipCategoryPercentage!, tooltipSeriesPercentage!);
  }

  constructUniqueIds(mochartConfig: EnhancedMochartConfig): Pick<ChartState, 'uniqueIds'> {
    const uniqueId = this.uniqueId;
    const { valueAxes: valueAxisConfigs, series: seriesConfigs, linearGradients: linearGradientConfigs, radialGradients: radialGradientConfigs } = mochartConfig;

    const svgUniqueId = mochartChartIdPrefix + uniqueId;
    const tooltipClipPathUniqueId = tooltipClipPathIdPrefix + uniqueId;
    const titleClipPathUniqueId = titleClipPathIdPrefix + uniqueId;
    const legendClipPathUniqueId = legendClipPathIdPrefix + uniqueId;
    const categoryAxisTitleClipPathUniqueId = categoryAxisTitleClipPathIdPrefix + uniqueId;
    const categoryAxisTickLabelClipPathUniqueId = categoryAxisTickLabelClipPathIdPrefix + uniqueId;
    const seriesClipPathUniqueId = seriesClipPathIdPrefix + uniqueId;
    const clipIndicatorPatternUniqueId = clipIndicatorPatternIdPrefix + uniqueId;
    const valueAxisTitleClipPathUniqueIds: Record<string, string> = Object.create(null);
    for (const { id } of valueAxisConfigs) {
      valueAxisTitleClipPathUniqueIds[id] = valueAxisTitleClipPathIdPrefix + uniqueId + '__' + id;
    }
    const linearGradientIdMap: Record<string, string> = Object.create(null);
    for (const { id } of linearGradientConfigs) {
      linearGradientIdMap[id] = linearGradientIdPrefix + uniqueId + '__' + id;
    }
    const radialGradientIdMap: Record<string, string> = Object.create(null);
    for (const { id } of radialGradientConfigs) {
      radialGradientIdMap[id] = radialGradientIdPrefix + uniqueId + '__' + id;
    }
    const seriesColorGradientUniqueIds: Record<string, string> = Object.create(null);
    const patternIdMap: Record<string, string> = Object.create(null);
    for (const { id } of seriesConfigs) {
      seriesColorGradientUniqueIds[id] = seriesColorGradientIdPrefix + uniqueId + '__' + id;
      patternIdMap[id] = seriesPatternIdPrefix + uniqueId + '__' + id;
    }
    const gradientIdMap = { ...linearGradientIdMap, ...radialGradientIdMap };
    const uniqueIds = {
      svgUniqueId, tooltipClipPathUniqueId, titleClipPathUniqueId, legendClipPathUniqueId,
      categoryAxisTitleClipPathUniqueId, categoryAxisTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds,
      seriesClipPathUniqueId, clipIndicatorPatternUniqueId,
      seriesColorGradientUniqueIds, gradientIdMap, linearGradientIdMap, radialGradientIdMap, patternIdMap
    };
    return { uniqueIds };
  }

  init(props: ChartProps, warn = false): ChartStateUpdate {
    const { mochartConfig, chartData, width, height, standalone } = props;
    const newState = getInitialState();
    if (mochartConfig) {
      const { validation } = mochartConfig;
      const { valid, errors, warnings } = validation;

      if (valid) {
        const uniqueIdState = this.constructUniqueIds(mochartConfig);
        const domAccessors = this.chartRef ? getDomAccessors(this.chartRef) : null;
        const chartTextBoundsData = getChartTextBoundsData(mochartConfig, domAccessors, chartData?.seriesData.axisSeriesCounts);

        const layoutInfo = getChartLayoutInfo(mochartConfig, chartData, chartTextBoundsData, width, height);
        let axisData = null;
        let stackData = null;
        let clippedEdges = noClippedEdges;
        if (chartData !== null && getChartDataCategoryCount(chartData) > 0) {
          axisData = getAxisData(mochartConfig, layoutInfo, chartData);
          stackData = getStackData(mochartConfig, chartData);
          clippedEdges = getClippedEdgesWithMutations(this.state.clippedEdges, mochartConfig, chartData);
        }
        return this.applyLayoutInfo(mochartConfig, { ...newState, layoutInfo, axisData, stackData, clippedEdges, chartTextBoundsData, ...uniqueIdState });
      }
      if (warn && standalone) {
        if (errors.length > 0) {
          console.warn('mochart config had error messages: ', errors.join('\n'));
        }
        if (warnings.length > 0) {
          console.warn('mochart config had warning messages: ', warnings.join('\n'));
        }
      }
      return newState;
    }
    return newState;
  }

  calculateTooltipTextSize = () => {
    // a zero-size chart renders the no-size message with no chartRef while the tooltip state stays open
    if (!this.chartRef) {
      return;
    }
    const mochartConfig = this.renderedConfig();
    let { tooltipBounds } = this.state;
    tooltipBounds = getBoundsWithMutations(tooltipBounds, getTooltipBounds(mochartConfig, getDomAccessors(this.chartRef)));
    const tooltipLayoutInfo = getTooltipLayoutInfoWithMutations(this.state.tooltipLayoutInfo,
      this.getTooltipLayoutInfo(mochartConfig, { tooltipBounds }));
    this.setState({ tooltipBounds, tooltipLayoutInfo });
  }

  calculateInitialTextSizes() {
    if (this.chartRef) {
      const { chartData } = this.props;
      const mochartConfig = this.renderedConfig();
      const newState = this.calculateTextSizes(false);
      if (newState.layoutInfo == null) {
        // measurements were unchanged; push any tooltip remeasure through on its own
        if (newState.tooltipBounds !== undefined) {
          this.setState(newState);
        }
        return;
      }
      if (chartData) {
        newState.axisData = getAxisDataWithMutations(this.state.axisData, mochartConfig, newState.layoutInfo, chartData);
      }
      this.setState(this.applyLayoutInfo(mochartConfig, { ...newState, layoutInfo: newState.layoutInfo }));
    }
  }

  calculateTextSizes(setState = true): ChartStateUpdate {
    let newState: ChartStateUpdate = {};
    if (this.chartRef) {
      const { chartData, width, height } = this.props;
      const mochartConfig = this.renderedConfig();
      const domAccessors = getDomAccessors(this.chartRef);
      let chartTextBoundsData = getChartTextBoundsData(mochartConfig, domAccessors, chartData?.seriesData.axisSeriesCounts);
      chartTextBoundsData = getChartTextBoundsDataWithMutations(this.state.chartTextBoundsData, chartTextBoundsData);
      let layoutInfo = this.state.layoutInfo;
      if (chartTextBoundsData !== this.state.chartTextBoundsData || layoutInfo === null) {
        layoutInfo = getChartLayoutInfoWithMutations(layoutInfo, getChartLayoutInfo(mochartConfig, chartData, chartTextBoundsData, width, height));
        newState = { chartTextBoundsData, layoutInfo };
      }
      const { tooltipVisible } = this.state;
      if (tooltipVisible) {
        let { tooltipBounds } = this.state;
        tooltipBounds = getBoundsWithMutations(tooltipBounds, getTooltipBounds(mochartConfig, domAccessors));
        const tooltipLayoutInfo = getTooltipLayoutInfoWithMutations(this.state.tooltipLayoutInfo,
          this.getTooltipLayoutInfo(mochartConfig, { tooltipBounds }));
        newState.tooltipBounds = tooltipBounds;
        newState.tooltipLayoutInfo = tooltipLayoutInfo;
      }
      if (setState === true && (newState.layoutInfo !== undefined || newState.tooltipBounds !== undefined)) {
        const { layoutInfo: oldLayoutInfo, axisData: oldAxisData } = this.state;
        // axis data depends on the axis layout (tick label space), not only on the extents, so rebuild by layout identity like derive()
        const categoryLayoutChanged = oldLayoutInfo === null || oldLayoutInfo.categoryAxisLayoutInfo !== layoutInfo.categoryAxisLayoutInfo ||
          oldLayoutInfo.seriesLayoutInfo.categoryExtent !== layoutInfo.seriesLayoutInfo.categoryExtent;
        const valueLayoutChanged = oldLayoutInfo === null || oldLayoutInfo.valueAxisLayoutInfos !== layoutInfo.valueAxisLayoutInfos ||
          oldLayoutInfo.seriesLayoutInfo.valueExtent !== layoutInfo.seriesLayoutInfo.valueExtent;
        if (chartData) {
          if (oldAxisData === null || categoryLayoutChanged && valueLayoutChanged) {
            newState.axisData = getAxisDataWithMutations(this.state.axisData, mochartConfig, layoutInfo, chartData);
          }
          else if (categoryLayoutChanged || valueLayoutChanged) {
            const { axisData } = this.state;
            if (categoryLayoutChanged) {
              newState.axisData = getAxisDataForCategoryChange(axisData!, mochartConfig, layoutInfo, chartData);
            }
            else {
              newState.axisData = getAxisDataForSeriesChange(axisData!, mochartConfig, layoutInfo, chartData);
            }
          }
        }
        this.setState(this.applyLayoutInfo(mochartConfig, { ...newState, layoutInfo }));
      }
    }
    return newState;
  }

  updateTextSizes() {
    if (this.chartRef) {
      const { chartData, width, height } = this.props;
      const mochartConfig = this.renderedConfig();
      const domAccessors = getDomAccessors(this.chartRef);
      let chartTextBoundsData = getChartTextBoundsData(mochartConfig, domAccessors, chartData?.seriesData.axisSeriesCounts);
      chartTextBoundsData = getChartTextBoundsDataWithMutations(this.state.chartTextBoundsData, chartTextBoundsData);
      if (chartTextBoundsData !== this.state.chartTextBoundsData) {
        let layoutInfo = getChartLayoutInfo(mochartConfig, chartData, chartTextBoundsData, width, height);
        layoutInfo = getChartLayoutInfoWithMutations(this.state.layoutInfo, layoutInfo);
        this.setState({ chartTextBoundsData, layoutInfo });
      }
    }
  }

  derive(nextProps: ChartProps, _state: ChartState, prevProps: ChartProps | null): ChartStateUpdate | null {
    if (prevProps === null) {
      return this.init(nextProps, true);
    }
    const { mochartConfig, chartData, width, height } = nextProps;

    const dataChanged = chartData !== prevProps.chartData;
    const sizeChanged = width !== prevProps.width || height !== prevProps.height;
    const mochartConfigChanged = mochartConfig !== prevProps.mochartConfig;
    // hasConfigStructureChange counts a config appearing or going away as structural
    const mochartConfigStructureChanged = mochartConfigChanged && hasConfigStructureChange(prevProps.mochartConfig, mochartConfig);

    if (mochartConfigChanged || dataChanged || sizeChanged) {
      if (!mochartConfig || mochartConfigStructureChanged || (dataChanged && chartData === null)) {
        return this.init(nextProps, mochartConfigStructureChanged);
      }
      else if (mochartConfig.validation.valid) {
        const { chartTextBoundsData, axisData: oldAxisData, stackData: oldStackData } = this.state;
        let { uniqueIds, layoutInfo, axisData, stackData, clippedEdges } = this.state;

        // layout reads chartData only through seriesData.axisSeriesCounts, so value-tween frames keeping that identity keep the layout
        const layoutInputsChanged = mochartConfigChanged || sizeChanged || this.state.layoutInfo === null ||
          chartData === null || prevProps.chartData === null ||
          chartData.seriesData.axisSeriesCounts !== prevProps.chartData.seriesData.axisSeriesCounts;
        if (layoutInputsChanged) {
          layoutInfo = getChartLayoutInfo(mochartConfig, chartData, chartTextBoundsData, width, height);
          layoutInfo = getChartLayoutInfoWithMutations(this.state.layoutInfo, layoutInfo);
        }
        // axis data also depends on the layout, so a moved axis layout info forces that axis's rebuild
        const oldLayoutInfo = this.state.layoutInfo;
        const categoryLayoutChanged = oldLayoutInfo === null || layoutInfo!.categoryAxisLayoutInfo !== oldLayoutInfo.categoryAxisLayoutInfo;
        const valueLayoutChanged = oldLayoutInfo === null || layoutInfo!.valueAxisLayoutInfos !== oldLayoutInfo.valueAxisLayoutInfos;
        const categoryAxisChanged = chartData === null || prevProps.chartData === null || prevProps.chartData.categoryData !== chartData.categoryData || categoryLayoutChanged;
        const valueAxisChanged = chartData === null || prevProps.chartData === null || prevProps.chartData.seriesData.raw.axisDomains !== chartData.seriesData.raw.axisDomains ||
          prevProps.chartData.seriesData.filtered.axisDomains !== chartData.seriesData.filtered.axisDomains ||
          // animation frames substitute only the render domains, so they must trip this too
          prevProps.chartData.seriesData.raw.renderAxisDomains !== chartData.seriesData.raw.renderAxisDomains ||
          prevProps.chartData.seriesData.filtered.renderAxisDomains !== chartData.seriesData.filtered.renderAxisDomains ||
          valueLayoutChanged;

        let tooltipStateSource: ChartState | ReturnType<typeof getInitialTooltipState> = this.state;
        if (chartData !== null) {
          // data with no categories carries none of this, the way init() leaves it for a chart mounted with it;
          // the old values have to go rather than just be left standing, or they outlive the categories they place
          if (getChartDataCategoryCount(chartData) === 0) {
            axisData = null;
            stackData = null;
            clippedEdges = noClippedEdges;
          }
          else {
            if (oldAxisData === null || mochartConfigChanged || sizeChanged || (categoryAxisChanged && valueAxisChanged)) {
              axisData = getAxisDataWithMutations(oldAxisData, mochartConfig, layoutInfo!, chartData);
            }
            else {
              if (categoryAxisChanged) {
                axisData = getAxisDataForCategoryChange(axisData!, mochartConfig, layoutInfo!, chartData);
              }
              else if (valueAxisChanged) {
                axisData = getAxisDataForSeriesChange(axisData!, mochartConfig, layoutInfo!, chartData);
              }
            }
            if (mochartConfigChanged || dataChanged) {
              stackData = getStackDataWithMutations(oldStackData, mochartConfig, chartData);
              clippedEdges = getClippedEdgesWithMutations(clippedEdges, mochartConfig, chartData);
            }
          }

          if (dataChanged && prevProps.chartData !== null) {
            let { tooltipCategoryIndex, tooltipValueObject } = this.state;
            if (tooltipCategoryIndex >= 0) {
              const oldCategoryValues = prevProps.chartData.categoryData.values.key;
              const newCategoryValues = chartData.categoryData.values.key;
              if (oldCategoryValues && newCategoryValues) {
                const categoryValue = oldCategoryValues[tooltipCategoryIndex];
                tooltipCategoryIndex = indexOfCategoryValue(mochartConfig.categoryAxis, newCategoryValues, categoryValue);
                if (tooltipCategoryIndex >= 0) {
                  tooltipValueObject = getCategorySeriesValueObject(chartData, tooltipCategoryIndex);
                  tooltipStateSource = { ...this.state, tooltipCategoryIndex, tooltipValueObject };
                }
                else {
                  // the tooltip's category disappeared: close fully so the next
                  // click opens instead of toggling an invisible tooltip
                  tooltipStateSource = getInitialTooltipState();
                }
              }
              else {
                tooltipStateSource = getInitialTooltipState();
              }
            }
          }
        }

        if (mochartConfigChanged) {
          ({ uniqueIds } = this.constructUniqueIds(mochartConfig));
        }
        const { tooltipVisible, tooltipCategoryIndex, tooltipCategoryPercentage, tooltipSeriesPercentage, tooltipValueObject, tooltipBounds } = tooltipStateSource;
        const newState = { uniqueIds, layoutInfo, axisData, stackData, clippedEdges, tooltipVisible, tooltipCategoryIndex, tooltipCategoryPercentage, tooltipSeriesPercentage, tooltipValueObject, tooltipBounds };
        return this.applyLayoutInfo(mochartConfig, newState);
      }
      else {
        return getInitialState();
      }
    }
    return null;
  }

  /** the mount pass measures the tick labels before they truncate; one follow-up pass re-reads them once they have */
  private remeasureAfterMount = false;

  measure(prevProps: ChartProps | null, prevState: ChartState | null): void {
    this.flushSeriesLayoutBoundsChange();
    if (prevProps === null || prevState === null) {
      // set before the measure: its setState flushes the follow-up measure synchronously
      this.remeasureAfterMount = true;
      this.calculateTextSizes();
      return;
    }
    const { mochartConfig: newMochartConfig } = this.props;
    if (newMochartConfig) {
      const { validation } = newMochartConfig;
      const { valid } = validation;
      if (valid) {
        const { chartData: newChartData } = this.props;
        const { chartData, mochartConfig } = prevProps;
        if (chartData === null || newChartData === null) {
          if (newChartData !== chartData || newMochartConfig !== mochartConfig) {
            this.remeasureAfterMount = true;
            this.calculateInitialTextSizes();
          }
          else {
            const { chartTextBoundsData } = this.state;
            if (chartTextBoundsData && chartTextBoundsData.hasDefault) {
              this.updateTextSizes();
            }
          }
        }
        else {
          const { width, height } = prevProps;
          const { axisData: oldAxisData, tooltipCategoryIndex: oldTooltipCategoryIndex, tooltipVisible: oldTooltipVisible } = prevState;
          const { axisData, tooltipCategoryIndex, tooltipVisible } = this.state;

          const dataChanged = chartData !== this.props.chartData;

          const sizeChanged = width !== this.props.width || height !== this.props.height;
          const mochartConfigChanged = mochartConfig !== newMochartConfig;
          const axisDataChanged = oldAxisData !== axisData;
          // rendered text comes from the config (titles, legend) and axisData (tick labels): a data change keeping
          // both identities cannot change measured text, so tween frames skip the DOM remeasure; hasDefault retries unmeasured bounds
          const textMayHaveChanged = axisDataChanged || this.state.chartTextBoundsData.hasDefault === true;

          if (mochartConfigChanged || sizeChanged || (dataChanged && textMayHaveChanged)) {
            this.remeasureAfterMount = false;
            this.calculateInitialTextSizes();
          }
          else if (this.remeasureAfterMount) {
            // bounded to one pass: the truncation resets whenever the plot extent moves, so chasing it could ping-pong
            this.remeasureAfterMount = false;
            this.calculateInitialTextSizes();
          }

          if (tooltipVisible) {
            // dataChanged: an open tooltip renders the new values, so its bounds
            // need remeasuring even when the chart text is untouched
            if (dataChanged || !oldTooltipVisible || oldTooltipCategoryIndex !== tooltipCategoryIndex) {
              this.calculateTooltipTextSize();
            }
          }
        }
      }
    }
  }

  /** applyLayoutInfo can run inside derive(), before props commit; measure() flushes this after. */
  pendingSeriesLayoutBounds: Bounds | null = null;

  flushSeriesLayoutBoundsChange(): void {
    const layoutBounds = this.pendingSeriesLayoutBounds;
    if (layoutBounds !== null) {
      this.pendingSeriesLayoutBounds = null;
      this.props.onSeriesLayoutBoundsChange?.(layoutBounds);
    }
  }

  /** Closing unmounts the tooltip's own tab stops; the render's teardown restore hands focus back to the plot stop. */
  closeTooltip = () => {
    // the same close as Escape on the plot: applyFocus releases the pinned category with it
    this.setTooltipOpenAtCategory(false, this.state.tooltipCategoryIndex);
  }

  updateTooltipCategoryIndex = (tooltipCategoryIndex: number): void => {
    const { chartData } = this.props;
    this.lastTooltipCategoryIndex = tooltipCategoryIndex;
    const tooltipValueObject = getCategorySeriesValueObject(chartData!, tooltipCategoryIndex);
    // the unsnapped position follows the fraction, so a step must move it like the open did
    const tooltipCategoryPercentage = this.getCategoryFraction(tooltipCategoryIndex);
    const tooltipLayoutInfo = this.getTooltipLayoutInfo(this.renderedConfig(), { ...this.state, tooltipCategoryIndex, tooltipCategoryPercentage });
    this.setState({ tooltipCategoryIndex, tooltipCategoryPercentage, tooltipValueObject, tooltipLayoutInfo });
    // announce here so the tooltip's own prev/next buttons read out, not just the keyboard
    this.announceTooltipCategory(tooltipCategoryIndex);
  }

  /** Open or close explicitly: enter must always open and leave always close, or the pairing inverts. */
  setTooltipOpen(open: boolean, { categoryIndex, categoryFraction, valueFraction: seriesPercentage }: Pick<ChartEventPayload, 'categoryIndex' | 'categoryFraction' | 'valueFraction'>): void {
    const { onFocus, chartData } = this.props;
    const mochartConfig = this.renderedConfig();
    const { tooltip: tooltipConfig, crosshair: crosshairConfig } = mochartConfig;
    if (tooltipConfig.visible || crosshairConfig.visible) {
      let { tooltipVisible, tooltipCategoryIndex, tooltipSeriesPercentage, tooltipCategoryPercentage, tooltipLayoutInfo, tooltipBounds, tooltipValueObject } = this.state;
      tooltipSeriesPercentage = open ? seriesPercentage : null;
      tooltipCategoryPercentage = open ? categoryFraction : null;
      tooltipLayoutInfo = getTooltipLayoutInfo(mochartConfig, null);
      tooltipBounds = null;
      tooltipVisible = open;
      tooltipCategoryIndex = open ? categoryIndex : -1;
      if (tooltipVisible) {
        this.lastTooltipCategoryIndex = tooltipCategoryIndex;
      }
      else {
        this.announceTooltipCategory(null);
      }
      tooltipValueObject = tooltipVisible ? getCategorySeriesValueObject(chartData!, tooltipCategoryIndex) : null;
      if ((tooltipConfig.visible && tooltipConfig.applyFocus) || (crosshairConfig.visible && crosshairConfig.applyFocus)) {
        onFocus?.({ categoryIndex: tooltipCategoryIndex });
      }
      this.setState({ tooltipVisible, tooltipCategoryIndex, tooltipSeriesPercentage, tooltipCategoryPercentage, tooltipLayoutInfo, tooltipBounds, tooltipValueObject });
    }
  }

  getChartEventPayload = (chartX: number, chartY: number): ChartEventPayload => {
    const mochartConfig = this.renderedConfig();
    const { axisData, layoutInfo } = this.state;
    const dataCategoryPositions = axisData!.category!.valueData.positions;
    const { seriesLayoutInfo } = layoutInfo!;
    const { plot: plotConfig } = mochartConfig;

    const categoryPosition = plotConfig.inverted ? chartY : chartX;
    const categoryFraction = categoryPosition / seriesLayoutInfo.categoryExtent;
    let categoryIndex = -1;
    let categoryDifference = Number.MAX_VALUE;
    const categoryCount = dataCategoryPositions.length;
    let dataCategoryPosition;
    for (let dataCategoryIndex = 0; dataCategoryIndex < categoryCount; dataCategoryIndex++) {
      dataCategoryPosition = dataCategoryPositions[dataCategoryIndex];
      const currentDifference = Math.abs(dataCategoryPosition - categoryPosition);
      if (currentDifference <= categoryDifference) { // <= means we'll pick the greater category value on a tie
        categoryDifference = currentDifference;
        categoryIndex = dataCategoryIndex;
      }
    }
    const seriesPosition = plotConfig.inverted ? chartX : chartY;
    const seriesPercentage = seriesPosition / seriesLayoutInfo.valueExtent;

    return {
      chartX, chartY, categoryPosition, valuePosition: seriesPosition, categoryFraction, valueFraction: seriesPercentage, categoryIndex
    };
  }

  onChartMouseEnter = (chartX: number, chartY: number): void => {
    const { onChartMouseEnter } = this.props;
    const eventPayload = this.getChartEventPayload(chartX, chartY);
    onChartMouseEnter?.(eventPayload);
    if (this.renderedConfig().tooltip.followPointer && !this.isLoading()) {
      this.setTooltipOpen(true, eventPayload);
    }
  }

  onChartMouseMove = (chartX: number, chartY: number): void => {
    const { onFocus, onChartMouseMove, chartData } = this.props;
    const mochartConfig = this.renderedConfig();
    const eventPayload = this.getChartEventPayload(chartX, chartY);
    onChartMouseMove?.(eventPayload);
    if (mochartConfig.tooltip.followPointer) {
      const { tooltip: tooltipConfig, crosshair: crosshairConfig } = mochartConfig;
      const { valueFraction: seriesPercentage, categoryFraction, categoryIndex } = eventPayload;
      // same applyFocus gate as setTooltipOpen: enter, move and leave must agree on whether pointer interactions may change the focused category
      if ((tooltipConfig.visible && tooltipConfig.applyFocus) || (crosshairConfig.visible && crosshairConfig.applyFocus)) {
        onFocus?.({ categoryIndex });
      }
      if (tooltipConfig.visible) {
        if (this.state.tooltipVisible) {
          // track the pointer: content follows the nearest category, position
          // follows the pointer percentages (measure() remeasures on index change)
          const tooltipCategoryIndex = categoryIndex;
          const tooltipValueObject = tooltipCategoryIndex !== this.state.tooltipCategoryIndex
            ? getCategorySeriesValueObject(chartData!, tooltipCategoryIndex)
            : this.state.tooltipValueObject;
          const tooltipCategoryPercentage = categoryFraction;
          const tooltipSeriesPercentage = seriesPercentage;
          const tooltipLayoutInfo = this.getTooltipLayoutInfo(mochartConfig,
            { ...this.state, tooltipCategoryIndex, tooltipCategoryPercentage, tooltipSeriesPercentage });
          this.setState({ tooltipCategoryIndex, tooltipValueObject, tooltipCategoryPercentage, tooltipSeriesPercentage, tooltipLayoutInfo });
        }
        else {
          this.setState({ tooltipSeriesPercentage: seriesPercentage });
        }
      }
      else {
        this.setState({ tooltipBounds: null });
      }
    }
  }

  onChartMouseLeave = (chartX: number, chartY: number): void => {
    const { onChartMouseLeave } = this.props;
    const eventPayload = this.getChartEventPayload(chartX, chartY);
    onChartMouseLeave?.(eventPayload);
    if (this.renderedConfig().tooltip.followPointer) {
      this.setTooltipOpen(false, eventPayload);
    }
  }

  onChartClick = (chartX: number, chartY: number): void => {
    const { onChartClick } = this.props;
    const eventPayload = this.getChartEventPayload(chartX, chartY);
    onChartClick?.(eventPayload);
    if (!this.renderedConfig().tooltip.followPointer) {
      this.setTooltipOpen(!this.state.tooltipVisible, eventPayload);
    }
  }

  // no in-bounds gate: markers/labels can overflow the plot rect
  onSeriesShapeClick = (seriesId: string, categoryIndex: number, event: Event): void => {
    const { onSeriesClick } = this.props;
    // covers pointer and keyboard activation alike, both of which route through here
    if (onSeriesClick && !this.isLoading()) {
      const { clientX, clientY } = event as MouseEvent;
      // keyboard activation has no pointer position to resolve a nearest category from
      let nearestCategoryIndex = -1;
      if (clientX !== undefined && clientY !== undefined) {
        const { x, y } = this.toPlotLocalPoint(clientX, clientY);
        ({ categoryIndex: nearestCategoryIndex } = this.getChartEventPayload(x, y));
      }
      onSeriesClick({ seriesId, categoryIndex, nearestCategoryIndex });
    }
  }

  /** where keyboard toggling reopens: the last category the tooltip showed */
  lastTooltipCategoryIndex = 0;

  /** the visually-hidden aria-live node; keyboard navigation speaks the tooltip through it */
  liveRegionNode: Node | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAnnouncement: { text: string; categoryIndex: number | null } | null = null;
  private lastAnnouncement = '';
  private lastAnnouncedCategoryIndex: number | null = null;

  /** the live region and message live inside ChartBody, so the references have to go when the body does */
  private clearBody(): void {
    this.body.set(null);
    this.setLiveRegionNode(null);
    this.messageRef = null;
    this.cancelAnnouncement();
  }

  /** a new or dropped region starts with nothing spoken, so the latch must not swallow its first announcement */
  private setLiveRegionNode(liveRegionNode: Node | null): void {
    if (liveRegionNode !== this.liveRegionNode) {
      this.liveRegionNode = liveRegionNode;
      this.lastAnnouncement = '';
      this.lastAnnouncedCategoryIndex = null;
    }
  }

  private cancelAnnouncement(): void {
    if (this.announceTimer !== null) {
      clearTimeout(this.announceTimer);
      this.announceTimer = null;
    }
    this.pendingAnnouncement = null;
  }

  dispose(): void {
    this.cancelAnnouncement();
  }

  /** announce a category's tooltip values to screen readers; null silences the region */
  announceTooltipCategory(categoryIndex: number | null): void {
    if (this.liveRegionNode !== null) {
      const { chartData } = this.props;
      const announcement = categoryIndex === null ? '' :
        getTooltipAnnouncement(this.renderedConfig(), getCategorySeriesValueObject(chartData!, categoryIndex));
      if (announcement === '') {
        this.cancelAnnouncement();
        this.writeAnnouncement(announcement, null);
        return;
      }
      // a single step speaks at once; a held arrow key adds only the category it settles on,
      // so the region never queues one announcement per category passed through
      if (this.announceTimer === null) {
        this.writeAnnouncement(announcement, categoryIndex);
      }
      else {
        clearTimeout(this.announceTimer);
        this.pendingAnnouncement = { text: announcement, categoryIndex };
      }
      this.announceTimer = setTimeout(this.flushAnnouncement, announceSettleDelay);
    }
  }

  private flushAnnouncement = (): void => {
    this.announceTimer = null;
    if (this.pendingAnnouncement !== null) {
      const { text, categoryIndex } = this.pendingAnnouncement;
      this.pendingAnnouncement = null;
      this.writeAnnouncement(text, categoryIndex);
    }
  }

  // re-announcing the same category with the same text is a no-op (a clamped arrow): rewriting it
  // churns the live region for nothing; a different category with the same text still speaks
  private writeAnnouncement(announcement: string, categoryIndex: number | null): void {
    if (this.liveRegionNode !== null && (announcement !== this.lastAnnouncement || categoryIndex !== this.lastAnnouncedCategoryIndex)) {
      this.lastAnnouncement = announcement;
      this.lastAnnouncedCategoryIndex = categoryIndex;
      this.liveRegionNode.textContent = announcement;
    }
  }

  /** the category's position as a fraction of the category extent, as the pointer would report it */
  private getCategoryFraction(categoryIndex: number): number {
    const { axisData, layoutInfo } = this.state;
    const positions = axisData!.category!.valueData.positions;
    const { categoryExtent } = layoutInfo!.seriesLayoutInfo;
    return categoryExtent > 0 ? (positions[categoryIndex] ?? 0) / categoryExtent : 0;
  }

  /** open/close via the pointer-click path, with the position synthesized from the category */
  setTooltipOpenAtCategory(open: boolean, categoryIndex: number): void {
    this.setTooltipOpen(open, { categoryIndex, categoryFraction: this.getCategoryFraction(categoryIndex), valueFraction: 0.5 });
  }

  /** step the open tooltip to a category, moving the focus like the pointer would */
  stepTooltipCategoryIndex(categoryIndex: number): void {
    const { onFocus } = this.props;
    const { tooltip: tooltipConfig, crosshair: crosshairConfig } = this.renderedConfig();
    if ((tooltipConfig.visible && tooltipConfig.applyFocus) || (crosshairConfig.visible && crosshairConfig.applyFocus)) {
      onFocus?.({ categoryIndex });
    }
    this.updateTooltipCategoryIndex(categoryIndex);
  }

  /** The provider behind the chart's own dynamic reads (never the one handed to the state factories). */
  private readProvider(): DataProvider | null {
    const { readDataProvider, dataProvider } = this.props;
    return readDataProvider === undefined ? dataProvider : readDataProvider;
  }

  isLoading(): boolean {
    const { loading } = this.props;
    const dataProvider = this.readProvider();
    return Boolean(loading ? loading : dataProvider && dataProvider.getLoading?.());
  }

  onPlotKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    // loading pauses stepping like it pauses pointer events, but Escape still
    // closes the tooltip — its close button stays clickable during loading too
    if (this.isLoading() && key !== 'Escape') {
      return;
    }
    const { chartData } = this.props;
    const categoryCount = chartData !== null ? getChartDataCategoryCount(chartData) : 0;
    if (categoryCount === 0) {
      return;
    }
    const { tooltipVisible, tooltipCategoryIndex } = this.state;
    const rememberedIndex = Math.min(this.lastTooltipCategoryIndex, categoryCount - 1);
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.setTooltipOpenAtCategory(!tooltipVisible, tooltipVisible ? tooltipCategoryIndex : rememberedIndex);
      if (!tooltipVisible) {
        this.announceTooltipCategory(rememberedIndex);
      }
    }
    else if (key === 'Escape') {
      if (tooltipVisible) {
        event.preventDefault();
        this.setTooltipOpenAtCategory(false, tooltipCategoryIndex);
      }
    }
    else if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      // arrows exist to step categories; with a single category (a pie) they
      // stay inert instead of popping the tooltip — Enter/Space still toggles
      if (categoryCount <= 1) {
        return;
      }
      event.preventDefault();
      if (!tooltipVisible) {
        const index = key === 'Home' ? 0 : key === 'End' ? categoryCount - 1 : rememberedIndex;
        this.setTooltipOpenAtCategory(true, index);
        this.announceTooltipCategory(index);
      }
      else {
        const nextIndex =
          key === 'ArrowRight' || key === 'ArrowDown' ? Math.min(tooltipCategoryIndex + 1, categoryCount - 1) :
          key === 'ArrowLeft' || key === 'ArrowUp' ? Math.max(tooltipCategoryIndex - 1, 0) :
          key === 'Home' ? 0 : categoryCount - 1;
        if (nextIndex !== tooltipCategoryIndex) {
          this.stepTooltipCategoryIndex(nextIndex);
        }
      }
    }
  }

  onTitleClick = () => {
    const { onTitleClick } = this.props;
    onTitleClick?.();
  }

  setChartRectRef = (chartRectRef: Element | null): void => {
    this.chartRectRef = chartRectRef;
  }

  /** the chart element holding keyboard focus, if any */
  private getFocusedChartNode(): Element | null {
    const activeElement = document.activeElement;
    return activeElement !== null && activeElement !== document.body && this.root.node.contains(activeElement) ? activeElement : null;
  }

  /** A render that tears down the focused tab stop must not drop focus to <body>: hand it to the plot stop, else the message that replaced the plot. */
  private restoreTornDownFocus(focusedNode: Element | null): void {
    // an inner component may have moved focus itself (series reorder, tooltip row filtering)
    if (focusedNode === null || focusedNode.isConnected || this.getFocusedChartNode() !== null) {
      return;
    }
    focusRestored((this.chartRectRef as SVGElement | null) ?? this.messageRef);
  }

  create() {
    return this.root.node;
  }

  sync() {
    const {
      mochartConfig, style: styleProp, width, height, error: propsError,
      getErrorComponent: errorFactory = getErrorComponent,
      getLoadingComponent: loadingFactory = getLoadingComponent,
      getNoSizeComponent: noSizeFactory = getNoSizeComponent,
      getConfigErrorComponent: configErrorFactory = getConfigErrorComponent
    } = this.props;
    const dataProvider = this.readProvider();
    const style = withDefaultChartStyle(styleProp);
    const error = propsError != null ? propsError : dataProvider && !isDataProviderValid(dataProvider) ? dataProvider.getError?.() : undefined;
    // read before the branches below can unmount whatever holds focus
    const focusedNode = this.getFocusedChartNode();

    // negative and non-finite sizes would reach the svg as invalid width/height
    const hasSize = width > 0 && height > 0;
    if (!hasSize || (mochartConfig && !mochartConfig.validation.valid)) {
      const messageFactory = !hasSize ? noSizeFactory : configErrorFactory;
      this.syncMessage(mochartCssClasses['chartError'], style, messageFactory, this.factoryContext(width, height, error), focusedNode);
      return;
    }

    const loading = this.isLoading();

    if (!mochartConfig) {
      if (isErrorActive(error)) {
        this.syncMessage(mochartCssClasses['chartError'], style, errorFactory, this.factoryContext(width, height, error), focusedNode);
      }
      else if (loading) {
        this.syncMessage(mochartCssClasses['loading'], style, loadingFactory, this.factoryContext(width, height, error), focusedNode);
      }
      else {
        this.chartRef = null;
        this.isMouseWithinChart = false;
        this.clearBody();
        this.setSimpleContent(null, null);
        this.setPresent(false);
        this.restoreTornDownFocus(focusedNode);
      }
      return;
    }

    const hasChartDataContent = this.hasChartDataContent(error);
    // loading reports but does not commit: pointer tracking and hover feedback continue, clicks do
    // not, because a click names a category that may not exist once the new data lands
    const { onClick: chartClickHandler, ...chartMotionHandlers } = this.chartEventHandler;
    if (!hasChartDataContent) {
      this.isMouseWithinChart = false;
    }
    const chartEventHandler = !hasChartDataContent ? {}
      : loading ? chartMotionHandlers
      : { ...chartMotionHandlers, onClick: chartClickHandler };

    this.setPresent(true);
    const rootClassName = accessibilityActive(mochartConfig.accessibility)
      ? mochartCssClasses['chart'] + ' ' + mochartCssClasses['accessible']
      : mochartCssClasses['chart'];
    this.root.set({ className: rootClassName, ...chartEventHandler, style, [mochartVersionAttribute]: getVersionString(),
      'aria-hidden': mochartConfig.accessibility.hidden ? 'true' : null });
    this.chartRef = this.root.node;
    this.setSimpleContent(null, null);
    this.body.set(ChartBody, { chart: this, mochartConfig, chartProps: this.props, chartState: this.state, error, loading });
  }

  /** Replace the chart body with a message state (no size, invalid config, no-config error/loading); the root becomes the message container. */
  private syncMessage(className: string, style: ChartProps['style'], factory: ChartContentFactory, context: ChartFactoryContext, focusedNode: Element | null): void {
    const { mochartConfig } = this.props;
    // no config means nothing can switch accessibility off
    const accessibility = mochartConfig ? accessibilityActive(mochartConfig.accessibility) : true;
    this.setPresent(true);
    this.chartRef = null;
    this.isMouseWithinChart = false;
    // -1: never a tab stop, but focusable for the teardown restore below, which reads out the message
    this.root.set({ className, style, [mochartVersionAttribute]: getVersionString(),
      'aria-hidden': mochartConfig?.accessibility.hidden ? 'true' : null, tabindex: accessibility ? '-1' : null });
    this.clearBody();
    this.setSimpleContent(factory, context);
    this.messageRef = accessibility ? this.root.node as HTMLElement : null;
    this.restoreTornDownFocus(focusedNode);
  }

  /** Fill the simple-content region of the root div from a factory (null clears it); runs the factory only when its inputs changed. */
  setSimpleContent(factory: ChartContentFactory | null, context: ChartFactoryContext | null): void {
    if (factory === null ? this._simpleFactory === null : sameFactoryInputs(this._simpleFactory, this._simpleFactoryContext, factory, context!)) {
      return;
    }
    this._simpleFactory = factory;
    this._simpleFactoryContext = context;
    for (const simpleNode of this._simpleNodes) {
      simpleNode.parentNode?.removeChild(simpleNode);
    }
    this._simpleNodes = [];
    const node = factory ? factoryContentToNode(factory(context!)) : null;
    if (node) {
      this._simpleNodes = node instanceof DocumentFragment ? Array.from(node.childNodes) : [node];
      this.root.node.insertBefore(node, this.simpleContent.anchor);
    }
  }

  /** True when the committed dataset holds at least one category. */
  private hasCategories(): boolean {
    const { chartData } = this.props;
    return chartData !== null && getChartDataCategoryCount(chartData) > 0;
  }

  hasChartDataContent(error: unknown): boolean {
    return !isErrorActive(error) && this.hasCategories();
  }

  /** The context every state factory receives; width/height are the box the returned content fills. */
  private factoryContext(width: number, height: number, error: unknown): ChartFactoryContext {
    const { mochartConfig, dataProvider } = this.props;
    return {
      width,
      height,
      mochartConfig: mochartConfig ?? null,
      dataProvider: dataProvider ?? null,
      error,
      hasData: this.hasCategories()
    };
  }

  /** Sync the config-only <defs> lists: series color gradients, linear/radial gradients and patterns. */
  syncConfigDefs(body: ChartBody, mochartConfig: EnhancedMochartConfig, uniqueIds: ChartUniqueIds): void {
    const { seriesColorGradientUniqueIds, linearGradientIdMap, radialGradientIdMap, patternIdMap } = uniqueIds;

    const seriesColorGradients: RendererItem[] = [];
    mochartConfig.series.forEach((seriesConfig: EnhancedSeriesConfig) => {
      if (getSeriesGradientColors(seriesConfig)) {
        seriesColorGradients.push({
          key: seriesConfig.id, ctor: SeriesColorGradient,
          props: { uniqueId: seriesColorGradientUniqueIds[seriesConfig.id], seriesConfig }
        });
      }
    });

    const linearGradients: RendererItem[] = mochartConfig.linearGradients.map((linearGradientConfig: LinearGradientConfig) => ({
      key: linearGradientConfig.id, ctor: LinearGradient,
      props: { uniqueId: linearGradientIdMap[linearGradientConfig.id], linearGradientConfig }
    }));

    const radialGradients: RendererItem[] = mochartConfig.radialGradients.map((radialGradientConfig: RadialGradientConfig) => ({
      key: radialGradientConfig.id, ctor: RadialGradient,
      props: { uniqueId: radialGradientIdMap[radialGradientConfig.id], radialGradientConfig }
    }));

    const patterns: RendererItem[] = [];
    const fillPalette = mochartConfig.colorPalette.shape.normal.fillColors;
    mochartConfig.series.forEach((seriesConfig: EnhancedSeriesConfig, seriesIndex: number) => {
      if (seriesConfig.patternConfig !== undefined) {
        const fallbackColor = fillPalette[seriesIndex % fillPalette.length] ?? null;
        patterns.push({
          key: seriesConfig.id,
          ctor: Pattern,
          props: {
            uniqueId: patternIdMap[seriesConfig.id],
            patternConfig: seriesConfig.patternConfig as PatternConfig,
            seriesColor: getSeriesFillColor(mochartConfig.colorPalette, seriesConfig, seriesIndex, null, fallbackColor)
          }
        });
      }
    });

    body.seriesColorGradients.sync(seriesColorGradients);
    body.linearGradients.sync(linearGradients);
    body.radialGradients.sync(radialGradients);
    body.patterns.sync(patterns);
  }

  /** Fill in the ChartBody's slots — called from ChartBody.sync with the body renderer. */
  syncBody(body: ChartBody): void {
    const {
      chartData, focusData, onFocus, onSeriesFilter, width, height,
      getErrorComponent: errorFactory = getErrorComponent,
      getLoadingComponent: loadingFactory = getLoadingComponent,
      getNoDataComponent: noDataFactory = getNoDataComponent,
      getNoSeriesComponent: noSeriesFactory = getNoSeriesComponent
    } = this.props;
    const { layoutInfo, tooltipLayoutInfo, axisData, stackData, clippedEdges, tooltipVisible, tooltipCategoryIndex, tooltipBounds, uniqueIds, tooltipValueObject } = this.state;
    const { mochartConfig, error, loading } = body.props;
    // read before the slots below can unmount whatever holds focus
    const focusedNode = this.getFocusedChartNode();

    const {
      svgUniqueId, tooltipClipPathUniqueId, titleClipPathUniqueId, legendClipPathUniqueId, categoryAxisTitleClipPathUniqueId,
      categoryAxisTickLabelClipPathUniqueId, valueAxisTitleClipPathUniqueIds, seriesClipPathUniqueId,
      clipIndicatorPatternUniqueId, gradientIdMap, patternIdMap
    } = uniqueIds!;
    const {
      chartContentLayoutInfo, titleLayoutInfo, titlePrefixLayoutInfo, titleTextLayoutInfo, titleTextRawLayoutInfo, titleSuffixLayoutInfo,
      legendLayoutInfo, legendItemTextLayoutInfo, legendItemLayoutInfos, legendItemRawLayoutInfos, plotLayoutInfo,
      seriesLayoutInfo, categoryAxisLayoutInfo, valueAxisLayoutInfos
    } = layoutInfo!;
    const chartTransform = translateObject(chartContentLayoutInfo);

    const focusedCategoryIndex = focusData ? focusData.focusedCategoryIndex : -1;
    const focusedSeriesId = focusData ? focusData.focusedSeriesId : null;
    const valueAxisFocusPercentages = focusData ? focusData.valueAxisFocusPercentages : {};
    const seriesFocusPercentages = focusData ? focusData.seriesFocusPercentages : {};
    const hasChartData = chartData !== null;
    const categoryCount = hasChartData ? getChartDataCategoryCount(chartData) : 0;
    const hasChartDataContent = !isErrorActive(error) && hasChartData && categoryCount > 0;
    const tooltipShown = hasChartData && tooltipBounds !== null && tooltipCategoryIndex >= 0;
    const filteredFlags = hasChartData ? chartData.seriesData.filteredFlags : emptyFilteredFlags;
    let maxTickLabelLength = seriesLayoutInfo.width;

    let clips: RendererItem[] = [
      { key: 'title-clip', ctor: TitleClip, props: { titleConfig: mochartConfig.title, chartContentLayoutInfo,
        titleTextLayoutInfo, titleClipPathUniqueId } },
      { key: 'legend-clip', ctor: LegendClip, props: { legendConfig: mochartConfig.legend, chartContentLayoutInfo,
        legendItemTextLayoutInfo, legendClipPathUniqueId } }
    ];

    if (hasChartDataContent) {
      maxTickLabelLength = axisData!.category!.maxTickLabelLength;

      // TooltipClip unmounts its node when the tooltip is not visible, so anything referencing the clip has to know
      clips.push({ key: 'tooltip-clip', ctor: TooltipClip, props: { mochartConfig, tooltipVisible, tooltipShown,
        tooltipLayoutInfo, chartContentLayoutInfo, width, height,
        tooltipClipPathUniqueId } });
      // cartesian only: a pie has no axis bounds to exceed, and PieSeriesContainer never
      // references the clip, so emitting it there would leave dead markup in every pie chart
      if (mochartConfig.chart.type !== CHART_TYPE_PIE) {
        clips.push({ key: 'series-clip', ctor: SeriesClip, props: { mochartConfig,
          seriesLayoutInfo: layoutInfo!.seriesLayoutInfo, seriesClipPathUniqueId } });
      }
    }

    clips.push(
      { key: 'category-axis-title-clip', ctor: AxisTitleClip, props: { axisConfig: mochartConfig.categoryAxis, chartContentLayoutInfo,
        axisLayoutInfo: categoryAxisLayoutInfo, axisTitleClipPathUniqueId: categoryAxisTitleClipPathUniqueId } },
      { key: 'category-axis-tick-label-clip', ctor: CategoryAxisTickLabelClip, props: { mochartConfig, maxTickLabelLength,
        plotLayoutInfo, categoryAxisLayoutInfo,
        categoryAxisTickLabelClipPathUniqueId } }
    );

    clips = clips.concat(mochartConfig.valueAxes.map((valueAxisConfig: EnhancedValueAxisConfig) => ({
      key: 'value-axis-clip-' + valueAxisConfig.id,
      ctor: AxisTitleClip,
      props: { axisConfig: valueAxisConfig,
        chartContentLayoutInfo, axisLayoutInfo: valueAxisLayoutInfos[valueAxisConfig.id],
        axisTitleClipPathUniqueId: valueAxisTitleClipPathUniqueIds[valueAxisConfig.id] }
    })));

    // gradients and patterns read only the config and its ids, so skip them on tooltip/animation syncs
    if (body.defsConfig !== mochartConfig || body.defsUniqueIds !== uniqueIds) {
      body.defsConfig = mochartConfig;
      body.defsUniqueIds = uniqueIds;
      this.syncConfigDefs(body, mochartConfig, uniqueIds!);
    }

    body.svgSlot.set('svg', () => body.svg);
    const { accessibility: accessibilityConfig } = mochartConfig;
    const accessibility = accessibilityActive(accessibilityConfig);
    body.svg.set({ xmlns: 'http://www.w3.org/2000/svg', id: svgUniqueId, width, height,
      role: accessibility ? 'group' : null,
      ariaRoledescription: accessibility ? accessibilityConfig.chartRoleDescription : null,
      ariaLabel: accessibility ? mochartConfig.title.text || accessibilityConfig.chartLabel : null }); // ||: an empty title must not blank the accessible name

    // the keyboard announcer: visually hidden, spoken via role="status"
    const liveRegion = accessibility ? body.liveRegionSlot.set('div', () => htmlEl('div')) : body.liveRegionSlot.set(null);
    liveRegion?.set({ role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', style: liveRegionStyle });
    this.setLiveRegionNode(liveRegion !== null ? liveRegion.node : null);
    body.clips.sync(clips);
    body.background.set(Background, { config: mochartConfig.chart, classKey: 'background', spacingRelative: false, spacingLayoutInfo: chartContentLayoutInfo });
    body.title.set(Title, { mochartConfig, titleLayoutInfo, titlePrefixLayoutInfo,
      titleTextLayoutInfo, titleTextRawLayoutInfo, titleSuffixLayoutInfo,
      titleClipPathUniqueId, accessibility, onClick: this.props.onTitleClick ? this.onTitleClick : undefined });
    body.contentGroup.set({ transform: chartTransform });

    if (hasChartDataContent) {
      const { category: categoryAxisData } = axisData!;
      const { valueData: categoryValueData } = categoryAxisData!;

      // keyboard tab stop on the series-area rect: Enter/Space toggles the tooltip, arrows step, Escape closes;
      // kept during loading — dropping tabindex would dump keyboard focus to <body>
      const plotInteractive = mochartConfig.tooltip.visible ||
        (mochartConfig.chart.type !== CHART_TYPE_PIE && mochartConfig.crosshair.visible);
      const plotA11yProps = accessibility && plotInteractive ? {
        ariaLabel: accessibilityConfig.plotLabel,
        ariaExpanded: String(tooltipVisible),
        onKeyDown: this.onPlotKeyDown
      } : null;

      if (mochartConfig.chart.type === CHART_TYPE_PIE) {
        body.plot.set(RadialPlot, { mochartConfig, gradientIdMap, patternIdMap, seriesLayoutInfo,
          plotLayoutInfo, chartData: chartData!, focusData: focusData!,
          initialAnimationPercentage: this.props.initialAnimationPercentage ?? null,
          onFocus: onFocus ?? (() => {}), onSliceClick: this.props.onSliceClick,
          shapeRef: this.setChartRectRef, a11yProps: plotA11yProps });
      }
      else {
        body.plot.set(Plot, { mochartConfig, gradientIdMap, patternIdMap, categoryAxisLayoutInfo,
          valueAxisLayoutInfos, seriesLayoutInfo,
          plotLayoutInfo, chartData: chartData!, focusData, axisData: axisData!,
          stackData: stackData!, categoryValueData, onFocus: onFocus ?? (() => {}),
          onSeriesShapeClick: this.props.onSeriesClick ? this.onSeriesShapeClick : null,
          shapeRef: this.setChartRectRef,
          a11yProps: plotA11yProps,
          categoryAxisTitleClipPathUniqueId,
          categoryAxisTickLabelClipPathUniqueId,
          seriesClipPathUniqueId,
          clippedEdges,
          clipIndicatorPatternUniqueId,
          valueAxisTitleClipPathUniqueIds,
          tooltipClipPathUniqueId,
          tooltipClipPresent: mochartConfig.tooltip.visible && tooltipVisible });
      }
      body.plotEmpty.set(null);

      body.tooltip.set(Tooltip, { mochartConfig, tooltipValueObject: tooltipValueObject!, tooltipCategoryIndex, focusedCategoryIndex,
        focusedSeriesId, valueAxisFocusPercentages, seriesFocusPercentages,
        tooltipVisible, categoryCount: chartData.categoryData.values.key.length,
        tooltipLayoutInfo: tooltipLayoutInfo!, tooltipBounds, svgUniqueId,
        // Escape and a click inside close the same way, focus included
        onClose: this.closeTooltip, onEscape: this.closeTooltip, updateTooltipCategoryIndex: this.updateTooltipCategoryIndex,
        onFocus: onFocus ?? (() => {}), onSeriesFilter: onSeriesFilter ?? (() => {}) });

      if (mochartConfig.series.length === 0) {
        const { x, y, width, height } = seriesLayoutInfo;

        const noSeriesStyle = {
          position: 'absolute',
          left: x,
          top: y,
          width,
          maxWidth: width
        };

        const noSeriesEl = body.noSeriesSlot.set('div', () => htmlEl('div'));
        noSeriesEl!.set({ className: mochartCssClasses['noSeries'], style: noSeriesStyle });
        syncFactoryContent(noSeriesEl!, noSeriesFactory, this.factoryContext(width, height, error));
      }
      else {
        body.noSeriesSlot.set(null);
      }

      body.noDataSlot.set(null);
      this.messageRef = null;
    }
    else {
      body.plot.set(null);
      body.tooltip.set(null);
      body.noSeriesSlot.set(null);

      body.plotEmpty.set(PlotEmpty, { mochartConfig, categoryAxisLayoutInfo,
        valueAxisLayoutInfos, plotLayoutInfo,
        valueAxisSeriesCounts: hasChartData ? chartData.seriesData.axisSeriesCounts : emptyAxisSeriesCounts,
        categoryAxisTitleClipPathUniqueId,
        categoryAxisTickLabelClipPathUniqueId,
        valueAxisTitleClipPathUniqueIds });

      const { x, y, width, height } = seriesLayoutInfo;

      const noDataStyle = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        maxWidth: width
      };

      // the loading overlay below owns the loading state; rendering it here too would stack two copies
      if (loading && !isErrorActive(error)) {
        body.noDataSlot.set(null);
        this.messageRef = null;
      }
      else {
        const noDataContentFactory = isErrorActive(error) ? errorFactory
          : hasChartData && categoryCount === 0 ? noDataFactory
          : loadingFactory;

        const noDataEl = body.noDataSlot.set('div', () => htmlEl('div'));
        // -1: never a tab stop, but focusable for the teardown restore below, which reads out the message
        noDataEl!.set({ className: mochartCssClasses['noData'], style: noDataStyle, tabindex: accessibility ? '-1' : null });
        syncFactoryContent(noDataEl!, noDataContentFactory, this.factoryContext(width, height, error));
        this.messageRef = accessibility ? noDataEl!.node as HTMLElement : null;
      }
    }

    body.legend.set(Legend, { mochartConfig, filteredFlags, focusedSeriesId,
      valueAxisFocusPercentages, seriesFocusPercentages, onFocus: onFocus ?? (() => {}),
      uniqueIds: uniqueIds!, onSeriesFilter: onSeriesFilter ?? (() => {}), legendLayoutInfo, legendItemTextLayoutInfo,
      legendItemLayoutInfos, legendItemRawLayoutInfos });

    // The error state wins: never stack the loading overlay on top of error content.
    if (loading && !isErrorActive(error)) {
      const { x, y, width, height } = seriesLayoutInfo;

      const loadingStyle = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        maxWidth: width
      };

      const loadingEl = body.loadingSlot.set('div', () => htmlEl('div'));
      // the overlay is the only message while loading, so it carries the teardown restore's focus target
      loadingEl!.set({ className: mochartCssClasses['loading'], style: loadingStyle, tabindex: accessibility ? '-1' : null });
      syncFactoryContent(loadingEl!, loadingFactory, this.factoryContext(width, height, error));
      this.messageRef = accessibility ? loadingEl!.node as HTMLElement : null;
    }
    else {
      body.loadingSlot.set(null);
    }

    this.restoreTornDownFocus(focusedNode);
  }
}
