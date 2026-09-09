import { NONE, ALIGN_RIGHT } from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import { getRegularDefaults as getSeriesIconRegularDefaults } from './seriesIconConfig';

import type { DeepPartial, TooltipConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<TooltipConfig> = {}, pieMode = false): Partial<TooltipConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, pieMode);
}

export function getRegularDefaults() {
  return {
    visible: true,
    applyFocus: true,
    followPointer: false,
    closeOnClick: true,
    filterSeriesOnClick: false,
    focusCategoryOnClick: false,
    focusSeriesOnClick: false,
    focusCategoryOnHover: false,
    focusSeriesOnHover: false,
    showControls: false,
    filterModeText: 'Filter',
    focusModeText: 'Focus',
    keepInside: false,
    padding: { top: 2, right: 2, bottom: 2, left: 2 },
    lineSpacing: 3,
    valueAlign: ALIGN_RIGHT,
    // Html, not svg: a null opacity leaves the color's own alpha alone, a named one is composited into it (utils/style cssStyleColor).
    backgroundStyle: { strokeColor: 'rgba(0,0,0,0.3)', strokeOpacity: NONE, strokeWidth: 2, fillColor: 'rgba(255,255,255,0.9)', fillOpacity: NONE },
    cornerRadius: 4,
    dropShadow: {
      color: 'rgba(0,0,0,0.3)',
      offsetX: 0,
      offsetY: 5,
      blurRadius: 10
    },
    // The series icons are svg even inside the html tooltip, so they take the legend icon defaults.
    icon: getSeriesIconRegularDefaults(),
    strikeThroughFiltered: false,
    adjustForFiltering: true,
    adjustSizeForFiltering: false,
    showFiltered: true,
    showMissingValues: true,
    filteredValueText: NONE,
    filteredValueCharacter: '-',
    missingValueText: 'N/A',
    rangeValueSeparator: ' - '
  };
}

export function getConditionalDefaults(configWithRegularDefaults: TooltipConfig, pieMode = false) {
  return {
    snapToCategory: conditionalDefault([
      { condition: () => pieMode, suffix: "when chart.type is pie", default: false },
      { condition: () => !pieMode, suffix: "when chart.type is xy", default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, pieMode),
    showCategory: conditionalDefault([
      { condition: () => pieMode, suffix: "when chart.type is pie", default: false },
      { condition: () => !pieMode, suffix: "when chart.type is xy", default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, pieMode)
  };
}
