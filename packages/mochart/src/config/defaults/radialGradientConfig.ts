import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, RadialGradientConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<RadialGradientConfig> = {}, index: number): Partial<RadialGradientConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index);
}

export function getRegularDefaults() {
  return {
    ignore: false,
    cx: 0.5,
    cy: 0.5,
    fx: 0.5,
    fy: 0.5,
    r: 0.5,
    rotation: 0
  };
};

export function getConditionalDefaults(configWithRegularDefaults: RadialGradientConfig, index: number) {
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'RG' + index, defaultText: 'RG${index}' }
    ], configWithRegularDefaults, index)
  }
}
