import { format, formatSpecifier } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';
import { scaleLinear } from 'd3-scale';

import { arrayToMap, idAccessor, hasText } from './utils.js';
import { NONE, AUTO, SCALE_LOG, TYPE_DATE, TYPE_NUMBER } from '../config/core/constants.js';
import type { CategoryAxisConfig } from '../types/config.js';
import type { EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { AxisDomains, AxisScale, CategoryValue } from '../types/data.js';

export type ValueFormatter = (value: number | Date) => CategoryValue;

// the d3 format types whose precision means nothing, so a log axis leaves it alone
const formatTypesWithoutPrecision = new Set(['b', 'c', 'd', 'o', 'x', 'X']);

/**
 * A number format for a log axis, which formats each value on its own rather than through a scale's tickFormat: a
 * specifier that leaves its precision open takes 3 significant digits with the trailing zeros trimmed, as the automatic
 * log formats do, since there is no tick step or domain to take a precision from and d3's default is 6.
 */
export function getLogNumberFormat(specifierString: string): (value: number) => string {
  const specifier = formatSpecifier(specifierString);
  if (specifier.precision === undefined && !formatTypesWithoutPrecision.has(specifier.type)) {
    specifier.precision = 3;
    specifier.trim = true;
  }
  return format(specifier.toString());
}

const autoValueFormatNumber = ".2s";
// a log axis spans magnitudes, so each value takes its own prefix; the trailing zeros are trimmed to match its tick labels
const autoLogValueFormatNumber = '.2~s';
const autoCategoryFormatNumber = '.2s';
const autoCategoryFormatDate = '%c';

export function getCategoryFormat(categoryAxisConfig: CategoryAxisConfig): (category: CategoryValue) => CategoryValue {
  let categoryFormat = (category: CategoryValue): CategoryValue => category;
  if (categoryAxisConfig.type === TYPE_DATE) {
    if (categoryAxisConfig.dateUTC) {
      categoryFormat = (category: CategoryValue) => (category as Date).toUTCString();
    }
    else {
      categoryFormat = (category: CategoryValue) => category.toString();
    }
  }
  if (categoryAxisConfig.valueFormat !== NONE) {
    const timeFormatter = categoryAxisConfig.dateUTC ? utcFormat : timeFormat;
    if (categoryAxisConfig.valueFormat === AUTO) {
      if (categoryAxisConfig.tickLabel.format !== NONE) {
        if (categoryAxisConfig.tickLabel.format === AUTO) {
          if (categoryAxisConfig.type === TYPE_DATE) {
            const formatter = timeFormatter(autoCategoryFormatDate);
            categoryFormat = category => formatter(category as Date);
          }
          else if (categoryAxisConfig.type === TYPE_NUMBER) {
            const formatter = format(autoCategoryFormatNumber);
            categoryFormat = category => formatter(category as number);
          }
        }
        else {
          if (categoryAxisConfig.type === TYPE_DATE) {
            const formatter = timeFormatter(categoryAxisConfig.tickLabel.format);
            categoryFormat = category => formatter(category as Date);
          }
          else if (categoryAxisConfig.type === TYPE_NUMBER) {
            const formatter = categoryAxisConfig.scale === SCALE_LOG ? getLogNumberFormat(categoryAxisConfig.tickLabel.format) : format(categoryAxisConfig.tickLabel.format);
            categoryFormat = category => formatter(category as number);
          }
        }
      }
    }
    else {
      if (categoryAxisConfig.type === TYPE_DATE) {
        const formatter = timeFormatter(categoryAxisConfig.valueFormat);
        categoryFormat = category => formatter(category as Date);
      }
      else if (categoryAxisConfig.type === TYPE_NUMBER) {
        const formatter = categoryAxisConfig.scale === SCALE_LOG ? getLogNumberFormat(categoryAxisConfig.valueFormat) : format(categoryAxisConfig.valueFormat);
        categoryFormat = category => formatter(category as number);
      }
    }
  }
  categoryFormat = applyPrefixAndSuffix(categoryAxisConfig, categoryFormat);
  return categoryFormat;
}

export function getSeriesFormats(seriesConfigs: EnhancedSeriesConfig[], valueAxisConfigs: EnhancedValueAxisConfig[], valueAxisDomains: AxisDomains): Record<string, ValueFormatter> {
  const valueAxisScales = arrayToMap(valueAxisConfigs, idAccessor, valueAxisConfig => scaleLinear().domain(valueAxisDomains[valueAxisConfig.id]));
  return arrayToMap(seriesConfigs, idAccessor, seriesConfig =>
    getSeriesFormat(seriesConfig, seriesConfig.valueAxisConfig, valueAxisScales[seriesConfig.valueAxisConfig.id]));
}

/** The numeric formatting a series applies to its values, before any prefix/suffix. */
function getSeriesValueFormatter(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig, valueAxisScale: AxisScale): ValueFormatter {
  if (seriesConfig.valueFormat === NONE) {
    return value => value;
  }
  if (seriesConfig.valueFormat === AUTO) {
    if (valueAxisConfig.tickLabel.format === NONE) {
      return value => value;
    }
    if (valueAxisConfig.scale === SCALE_LOG) {
      // per value, never the log scale's tickFormat, which blanks most values that are not powers of 10
      const formatter = getLogNumberFormat(valueAxisConfig.tickLabel.format === AUTO ? autoLogValueFormatNumber : valueAxisConfig.tickLabel.format);
      return value => formatter(value as number);
    }
    const formatSpecifier = valueAxisConfig.tickLabel.format === AUTO ? autoValueFormatNumber : valueAxisConfig.tickLabel.format;
    return valueAxisScale.tickFormat(10, formatSpecifier);
  }
  const formatter = format(seriesConfig.valueFormat);
  return value => formatter(value as number);
}

export function getSeriesFormat(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig, valueAxisScale: AxisScale): ValueFormatter {
  // valuePrefix/valueSuffix decorate the series value, which is what the tooltip shows
  return applyAffixes(seriesConfig.valuePrefix, seriesConfig.valueSuffix,
    getSeriesValueFormatter(seriesConfig, valueAxisConfig, valueAxisScale));
}

/** The numeric formatting a series applies to its label values, before any prefix/suffix. */
function getSeriesLabelFormatter(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig, valueAxisScale: AxisScale): ValueFormatter {
  if (seriesConfig.label.format === NONE) {
    return value => value;
  }
  // numeric formatting alone: labels render labelProperty, not the series value
  if (seriesConfig.label.format === AUTO) {
    return getSeriesValueFormatter(seriesConfig, valueAxisConfig, valueAxisScale);
  }
  const formatter = format(seriesConfig.label.format);
  return value => formatter(value as number);
}

export function getSeriesLabelFormat(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig, valueAxisScale: AxisScale): ValueFormatter {
  // labelPrefix/labelSuffix are independent of labelFormat, as the value pair is of valueFormat
  return applyAffixes(seriesConfig.label.prefix, seriesConfig.label.suffix,
    getSeriesLabelFormatter(seriesConfig, valueAxisConfig, valueAxisScale));
}

function applyPrefixAndSuffix<T>(formatConfig: Pick<CategoryAxisConfig, 'valuePrefix' | 'valueSuffix'>, oldFormat: (value: T) => CategoryValue): (value: T) => CategoryValue {
  return applyAffixes(formatConfig.valuePrefix, formatConfig.valueSuffix, oldFormat);
}

function applyAffixes<T>(prefix: string | null, suffix: string | null, oldFormat: (value: T) => CategoryValue): (value: T) => CategoryValue {
  if (hasText(prefix) && hasText(suffix)) {
    return value => (prefix + String(oldFormat(value)) + suffix);
  }
  if (hasText(prefix)) {
    return value => (prefix + String(oldFormat(value)));
  }
  if (hasText(suffix)) {
    return value => (String(oldFormat(value)) + suffix);
  }
  return oldFormat;
}
