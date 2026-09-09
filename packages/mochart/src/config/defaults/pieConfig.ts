import { AUTO, NONE, PIE_LABEL_TYPE_PERCENT, PIE_TOOLTIP_VALUE_TYPE_VALUE, COLOR_CURRENT } from '../core/constants';
import { resolveDefaults, conditionalDefault, defaultRule } from './conditionalDefault';

import type { DeepPartial, PieConfig } from '../../types/config';

export default function getDefaults(config: DeepPartial<PieConfig> = {}): Partial<PieConfig> {
  return resolveDefaults(getRegularDefaults(), getConditionalDefaults, config);
}

export function getRegularDefaults() {
  return {
    innerRadiusFraction: 0,
    outerRadiusFraction: 1,
    startAngle: 0,
    padAngle: 0,
    cornerRadius: 0,
    focusOffsetFraction: 0,
    label: {
      visible: false,
      type: PIE_LABEL_TYPE_PERCENT,
      valueFormat: AUTO,
      percentFormat: AUTO,
      radiusFraction: 0.5,
      minFraction: 0.05,
      adjustForFiltering: true
    },
    tooltip: {
      valueType: PIE_TOOLTIP_VALUE_TYPE_VALUE,
      percentFormat: AUTO
    },
    centerLabel: {
      text: NONE,
      textStyle: { strokeColor: NONE, strokeOpacity: NONE, strokeWidth: NONE, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: NONE }
    },
    centerTotal: {
      visible: false,
      textStyle: { strokeColor: NONE, strokeOpacity: NONE, strokeWidth: NONE, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: NONE },
      format: AUTO,
      adjustForFiltering: true
    },
    centerOffsetXFraction: 0,
    centerOffsetYFraction: 0
  };
}

export function getConditionalDefaults(configWithRegularDefaults: PieConfig) {
  // A full circle rotated by startAngle, so setting startAngle alone never
  // truncates the pie; an explicit endAngle makes a partial/gauge pie.
  const { startAngle } = configWithRegularDefaults;
  return {
    endAngle: conditionalDefault([
      { ...defaultRule, default: startAngle + 360, defaultText: '${startAngle} + 360' }
    ], configWithRegularDefaults, null)
  };
}
