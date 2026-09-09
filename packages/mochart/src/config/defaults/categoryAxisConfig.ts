import { AUTO, NONE, TYPE_STRING, SCALE_LINEAR, SCALE_ORDINAL, SIDE_START, SIDE_END } from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';

import getAxisDefaults from './axisConfig';
import { getDefaultsWithoutEnabled as getTruncationDefaultsWithoutEnabled } from './truncationConfig';
import type { DeepPartial, CategoryAxisConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<CategoryAxisConfig> = {}, inverted: boolean, pieMode = false): Partial<CategoryAxisConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, inverted, pieMode);
}

export function getRegularDefaults() {
  const axisDefaults = getAxisDefaults();
  return {
    ...axisDefaults,

    dateUTC: true,

    keyProperty: NONE,

    focusRange: { ...axisDefaults.focusRange, visible: false },
    focusTickMark: { ...axisDefaults.focusTickMark, visible: true },

    categoryPaddingFraction: { inner: 0.1, outer: 0.1 },
    categoryCountPadding: 1,

    minCategoryValueExtent: 1,

    scale: SCALE_ORDINAL,

    tickLabel: {
      ...axisDefaults.tickLabel,
      truncation: { ...getTruncationDefaultsWithoutEnabled(), minLength: 0, maxFraction: 0.2 }
    },

    type: TYPE_STRING,

    valueFormat: AUTO,
    valueLabel: NONE,
    valuePrefix: NONE,
    valueSuffix: NONE
  };
}

export function getConditionalDefaults(configWithRegularDefaults: CategoryAxisConfig, inverted: boolean, pieMode = false) {
  return {
    visible: conditionalDefault([
      { condition: () => pieMode, suffix: "when chart.type is pie", default: false },
      { condition: () => !pieMode, suffix: "when chart.type is xy", default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, inverted),
    side: conditionalDefault([
      { condition: (_config, inverted) => inverted === true, suffix: "when plot.inverted is true", default: SIDE_START },
      { condition: (_config, inverted) => inverted === false, suffix: "when plot.inverted is false", default: SIDE_END },
      { ...defaultRule, default: SIDE_END }
    ], configWithRegularDefaults, inverted),
    maxTickCount: conditionalDefault([
      { condition: ({ scale }, _inverted) => scale === SCALE_LINEAR, suffix: "when scale is linear", default: 10 },
      { condition: ({ scale }, _inverted) => scale === SCALE_ORDINAL, suffix: "when scale is ordinal", default: 0 },
      { ...defaultRule, default: 10 }
    ], configWithRegularDefaults, inverted),
    minTickSpacing: conditionalDefault([
      { condition: ({ scale }, _inverted) => scale === SCALE_LINEAR, suffix: "when scale is linear", default: 12 },
      { condition: ({ scale }, _inverted) => scale === SCALE_ORDINAL, suffix: "when scale is ordinal", default: 4 },
      { ...defaultRule, default: 10 }
    ], configWithRegularDefaults, inverted),
    tickLabel: {
      truncation: {
        enabled: conditionalDefault([
          { condition: ({ type }, _inverted) => type === TYPE_STRING, suffix: "when type is string", default: true },
          { condition: ({ type }, _inverted) => type !== TYPE_STRING, suffix: "when type is not string", default: false },
          { ...defaultRule, default: false }
        ], configWithRegularDefaults, inverted)
      }
    }
  };
}
