import { COLOR_CURRENT } from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, CrosshairConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<CrosshairConfig> = {}, pieMode = false): Partial<CrosshairConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, pieMode);
}

export function getRegularDefaults() {
  return {
    visible: true,
    applyFocus: true,
    categoryLine: {
      visible: true,
      style: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.3, strokeWidth: 3, strokeDashArray: '10, 5' }
    },
    seriesLine: {
      visible: true,
      style: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.3, strokeWidth: 3, strokeDashArray: '10, 5' }
    },
    showBehindTooltip: false
  };
}

export function getConditionalDefaults(configWithRegularDefaults: CrosshairConfig, pieMode = false) {
  return {
    visible: conditionalDefault([
      { condition: () => pieMode, suffix: 'when chart.type is pie', default: false },
      { condition: () => !pieMode, suffix: 'when chart.type is xy', default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, pieMode)
  };
}
