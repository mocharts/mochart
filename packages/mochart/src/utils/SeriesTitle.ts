import { NONE } from '../config/core/constants';
import type { EnhancedSeriesConfig } from '../types/enhanced';

export const getSeriesTitle = ({ id, title }: EnhancedSeriesConfig): string => title !== NONE ? title : `Series ${id}`;

export const labelSuffix = ": ";
export const noLabel = "";

export const getSeriesLabel = (seriesConfig: EnhancedSeriesConfig, suffix = labelSuffix): string => {
  const { valueLabel, useTitleForValueLabel } = seriesConfig;
  const label = valueLabel !== NONE ? valueLabel : useTitleForValueLabel ? getSeriesTitle(seriesConfig) : noLabel;
  return label === noLabel ? label : label + suffix;
};
