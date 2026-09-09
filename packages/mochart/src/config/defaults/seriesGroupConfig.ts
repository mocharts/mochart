import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, SeriesGroupConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<SeriesGroupConfig> = {}, index: number): Partial<SeriesGroupConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index);
}

export function getRegularDefaults() {
  return {
    ignore: false
  };
}

export function getConditionalDefaults(configWithRegularDefaults: SeriesGroupConfig, index: number) {
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'SG' + index, defaultText: 'SG${index}' }
    ], configWithRegularDefaults, index)
  }
}
