import type {
  AxisDomains as DataAxisDomains, ChartData, CategoryValue,
  NumericValues as DataNumericValues,
  SeriesDomainObject as DataSeriesDomainObject, SeriesDomainObjects as DataSeriesDomainObjects,
  SeriesValueObject as DataSeriesValueObject, SeriesValueObjects as DataSeriesValueObjects
} from './data';

export type FocusPercentage = number | null;
export type FocusPercentageMap = Record<string, FocusPercentage>;

export interface FocusData {
  focusedCategoryIndex: number;
  focusedValueAxisId: string | null;
  focusedSeriesId: string | null;
  categoryFocusPercentages: FocusPercentage[];
  valueAxisFocusPercentages: FocusPercentageMap;
  seriesFocusPercentages: FocusPercentageMap;
  categoryFocusDomainPercentages?: number[];
  valueAxisFocusDomainPercentages?: number[];
  seriesFocusDomainPercentages?: number[];
  valueAxisComputedFocusDomainPercentages?: Record<string, number[]>;
}

export interface FocusDeltaData<P, D> {
  start: P;
  deltas: D;
  deltaPercentage: number;
  deltaPercentages: D | null;
  deltaFactors: D | null;
  end: P;
}

export type ArrayFocusDeltaData = FocusDeltaData<FocusPercentage[], number[]>;
export type MapFocusDeltaData = FocusDeltaData<FocusPercentageMap, Record<string, number>>;

export interface FocusAnimationData {
  start: FocusData;
  deltaPercentage: number;
  category: ArrayFocusDeltaData;
  valueAxis: MapFocusDeltaData;
  series: MapFocusDeltaData;
  end: FocusData;
  final: FocusData;
}

export type NumericDomain = [number, number];
export type DateDomain = [Date, Date];
export type AxisDomain = NumericDomain | DateDomain;
export type NumericValues = DataNumericValues;
export type SeriesValueObject = DataSeriesValueObject;
export type SeriesValueObjects = DataSeriesValueObjects;
export type SeriesDomainObject = DataSeriesDomainObject;
export type SeriesDomainObjects = DataSeriesDomainObjects;
export type AxisDomains = DataAxisDomains;

export type AnimationChartData = ChartData;

export interface DomainDelta {
  deltaPercentage: number;
  delta: NumericDomain | null;
  deltaFactor?: number;
}

export interface DomainDeltaMap {
  deltaPercentage: number;
  deltas: Record<string, DomainDelta> | null;
  deltaFactor?: number;
}

export type SeriesDomainDelta = Record<string, DomainDelta> & { deltaPercentage: number };

export interface SeriesDomainDeltaMap {
  deltaPercentage: number;
  deltas: Record<string, SeriesDomainDelta> | null;
  deltaFactor?: number;
}

export interface NumericValuesDelta {
  deltaPercentage: number;
  deltas: number[] | null;
  deltaFactor?: number;
  deltaCopied?: boolean;
}

export type SeriesValueDelta = Record<string, NumericValuesDelta | boolean | number> & {
  deltaPercentage: number;
  deltaCopied?: boolean;
};

export interface SeriesValueDeltaMap {
  deltaPercentage: number;
  deltas: Record<string, SeriesValueDelta>;
  deltaCopied?: boolean;
}

export interface NumericArrayDelta {
  start?: number[];
  deltas: number[];
  end?: number[];
  deltaPercentage: number;
  deltaFactor?: number;
}

export interface CompleteNumericArrayDelta extends NumericArrayDelta {
  start: number[];
  end: number[];
}

export interface AxisDeltaData {
  start: AnimationChartData;
  deltaPercentage: number;
  deltas: {
    domain: {
      axis: {
        category: DomainDelta;
        value: { raw: DomainDeltaMap; filtered: DomainDeltaMap };
      };
      series: { raw: SeriesDomainDeltaMap; filtered: SeriesDomainDeltaMap };
    };
    values: { category: CompleteNumericArrayDelta | null };
  };
  end: AnimationChartData;
  final: AnimationChartData;
}

export interface EmptyAxisDeltaData {
  start: null;
  deltaPercentage: 0;
  deltas: null;
  end: null;
  final?: null;
}

export type AxisTransitionData = AxisDeltaData | EmptyAxisDeltaData;

export interface ValueChangeData {
  start: AnimationChartData;
  deltaPercentage: number;
  deltas: {
    categoryOrder: NumericArrayDelta;
    raw: SeriesValueDeltaMap;
    filtered: SeriesValueDeltaMap;
    /** Translating axes interpolate their render domain during this phase (see isDomainTranslation). */
    domain: { category: DomainDelta; raw: DomainDeltaMap; filtered: DomainDeltaMap };
  };
  end: AnimationChartData;
  final: AnimationChartData;
}

export interface ChartAnimationData {
  initialAnimation: boolean;
  categoryDeltaData: CategoryDeltaData;
  axisExpansionData: AxisTransitionData;
  valueChangeData: ValueChangeData;
  axisContractionData: AxisTransitionData;
}

export interface CategoryMergedValuesData {
  old: readonly CategoryValue[];
  merged: readonly CategoryValue[];
  added: readonly CategoryValue[];
  removed: readonly CategoryValue[];
  new: readonly CategoryValue[];
  displayMerged: readonly CategoryValue[];
}

export interface CategoryMergedIndicesData {
  old: number[];
  new: number[];
  added: number[];
  removed: number[];
  reordered: boolean;
}

export interface OuterChangeCounts {
  before: number;
  after: number;
}

export interface CategoryDeltaData {
  values: CategoryMergedValuesData;
  indices: CategoryMergedIndicesData;
  outerCounts: {
    added: OuterChangeCounts;
    removed: OuterChangeCounts;
  };
}
