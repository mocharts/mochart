import type { EnhancedMochartConfig } from '../types/enhanced.js';

/** Whether the tooltip's pointer, keyboard and button interactions may change the focused category: the tooltip or the crosshair is visible and applies focus. Every path that moves the tooltip's category must agree on it. */
export function tooltipFocusApplies(mochartConfig: EnhancedMochartConfig): boolean {
  const { tooltip: tooltipConfig, crosshair: crosshairConfig } = mochartConfig;
  return (tooltipConfig.visible && tooltipConfig.applyFocus) || (crosshairConfig.visible && crosshairConfig.applyFocus);
}
