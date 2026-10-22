import { hasText, trimText } from './utils.js';
import type { EnhancedSeriesConfig } from '../types/enhanced.js';

export const getSeriesTitle = ({ id, title }: EnhancedSeriesConfig): string => hasText(title) ? trimText(title) : `Series ${id}`;

export const labelSuffix = ": ";
export const noLabel = "";

export const getSeriesLabel = (seriesConfig: EnhancedSeriesConfig, suffix = labelSuffix): string => {
  const { valueLabel, useTitleForValueLabel } = seriesConfig;
  const label = hasText(valueLabel) ? trimText(valueLabel) : useTitleForValueLabel ? getSeriesTitle(seriesConfig) : noLabel;
  return label === noLabel ? label : label + suffix;
};
