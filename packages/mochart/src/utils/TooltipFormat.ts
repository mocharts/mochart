import { NONE, PIE_TOOLTIP_VALUE_TYPE_PERCENT, MISSING_VALUE_MODE_CONNECT, CHART_TYPE_PIE } from '../config/core/constants';
import { getSeriesLabel } from './SeriesTitle';
import { getCategoryFormat, getSeriesFormats } from './ValueFormat';
import { formatPieLabelType, pieLabelTypeUsesPercent, getPieTooltipPercentFormat } from '../data/PieLabel';
import { getPieSliceFractionMap } from '../data/PieData';
import type { PieTooltipValueType } from '../config/core/constants';
import type { TooltipConfig } from '../types/config';
import type { EnhancedMochartConfig, EnhancedSeriesConfig } from '../types/enhanced';
import type { SeriesDomainObjects } from '../types/data';
import type { CategorySeriesValueObject as ChartCategorySeriesValueObject } from '../data/ChartData';
import type { ValueKey } from '../data/constants';
import type { ValueFormatter } from './ValueFormat';

type CategorySeriesValueObject = Partial<Record<ValueKey, number | null | undefined>>;
interface CategorySeriesSlice {
  axisBases: Record<string, number | null>;
  raw: { values: Record<string, CategorySeriesValueObject>; domains: SeriesDomainObjects };
  filtered: { values: Record<string, CategorySeriesValueObject>; domains: SeriesDomainObjects };
}

function getFilteredValueText(tooltipConfig: TooltipConfig, defaultValueText: string): string {
  let seriesValueText: string;
  if (tooltipConfig.filteredValueText !== NONE) {
    seriesValueText = tooltipConfig.filteredValueText;
  }
  else if (tooltipConfig.filteredValueCharacter !== NONE) {
    const filteredCharacter = tooltipConfig.filteredValueCharacter;
    const characterCount = defaultValueText.length;
    seriesValueText = '';
    for (let i = 0; i < characterCount; i++) {
      seriesValueText+= filteredCharacter;
    }
  }
  else {
    seriesValueText = defaultValueText;
  }
  return seriesValueText;
}

function getValueText(tooltipConfig: TooltipConfig, seriesConfig: EnhancedSeriesConfig, adjustForFiltering: boolean, valueFormat: ValueFormatter, series: CategorySeriesSlice, key: ValueKey): string | null {
  const { raw, filtered, axisBases } = series;
  const seriesId = seriesConfig.id;
  const seriesValueObject = raw.values[seriesId];
  const filterValueObject = filtered.values[seriesId];
  const hasFilterValue = filterValueObject[key] !== null;

  let seriesValueText = null;
  if (seriesValueObject[key] !== undefined) {
    if (adjustForFiltering && tooltipConfig.adjustForFiltering) {
      if (hasFilterValue) {
        seriesValueText = String(valueFormat(filterValueObject[key]!));
      }
      else {
        const axisBase = axisBases[seriesConfig.valueAxisConfig.id];
        seriesValueText = getFilteredValueText(tooltipConfig,
          axisBase !== null ? String(valueFormat(axisBase)) : tooltipConfig.missingValueText);
      }
    }
    else {
      seriesValueText = String(valueFormat(seriesValueObject[key]!));
    }
  }
  else if (tooltipConfig.showMissingValues) {
    if (hasFilterValue) {
      seriesValueText = tooltipConfig.missingValueText;
    }
    else {
      seriesValueText = getFilteredValueText(tooltipConfig, tooltipConfig.missingValueText);
    }
  }
  return seriesValueText;
}

/**
 * What a pie slice's tooltip value needs beyond its value: content type, percent formatter, slice
 * fraction. The caller picks the fraction from the filtered or raw values (see TooltipContent),
 * so a combined value's value and percentage always come from the same snapshot.
 */
export interface PieTooltipValues {
  valueType: PieTooltipValueType;
  percentFormat: (fraction: number) => string;
  /** The slice's fraction, already chosen from the filtered or raw values. */
  fraction: number;
  /** The slice's fraction of the full total, sizing a filtered placeholder. */
  rawFraction: number;
  /** Whether the slice is filtered — from the row's filtered flag, since a percentage
   * is derived rather than stored per value key like the values getValueText tests. */
  filtered: boolean;
}

function getPieValueText(tooltipConfig: TooltipConfig, seriesConfig: EnhancedSeriesConfig, adjustForFiltering: boolean,
  valueFormat: ValueFormatter, series: CategorySeriesSlice, pieValues: PieTooltipValues): string | null {
  const { valueType, percentFormat, fraction, rawFraction, filtered } = pieValues;

  // No value means no row, whichever parts the type asks for — a bare "0.0%"
  // for a slice that has no value would read as a real zero share.
  const valueText = getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'plain');
  if (valueText === null) {
    return null;
  }

  // A filtered slice's filtered fraction is 0, so show the same placeholder
  // the values use, sized from the slice's share of the full total.
  const percentText = adjustForFiltering && tooltipConfig.adjustForFiltering && filtered ?
    getFilteredValueText(tooltipConfig, percentFormat(rawFraction)) : percentFormat(fraction);

  if (valueType === PIE_TOOLTIP_VALUE_TYPE_PERCENT) {
    return percentText;
  }
  return formatPieLabelType(valueType, { title: getSeriesLabel(seriesConfig), value: valueText, percent: percentText });
}

export function getSeriesText(tooltipConfig: TooltipConfig, seriesConfig: EnhancedSeriesConfig, valueFormat: ValueFormatter, series: CategorySeriesSlice,
  adjustForFiltering: boolean, pieValues?: PieTooltipValues) {
  const labelText = getSeriesLabel(seriesConfig);

  if (seriesConfig.tooltipProperty !== NONE) {
    return {
      labelText,
      valueText: getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'tooltip')
    };
  }

  // Pie slices are plain values, so the percentage-bearing types short-circuit
  // the range/marker/error composition below, which cannot apply to them. An
  // explicit per-series tooltipProperty still wins (above).
  if (pieValues !== undefined && pieLabelTypeUsesPercent(pieValues.valueType)) {
    return { labelText, valueText: getPieValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, pieValues) };
  }

  // Mirror the shape's skip semantics (see getSeriesPositionData): under connect+partialRangeIsMissing
  // the direction-split idiom (waterfall, candlestick, OHLC) means "not this direction", not "no data",
  // so those rows (and plain followSeries rows, e.g. direction-split volume) hide instead of "value – N/A".
  if (seriesConfig.missingValueMode === MISSING_VALUE_MODE_CONNECT && seriesConfig.stack === NONE) {
    const rawValueObject = series.raw.values[seriesConfig.id];
    if (seriesConfig.rangeProperty !== NONE && seriesConfig.partialRangeIsMissing &&
      (rawValueObject.plain === undefined || rawValueObject.range === undefined)) {
      return { labelText, valueText: null };
    }
    if (seriesConfig.rangeProperty === NONE && seriesConfig.followSeries !== NONE && rawValueObject.plain === undefined) {
      return { labelText, valueText: null };
    }
  }

  const seriesValueText = getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'plain');
  const rangeSeriesValueText = seriesConfig.rangeProperty !== NONE ? getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'range') : null;
  const markerSeriesValueText = seriesConfig.markerProperty !== NONE ? getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'marker') : null;
  // An undefined error bound is a legitimate one-sided error bar, not missing
  // data, so it renders nothing rather than the missingValueText.
  const rawValueObject = series.raw.values[seriesConfig.id];
  const errorLowValueText = seriesConfig.errorLowProperty !== NONE && rawValueObject.errorLow !== undefined ?
    getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'errorLow') : null;
  const errorHighValueText = seriesConfig.errorHighProperty !== NONE && rawValueObject.errorHigh !== undefined ?
    getValueText(tooltipConfig, seriesConfig, adjustForFiltering, valueFormat, series, 'errorHigh') : null;

  let valueText = null;
  if (seriesValueText !== null && rangeSeriesValueText !== null) {
    // A range whose two ends format identically collapses to the single value,
    // e.g. an OHLC open/close tick whose property and rangeProperty match.
    valueText = rangeSeriesValueText === seriesValueText ? seriesValueText : rangeSeriesValueText + tooltipConfig.rangeValueSeparator + seriesValueText;
  }
  else if (seriesValueText !== null) {
    valueText = seriesValueText;
  }
  else if (rangeSeriesValueText != null) {
    valueText = rangeSeriesValueText;
  }
  const errorValueText = errorLowValueText !== null && errorHighValueText !== null ?
    errorLowValueText + tooltipConfig.rangeValueSeparator + errorHighValueText :
    (errorLowValueText ?? errorHighValueText);
  if (errorValueText !== null) {
    valueText = valueText === null ? '(' + errorValueText + ')' : valueText + ' (' + errorValueText + ')';
  }
  if (valueText === null && markerSeriesValueText !== null) {
    valueText = '(' + markerSeriesValueText + ')';
  }
  else if (valueText !== null && markerSeriesValueText !== null) {
    valueText = valueText + ' (' + markerSeriesValueText + ')';
  }
  return {
    labelText,
    valueText
  };
}

/**
 * The tooltip's content as one plain sentence for the keyboard aria-live announcer — "Jan: Sales:
 * 42, Costs: 17" — mirroring TooltipContent's rows (category line, then every showInTooltip series
 * whose row has a value), with pie percent values normalized like the slice labels.
 */
export function getTooltipAnnouncement(mochartConfig: EnhancedMochartConfig, tooltipValueObject: ChartCategorySeriesValueObject): string {
  const { chart: chartConfig, pie: pieConfig, tooltip: tooltipConfig, categoryAxis: categoryAxisConfig,
    valueAxes: valueAxisConfigs, series: seriesConfigs } = mochartConfig;
  const { category, series } = tooltipValueObject;
  const { raw, filtered, filteredFlags } = series;

  const pieTooltipValueType = pieConfig.tooltip.valueType;
  let piePercentFormat: ((fraction: number) => string) | null = null;
  let rawFractions: Record<string, number> = {};
  let adjustedFractions: Record<string, number> = {};
  if (chartConfig.type === CHART_TYPE_PIE && pieLabelTypeUsesPercent(pieTooltipValueType)) {
    piePercentFormat = getPieTooltipPercentFormat(pieConfig);
    rawFractions = getPieSliceFractionMap(seriesConfigs, seriesId => raw.values[seriesId]?.plain);
    adjustedFractions = tooltipConfig.adjustForFiltering ?
      getPieSliceFractionMap(seriesConfigs, seriesId => filtered.values[seriesId]?.plain) : rawFractions;
  }

  let categoryPart = '';
  if (tooltipConfig.showCategory) {
    const categoryFormat = getCategoryFormat(categoryAxisConfig);
    const categoryLabel = categoryAxisConfig.valueLabel !== NONE ? categoryAxisConfig.valueLabel + ': ' : '';
    categoryPart = categoryLabel + String(categoryFormat(category.values.parsed!));
  }

  const rows: string[] = [];
  const valueFormats = getSeriesFormats(seriesConfigs, valueAxisConfigs, raw.renderAxisDomains);
  for (const seriesConfig of seriesConfigs) {
    if (!seriesConfig.showInTooltip) {
      continue;
    }
    const seriesId = seriesConfig.id;
    const seriesIsFiltered = filteredFlags[seriesId];
    if (seriesIsFiltered && !tooltipConfig.showFiltered) {
      continue;
    }
    const pieValues: PieTooltipValues | undefined = piePercentFormat === null ? undefined : {
      valueType: pieTooltipValueType, percentFormat: piePercentFormat,
      fraction: adjustedFractions[seriesId] ?? 0, rawFraction: rawFractions[seriesId] ?? 0,
      filtered: seriesIsFiltered
    };
    const { labelText, valueText } = getSeriesText(tooltipConfig, seriesConfig, valueFormats[seriesId], series, true, pieValues);
    if (valueText !== null) {
      rows.push(labelText + valueText);
    }
  }

  if (categoryPart === '') {
    return rows.join(', ');
  }
  return rows.length === 0 ? categoryPart : categoryPart + ': ' + rows.join(', ');
}
