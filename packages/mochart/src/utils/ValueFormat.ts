import { format } from 'd3-format';
import { timeFormat, utcFormat } from 'd3-time-format';
import { scaleLinear } from 'd3-scale';

import { arrayToMap, idAccessor } from './utils';
import { NONE, AUTO, TYPE_DATE, TYPE_NUMBER } from '../config/core/constants';
import type { CategoryAxisConfig } from '../types/config';
import type { EnhancedSeriesConfig, EnhancedValueAxisConfig } from '../types/enhanced';
import type { AxisDomains, AxisScale, CategoryValue } from '../types/data';

export type ValueFormatter = (value: number | Date) => CategoryValue;

const autoValueFormatNumber = ".2s";
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
            const formatter = format(categoryAxisConfig.tickLabel.format);
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
        const formatter = format(categoryAxisConfig.valueFormat);
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
  if (prefix !== NONE && suffix !== NONE) {
    return value => (prefix + String(oldFormat(value)) + suffix);
  }
  if (prefix !== NONE) {
    return value => (prefix + String(oldFormat(value)));
  }
  if (suffix !== NONE) {
    return value => (String(oldFormat(value)) + suffix);
  }
  return oldFormat;
}
