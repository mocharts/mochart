import { NONE, TYPE_NUMBER, SCALE_LINEAR, COLOR_CURRENT, STYLE_SAME } from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';

import getAxisDefaults from './axisConfig';
import type { DeepPartial, ValueAxisConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<ValueAxisConfig> = {}, index: number, hasStack: boolean, pieMode = false): Partial<ValueAxisConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config, index, hasStack, pieMode);
}

export function getRegularDefaults() {
  const axisDefaults = getAxisDefaults();
  return {
    ignore: false,
    ...axisDefaults,

    adjustForFiltering: false,
    tickLabel: { ...axisDefaults.tickLabel, adjustSizeForFiltering: false },

    visibleWhenAllFiltered: true,

    baseLine: {
      visible: true,
      front: false,
      style: {
        normal: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.65, strokeWidth: 1, strokeDashArray: NONE },
        focused: { strokeColor: STYLE_SAME, strokeOpacity: 0.65, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME },
        defocused: { strokeColor: STYLE_SAME, strokeOpacity: 0.325, strokeWidth: STYLE_SAME, strokeDashArray: STYLE_SAME }
      }
    },

    focusOnHover: true,
    focusOnClick: false,

    maxMarginFraction: 0.05,
    minMarginFraction: 0.05,

    scale: SCALE_LINEAR,

    ticks: NONE,

    type: TYPE_NUMBER,

    useSeriesFocus: true
  };
}

export function getConditionalDefaults(configWithRegularDefaults: ValueAxisConfig, index: number, hasStack: boolean, pieMode = false) {
  return {
    visible: conditionalDefault([
      { condition: () => pieMode, suffix: "when chart.type is pie", default: false },
      { condition: () => !pieMode, suffix: "when chart.type is xy", default: true },
      { ...defaultRule, default: true }
    ], configWithRegularDefaults, index),
    base: conditionalDefault([
      // pie slices collapse to nothing when filtered, so their values must
      // animate to 0 — a domain-min base would strand the shrink partway
      { condition: () => pieMode, suffix: 'when chart.type is pie', default: 0, defaultText: '0' },
      { condition: (_config, _index) => hasStack, suffix: 'value axis has stacks', default: 0, defaultText: '0' },
      { condition: (_config, _index) => !hasStack, suffix: 'value axis has no stacks', default: NONE, defaultText: NONE },
      { ...defaultRule, default: NONE }
    ], configWithRegularDefaults, index),
    id: conditionalDefault([
      { condition: (_config, _index) => true, suffix: 'value axis index', default: 'VA' + index, defaultText: 'VA${index}' },
      { ...defaultRule, default: 'VA' + index }
    ], configWithRegularDefaults, index),
    order: conditionalDefault([
      { condition: (_config, _index) => true, suffix: 'value axis index', default: index, defaultText: '${index}' },
      { ...defaultRule, default: index }
    ], configWithRegularDefaults, index)
  };
}
