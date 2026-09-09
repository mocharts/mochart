// every config union type and value constant must be exported by name; the type half is enforced at typecheck time — dropping an export fails `npm run typecheck` on this file
import { describe, it, expect, expectTypeOf } from 'vitest';
import * as mochart from '../../src';
import { CONFIG_VERSION } from '../../src/config/core/constants';
import type {
  CssStyle, MochartInputConfig, MochartConfig,
  Auto, Align, VerticalAlign, Anchor, Position, MissingValueMode, AxisSide, ThresholdTitleSide,
  ChartType, PieLabelType, PieTooltipValueType, Scale, DataType, RendererType, CurveType,
  PatternType, CapType, LabelPosition, ColorMode, ColorInterpolation, MarkerShape, MarkerSizeScale, DomainChange,
  ChartEventPayload, ChartFocus, ChartSeriesFilter, ChartSliceClickPayload, ChartSeriesClickPayload,
  ChartCallbacks, ChartFactories, ChartFactoryContext, ChartFactoryContent, ChartContentFactory,
  BaseChartProps, ManagedChartProps, DefaultChartProps, ChartHandle,
  Bounds, DataProvider, ArrayOfObjectsData, ObjectOfArraysData
} from '../../src';
import { createChart, createDefaultChart } from '../../src';

// exactly the use the finding calls out: naming a config union in a host's own signature
function describeSeries(renderer: RendererType, curve: CurveType, shape: MarkerShape): string {
  return `${renderer}/${curve}/${shape}`;
}

interface EveryUnion {
  auto: Auto; align: Align; verticalAlign: VerticalAlign; anchor: Anchor; position: Position;
  missingValueMode: MissingValueMode; axisSide: AxisSide; thresholdTitleSide: ThresholdTitleSide;
  chartType: ChartType; pieLabelType: PieLabelType; pieTooltipValueType: PieTooltipValueType;
  scale: Scale; dataType: DataType; rendererType: RendererType; curveType: CurveType;
  patternType: PatternType;
  capType: CapType; labelPosition: LabelPosition; colorMode: ColorMode;
  colorInterpolation: ColorInterpolation; markerShape: MarkerShape; markerSizeScale: MarkerSizeScale;
  domainChange: DomainChange;
}

describe('public config type surface', () => {
  it('exposes every config union type by name', () => {
    const values: EveryUnion = {
      auto: 'auto', align: 'left', verticalAlign: 'top', anchor: 'start', position: 'top',
      missingValueMode: 'break', axisSide: 'start', thresholdTitleSide: 'low',
      chartType: 'xy', pieLabelType: 'titlePercent', pieTooltipValueType: 'value',
      scale: 'linear', dataType: 'number', rendererType: 'bar', curveType: 'stepAfter',
      patternType: 'crosshatch',
      capType: 'round', labelPosition: 'inside', colorMode: 'seriesIndex',
      colorInterpolation: 'hcl', markerShape: 'star', markerSizeScale: 'sqrt', domainChange: 'staged'
    };
    expect(Object.keys(values)).toHaveLength(23);
    expect(describeSeries(values.rendererType, values.curveType, values.markerShape)).toBe('bar/stepAfter/star');
  });

  it('discriminates built-in pattern properties by type', () => {
    const config: MochartInputConfig = {
      patterns: [
        { type: 'lines', rotation: 30, lineWidth: 2 },
        { type: 'dots', radius: 2 }
      ]
    };
    const invalidConfig: MochartInputConfig = {
      // @ts-expect-error dots use radius rather than lineWidth
      patterns: [{
        type: 'dots',
        lineWidth: 2
      }]
    };
    expect(config.patterns).toHaveLength(2);
    expect(invalidConfig.patterns).toHaveLength(1);
  });

  it('exposes only the value constants consumers import; enumerated values are written as literals', () => {
    const expected: Record<string, unknown> = {
      AUTO: 'auto', NONE: null,
      TYPE_STRING: 'string', TYPE_NUMBER: 'number', TYPE_DATE: 'date',
      SCALE_ORDINAL: 'ordinal', SCALE_LINEAR: 'linear',
      CHART_TYPE_XY: 'xy', CHART_TYPE_PIE: 'pie',
      CONFIG_VERSION
    };
    const exported = mochart as unknown as Record<string, unknown>;
    for (const [name, value] of Object.entries(expected)) {
      expect(name in exported, `${name} is not exported`).toBe(true);
      expect(exported[name], name).toBe(value);
    }
    const removed = [
      'ALIGN_LEFT', 'RENDERER_BAR', 'CURVE_TYPE_LINEAR', 'MARKER_SHAPE_CIRCLE',
      'PIE_LABEL_TYPE_VALUE', 'COLOR_SERIES', 'PATTERN_TYPE_LINES',
      'Chart', 'Legend', 'Crosshair', 'Tooltip', 'Renderer', 'El', 'svgEl',
      'FocusController', 'StaticDataSource', 'AnimatedDataSource', 'isDataProviderValid'
    ];
    for (const name of removed) {
      expect(name in exported, `${name} should no longer be exported`).toBe(false);
    }
  });
});

// the tooltip background renders as a css border, so its style type has no strokeDashArray — type and validator agree
describe('tooltip background style', () => {
  it('accepts the five keys the validator accepts', () => {
    const config: MochartInputConfig = {
      version: '1.0.0',
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      tooltip: {
        backgroundStyle: {
          strokeColor: '#000000', strokeOpacity: 1, strokeWidth: 1,
          fillColor: '#ffffff', fillOpacity: 1
        }
      }
    };
    expect(config.tooltip).toBeDefined();
  });

  it('rejects strokeDashArray at typecheck time', () => {
    const style: CssStyle = {
      strokeColor: null, strokeOpacity: null, strokeWidth: null,
      fillColor: null, fillOpacity: null,
      // @ts-expect-error the tooltip background has no dash array; validation rejects it too
      strokeDashArray: '4 2'
    };
    expect(style).toBeDefined();
  });
});

// the measure/layout/tween internals and the data-source pipeline are no longer exported; the types a host names to implement DataProvider stay public
import type * as core from '../../src';

export type DataSourceInternals = [
  // @ts-expect-error chart/ChartDataSource.ts internal
  core.ChartDataSource,
  // @ts-expect-error chart/ChartDataSource.ts internal
  core.ChartDataSourceInput,
  // @ts-expect-error chart/ChartDataSource.ts internal
  core.InternalFocus
];

// one directive per type, so re-exporting any single internal makes it unused and fails the typecheck
export type GeometryInternals = [
  // @ts-expect-error types/geometry.ts internal
  core.TextBounds
];
export type ChartInternals = [
  // @ts-expect-error types/chart.ts internal
  core.ChartDomAccessors
];
export type DataInternals = [
  // @ts-expect-error types/data.ts internal
  core.StackData,
  // @ts-expect-error types/data.ts internal
  core.AxisValue,
  // @ts-expect-error types/data.ts internal
  core.TickLabel,
  // @ts-expect-error types/data.ts internal
  core.TickLabelFormatter,
  // @ts-expect-error types/data.ts internal
  core.AxisScale,
  // @ts-expect-error types/data.ts internal
  core.AxisTick,
  // @ts-expect-error types/data.ts internal
  core.CategorySpacingInfo,
  // @ts-expect-error types/data.ts internal
  core.CategoryAxisData,
  // @ts-expect-error types/data.ts internal
  core.SeriesPosition,
  // @ts-expect-error types/data.ts internal
  core.SeriesPositionAccessor,
  // @ts-expect-error types/data.ts internal
  core.SeriesPositionData,
  // @ts-expect-error types/data.ts internal
  core.ValueAxisData,
  // @ts-expect-error types/data.ts internal
  core.AxisData,
  // @ts-expect-error types/data.ts internal
  core.ClippedEdges,
  // @ts-expect-error types/data.ts internal
  core.CategoryValueObject
];
export type AnimationInternals = [
  // @ts-expect-error types/animation.ts internal
  core.ArrayFocusDeltaData,
  // @ts-expect-error types/animation.ts internal
  core.MapFocusDeltaData,
  // @ts-expect-error types/animation.ts internal
  core.FocusAnimationData,
  // @ts-expect-error types/animation.ts internal
  core.NumericDomain,
  // @ts-expect-error types/animation.ts internal
  core.DateDomain,
  // @ts-expect-error types/animation.ts internal
  core.AxisDomain,
  // @ts-expect-error types/animation.ts internal
  core.AnimationChartData,
  // @ts-expect-error types/animation.ts internal
  core.DomainDelta,
  // @ts-expect-error types/animation.ts internal
  core.DomainDeltaMap,
  // @ts-expect-error types/animation.ts internal
  core.SeriesDomainDelta,
  // @ts-expect-error types/animation.ts internal
  core.SeriesDomainDeltaMap,
  // @ts-expect-error types/animation.ts internal
  core.NumericValuesDelta,
  // @ts-expect-error types/animation.ts internal
  core.SeriesValueDelta,
  // @ts-expect-error types/animation.ts internal
  core.SeriesValueDeltaMap,
  // @ts-expect-error types/animation.ts internal
  core.NumericArrayDelta,
  // @ts-expect-error types/animation.ts internal
  core.CompleteNumericArrayDelta,
  // @ts-expect-error types/animation.ts internal
  core.AxisDeltaData,
  // @ts-expect-error types/animation.ts internal
  core.EmptyAxisDeltaData,
  // @ts-expect-error types/animation.ts internal
  core.AxisTransitionData,
  // @ts-expect-error types/animation.ts internal
  core.ValueChangeData,
  // @ts-expect-error types/animation.ts internal
  core.ChartAnimationData,
  // @ts-expect-error types/animation.ts internal
  core.CategoryMergedValuesData,
  // @ts-expect-error types/animation.ts internal
  core.CategoryMergedIndicesData,
  // @ts-expect-error types/animation.ts internal
  core.OuterChangeCounts,
  // @ts-expect-error types/animation.ts internal
  core.CategoryDeltaData
];
export type LayoutInternals = [
  // @ts-expect-error types/layout.ts internal
  core.SpacingBoundsInput,
  // @ts-expect-error types/layout.ts internal
  core.SpacingLayoutInfo,
  // @ts-expect-error types/layout.ts internal
  core.LayoutInfo,
  // @ts-expect-error types/layout.ts internal
  core.BeforeAfter,
  // @ts-expect-error types/layout.ts internal
  core.AxisTickInfo,
  // @ts-expect-error types/layout.ts internal
  core.AxisTickInfos,
  // @ts-expect-error types/layout.ts internal
  core.AxisLayoutInfo,
  // @ts-expect-error types/layout.ts internal
  core.CategoryAxisLayoutInfo,
  // @ts-expect-error types/layout.ts internal
  core.TitleLayoutResult,
  // @ts-expect-error types/layout.ts internal
  core.LegendLayoutResult,
  // @ts-expect-error types/layout.ts internal
  core.PlotLayoutResult,
  // @ts-expect-error types/layout.ts internal
  core.ChartLayoutInfo,
  // @ts-expect-error types/layout.ts internal
  core.ChartTextBoundsData,
  // @ts-expect-error types/layout.ts internal
  core.ChartDataForLayout
];

// the kept surface, named the way a host implementing the DataProvider extension point has to name it
const rows: readonly core.DataObject[] = [{ month: 'Jan', sales: 10 }, { month: 'Feb', sales: 20 }];

const provider: core.DataProvider = {
  getPropertyValues: (property: string): readonly core.DataValue[] | undefined =>
    rows.some(row => property in row) ? rows.map(row => row[property] as core.DataValue) : undefined,
  getError: (): unknown => null,
  getLoading: (): boolean => false,
  refresh: (): void => {}
};

describe('public extension-point type surface', () => {
  it('exposes every type a DataProvider implementation names', () => {
    expect(provider.getPropertyValues('month')).toEqual(['Jan', 'Feb']);
    expect(provider.getPropertyValues('sales')).toEqual([10, 20]);
    expect(provider.getPropertyValues('vlaue')).toBeUndefined();
  });

  it('reports its bounds and spacing types by name', () => {
    const size: core.Size = { width: 10, height: 20 };
    const bounds: core.Bounds = { ...size, x: 0, y: 0 };
    const marginPadding: core.MarginPadding = { top: 1, right: 1, bottom: 1, left: 1 };
    const innerOuter: core.InnerOuter = { inner: 1, outer: 2 };
    expect([bounds.width, marginPadding.top, innerOuter.inner]).toEqual([10, 1, 1]);
  });
});

// the chart prop and factory shapes are the contract every binding builds on; these pins are compile-time (expectTypeOf), so a widened member, an added/dropped key or a loosened optionality fails `npm run typecheck`
type Callback<TArg> = ((arg: TArg) => void) | undefined;

describe('chart prop and factory type surface', () => {
  it('pins the callback payload shapes', () => {
    expectTypeOf<ChartEventPayload>().toEqualTypeOf<{
      chartX: number; chartY: number;
      categoryPosition: number; valuePosition: number;
      categoryFraction: number; valueFraction: number;
      categoryIndex: number;
    }>();
    expectTypeOf<ChartFocus>().toEqualTypeOf<{
      focusedValueAxisId: string | null; focusedSeriesId: string | null; focusedCategoryIndex: number;
    }>();
    expectTypeOf<ChartSeriesFilter>().toEqualTypeOf<{ filteredSeriesIds: Record<string, boolean> }>();
    expectTypeOf<ChartSliceClickPayload>().toEqualTypeOf<{ seriesId: string }>();
    expectTypeOf<ChartSeriesClickPayload>().toEqualTypeOf<{
      seriesId: string; categoryIndex: number; nearestCategoryIndex: number;
    }>();
  });

  it('pins every callback: optional, void-returning, one typed payload', () => {
    expectTypeOf<ChartCallbacks>().toEqualTypeOf<{
      onChartClick?: Callback<ChartEventPayload>;
      onSliceClick?: Callback<ChartSliceClickPayload>;
      onSeriesClick?: Callback<ChartSeriesClickPayload>;
      onChartMouseEnter?: Callback<ChartEventPayload>;
      onChartMouseMove?: Callback<ChartEventPayload>;
      onChartMouseLeave?: Callback<ChartEventPayload>;
      onTitleClick?: (() => void) | undefined;
      onFocus?: Callback<ChartFocus>;
      onSeriesFilter?: Callback<ChartSeriesFilter>;
      onSeriesLayoutBoundsChange?: Callback<Bounds>;
    }>();
  });

  it('pins the factory context, content and factory map', () => {
    expectTypeOf<ChartFactoryContext>().toEqualTypeOf<{
      width: number; height: number;
      mochartConfig: MochartConfig | null; dataProvider: DataProvider | null;
      error: unknown; hasData: boolean;
    }>();
    expectTypeOf<ChartFactoryContent>().toEqualTypeOf<Node | string | number | false | null | undefined>();
    // `true` is deliberately not content: it would render as nothing while looking like "show the default"
    expectTypeOf<true>().not.toExtend<ChartFactoryContent>();
    expectTypeOf<ChartContentFactory>().toEqualTypeOf<(context: ChartFactoryContext) => ChartFactoryContent>();
    expectTypeOf<ChartFactories>().toEqualTypeOf<{
      getLoadingComponent?: ChartContentFactory | undefined;
      getErrorComponent?: ChartContentFactory | undefined;
      getNoDataComponent?: ChartContentFactory | undefined;
      getNoSizeComponent?: ChartContentFactory | undefined;
      getNoSeriesComponent?: ChartContentFactory | undefined;
      getConfigErrorComponent?: ChartContentFactory | undefined;
    }>();
  });

  // expect-type does not equate `A & B & {...}` with an interface extending A and B, so the extended
  // shapes are pinned as inherited part + own part + complete key set
  it('pins the base props: size required, everything else optional and typed', () => {
    type OwnBaseProps = {
      width: number; height: number;
      style?: string | Record<string, string | number | null | undefined> | undefined;
      loading?: boolean | undefined;
      error?: unknown;
      focusedCategoryIndex?: number | undefined;
      focusedValueAxisId?: string | null | undefined;
      focusedSeriesId?: string | null | undefined;
      filteredSeriesIds?: Record<string, boolean> | undefined;
    };
    expectTypeOf<Pick<BaseChartProps, keyof ChartCallbacks>>().toEqualTypeOf<ChartCallbacks>();
    expectTypeOf<Pick<BaseChartProps, keyof ChartFactories>>().toEqualTypeOf<ChartFactories>();
    expectTypeOf<Omit<BaseChartProps, keyof ChartCallbacks | keyof ChartFactories>>().toEqualTypeOf<OwnBaseProps>();
    expectTypeOf<keyof BaseChartProps>().toEqualTypeOf<keyof ChartCallbacks | keyof ChartFactories | keyof OwnBaseProps>();
    // @ts-expect-error width and height have no default; a binding must measure them
    const sizeless: BaseChartProps = {};
    expect(sizeless).toBeDefined();
  });

  it('pins the two entry-point prop sets and their factory signatures', () => {
    expectTypeOf<Pick<ManagedChartProps, keyof BaseChartProps>>().toEqualTypeOf<BaseChartProps>();
    expectTypeOf<Omit<ManagedChartProps, keyof BaseChartProps>>().toEqualTypeOf<{
      mochartConfig: MochartConfig | null; dataProvider: DataProvider | null;
    }>();
    expectTypeOf<Pick<DefaultChartProps, keyof BaseChartProps>>().toEqualTypeOf<BaseChartProps>();
    expectTypeOf<Omit<DefaultChartProps, keyof BaseChartProps>>().toEqualTypeOf<{
      config: MochartInputConfig; data: ArrayOfObjectsData | ObjectOfArraysData;
    }>();
    // both are required: `null` says "not loaded yet", an absent key is a host bug
    // @ts-expect-error mochartConfig and dataProvider must be passed, even as null
    const managed: ManagedChartProps = { width: 1, height: 1 };
    // @ts-expect-error config and data must be passed
    const plain: DefaultChartProps = { width: 1, height: 1 };
    expect([managed, plain]).toHaveLength(2);

    expectTypeOf(createChart).toEqualTypeOf<(container: Element, props: ManagedChartProps) => ChartHandle<ManagedChartProps>>();
    expectTypeOf(createDefaultChart).toEqualTypeOf<(container: Element, props: DefaultChartProps) => ChartHandle<DefaultChartProps>>();
    expectTypeOf<ChartHandle<DefaultChartProps>>().toEqualTypeOf<{
      update(nextProps: Partial<DefaultChartProps>): void;
      replace(nextProps: DefaultChartProps): void;
      refresh(): void;
      destroy(): void;
    }>();
    // the handle's default parameter is the managed prop set
    expectTypeOf<ChartHandle>().toEqualTypeOf<ChartHandle<ManagedChartProps>>();
  });
});
