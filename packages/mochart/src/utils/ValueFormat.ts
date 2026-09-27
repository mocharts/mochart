import { format, formatSpecifier } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';

import { arrayToMap, idAccessor, hasText } from './utils.js';
import { NONE, AUTO, SCALE_LOG, TYPE_DATE, TYPE_NUMBER } from '../config/core/constants.js';
import type { CategoryAxisConfig } from '../types/config.js';
import type { EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced.js';
import type { CategoryValue } from '../types/data.js';

export type ValueFormatter = (value: number | Date) => CategoryValue;

// the d3 format types whose precision means nothing, so a log axis leaves it alone
const formatTypesWithoutPrecision = new Set(['b', 'c', 'd', 'o', 'x', 'X']);

/**
 * A number format that formats each value on its own rather than through a scale's tickFormat, as tooltip and label
 * values are on any axis and tick labels on a log one: a specifier that leaves its precision open takes 3 significant
 * digits with the trailing zeros trimmed, as the automatic per-value formats do, since there is no tick step or domain
 * to take a precision from and d3's default is 6.
 */
export function getPerValueNumberFormat(specifierString: string): (value: number) => string {
  const specifier = formatSpecifier(specifierString);
  if (specifier.precision === undefined && !formatTypesWithoutPrecision.has(specifier.type)) {
    specifier.precision = 3;
    specifier.trim = true;
  }
  return format(specifier.toString());
}

// the values the SI prefixes cover, yocto to yotta; beyond them d3 pads the last prefix with zeros (1e30 as 1000000Y)
const SI_PREFIX_MIN = 1e-24;
const SI_PREFIX_MAX = 1e27;

/**
 * The automatic number format of a value formatted on its own, as tooltip and label values are and a log axis's tick
 * labels: an SI prefix at the value's own magnitude, with the trailing zeros trimmed, or exponent notation for a
 * value outside the prefixes' range.
 */
export function getAutoPerValueNumberFormat(precision: number): (value: number) => string {
  const prefixed = format('.' + precision + '~s');
  const exponent = format('.' + precision + '~e');
  return value => {
    const magnitude = Math.abs(value);
    return magnitude !== 0 && (magnitude >= SI_PREFIX_MAX || magnitude < SI_PREFIX_MIN) ? exponent(value) : prefixed(value);
  };
}

// two significant digits for tooltip and label values, trimmed as the tick labels are
const autoValuePrecision = 2;
// per value, so the trailing zeros are trimmed as the tick labels' are
const autoCategoryFormatNumber = '.2~s';
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
            const formatter = categoryAxisConfig.scale === SCALE_LOG ? getPerValueNumberFormat(categoryAxisConfig.tickLabel.format) : format(categoryAxisConfig.tickLabel.format);
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
        const formatter = categoryAxisConfig.scale === SCALE_LOG ? getPerValueNumberFormat(categoryAxisConfig.valueFormat) : format(categoryAxisConfig.valueFormat);
        categoryFormat = category => formatter(category as number);
      }
    }
  }
  categoryFormat = applyPrefixAndSuffix(categoryAxisConfig, categoryFormat);
  return categoryFormat;
}

export function getSeriesFormats(seriesConfigs: EnhancedSeriesConfig[]): Record<string, ValueFormatter> {
  return arrayToMap(seriesConfigs, idAccessor, seriesConfig => getSeriesFormat(seriesConfig, seriesConfig.valueAxisConfig));
}

/** The numeric formatting a series applies to its values, before any prefix/suffix. */
function getSeriesValueFormatter(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig): ValueFormatter {
  if (seriesConfig.valueFormat === NONE) {
    return value => value;
  }
  if (seriesConfig.valueFormat === AUTO) {
    if (valueAxisConfig.tickLabel.format === NONE) {
      return value => value;
    }
    // each value at its own magnitude, never through the axis scale's tickFormat: a linear scale's fixes one prefix from
    // the domain maximum, printing 4.5 as 0.00k on an axis to 1000, and a log scale's blanks most values
    const formatter = valueAxisConfig.tickLabel.format === AUTO ? getAutoPerValueNumberFormat(autoValuePrecision) : getPerValueNumberFormat(valueAxisConfig.tickLabel.format);
    return value => formatter(value as number);
  }
  const formatter = format(seriesConfig.valueFormat);
  return value => formatter(value as number);
}

export function getSeriesFormat(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig): ValueFormatter {
  // valuePrefix/valueSuffix decorate the series value, which is what the tooltip shows
  return applyAffixes(seriesConfig.valuePrefix, seriesConfig.valueSuffix,
    getSeriesValueFormatter(seriesConfig, valueAxisConfig));
}

/** The numeric formatting a series applies to its label values, before any prefix/suffix. */
function getSeriesLabelFormatter(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig): ValueFormatter {
  if (seriesConfig.label.format === NONE) {
    return value => value;
  }
  // numeric formatting alone: labels render labelProperty, not the series value
  if (seriesConfig.label.format === AUTO) {
    return getSeriesValueFormatter(seriesConfig, valueAxisConfig);
  }
  const formatter = format(seriesConfig.label.format);
  return value => formatter(value as number);
}

export function getSeriesLabelFormat(seriesConfig: EnhancedSeriesConfig, valueAxisConfig: EnhancedValueAxisConfig): ValueFormatter {
  // labelPrefix/labelSuffix are independent of labelFormat, as the value pair is of valueFormat
  return applyAffixes(seriesConfig.label.prefix, seriesConfig.label.suffix,
    getSeriesLabelFormatter(seriesConfig, valueAxisConfig));
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
