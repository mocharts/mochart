import { NONE } from '../config/core/constants.js';
import { getCombinedFocusPercentage } from './FocusValue.js';
import type { FocusPercentageMap } from '../types/animation.js';
import type { EnhancedMochartConfig, EnhancedSeriesConfig } from '../types/enhanced.js';

export function leaderSeriesId(mochartConfig: EnhancedMochartConfig, seriesId: string): string {
  const { followSeries } = mochartConfig.seriesById[seriesId];
  return followSeries !== NONE ? followSeries : seriesId;
}

export function getSeriesFocusPercentage(seriesConfig: EnhancedSeriesConfig, valueAxisFocusPercentages: FocusPercentageMap, seriesFocusPercentages: FocusPercentageMap): number | null {
  const { id, axis, useAxisFocus } = seriesConfig;
  if (axis !== undefined && valueAxisFocusPercentages[axis] !== undefined && seriesFocusPercentages[id] !== undefined) {
    const seriesFocusPercentage = seriesFocusPercentages[id];
    return (useAxisFocus && valueAxisFocusPercentages[axis] !== null) ?
      getCombinedFocusPercentage(valueAxisFocusPercentages[axis]!, seriesFocusPercentage!) : seriesFocusPercentage;
  }
  else {
    return null;
  }
}
