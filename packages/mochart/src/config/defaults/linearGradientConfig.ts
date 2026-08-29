import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, LinearGradientConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<LinearGradientConfig> = {}, index: number): Partial<LinearGradientConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index);
}

export function getRegularDefaults() {
  return {
    ignore: false,
    x1: 0.0,
    x2: 1.0,
    y1: 0.0,
    y2: 1.0,
    rotation: 0
  };
};

export function getConditionalDefaults(configWithRegularDefaults: LinearGradientConfig, index: number) {
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'LG' + index, defaultText: 'LG${index}' }
    ], configWithRegularDefaults, index)
  }
}
