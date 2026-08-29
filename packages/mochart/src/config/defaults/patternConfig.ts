import {
  COLOR_SERIES, NONE, PATTERN_TYPE_CROSSHATCH, PATTERN_TYPE_DOTS, PATTERN_TYPE_LINES
} from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';
import type { DeepPartial, PatternConfig, PatternInputConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<PatternInputConfig> = {}, index: number): Partial<PatternConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index);
}

export function getRegularDefaults() {
  return {
    ignore: false,
    spacing: 8,
    foregroundColor: COLOR_SERIES,
    foregroundOpacity: 1,
    backgroundColor: NONE,
    backgroundOpacity: 1
  };
}

export function getConditionalDefaults(configWithRegularDefaults: PatternConfig, index: number) {
  const linePattern = ({ type }: PatternConfig) => type === PATTERN_TYPE_LINES || type === PATTERN_TYPE_CROSSHATCH;
  const dotPattern = ({ type }: PatternConfig) => type === PATTERN_TYPE_DOTS;
  return {
    id: conditionalDefault([
      { ...defaultRule, default: 'P' + index, defaultText: 'P${index}' }
    ], configWithRegularDefaults, index),
    rotation: conditionalDefault([
      { condition: linePattern, suffix: 'when type is lines or crosshatch', default: 45 },
      { ...defaultRule, default: undefined }
    ], configWithRegularDefaults, index),
    lineWidth: conditionalDefault([
      { condition: linePattern, suffix: 'when type is lines or crosshatch', default: 2 },
      { ...defaultRule, default: undefined }
    ], configWithRegularDefaults, index),
    radius: conditionalDefault([
      { condition: dotPattern, suffix: 'when type is dots', default: 2 },
      { ...defaultRule, default: undefined }
    ], configWithRegularDefaults, index)
  };
}
