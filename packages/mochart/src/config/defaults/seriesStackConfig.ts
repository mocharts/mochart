import { NONE } from '../core/constants.js';

import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault.js';
import type { DeepPartial, SeriesStackConfig } from '../../types/config.js';

export default function getDefaults(config: DeepPartial<SeriesStackConfig> = {}, index: number, soleValueAxisId: string | null): Partial<SeriesStackConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index, soleValueAxisId);
}

export function getRegularDefaults() {
  return {
    ignore: false,
    outerCap: {
      size: 5,
      type: NONE,
      expand: true
    },
  };
}

export function getConditionalDefaults(configWithRegularDefaults: SeriesStackConfig, index: number, soleValueAxisId: string | null) {
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'SS' + index, defaultText: 'SS${index}' }
    ], configWithRegularDefaults, index),
    axis: conditionalDefault([
      { ...defaultRule, default: soleValueAxisId === null ? undefined : soleValueAxisId, defaultText: 'sole axis id' }
    ], configWithRegularDefaults, index),
  }
}
