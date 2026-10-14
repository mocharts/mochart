import { CHART_TYPE_PIE } from '../config/core/constants.js';
import type { EnhancedMochartConfig } from '../types/enhanced.js';

/** Whether the crosshair takes part in pointer and keyboard interactions: a pie draws no crosshair, so it never opens, closes or focuses there. */
export function crosshairInteractive(mochartConfig: EnhancedMochartConfig): boolean {
  return mochartConfig.crosshair.visible && mochartConfig.chart.type !== CHART_TYPE_PIE;
}

/** Whether the tooltip's pointer, keyboard and button interactions may change the focused category: the tooltip or the crosshair is visible and applies focus. Every path that moves the tooltip's category must agree on it. */
export function tooltipFocusApplies(mochartConfig: EnhancedMochartConfig): boolean {
  const { tooltip: tooltipConfig, crosshair: crosshairConfig } = mochartConfig;
  return (tooltipConfig.visible && tooltipConfig.applyFocus) || (crosshairInteractive(mochartConfig) && crosshairConfig.applyFocus);
}
