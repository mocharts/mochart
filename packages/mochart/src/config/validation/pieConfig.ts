import validators from './validators';
import { AUTO, NONE, PIE_LABEL_TYPES, PIE_TOOLTIP_VALUE_TYPES } from '../core/constants';

export default function getValidators() {
  return {
    innerRadiusFraction: validators.numberMinMax(0, 1),
    outerRadiusFraction: validators.numberMinMax(0, 1),
    startAngle: validators.number(),
    endAngle: validators.number(),
    padAngle: validators.numberMin(0),
    cornerRadius: validators.numberMin(0),
    focusOffsetFraction: validators.numberMinMax(0, 1),
    label: validators.partialObjectWithShape({
      visible: validators.boolean(),
      type: validators.oneOf(PIE_LABEL_TYPES),
      valueFormat: validators.numberFormat().orEqual(AUTO),
      percentFormat: validators.numberFormat().orEqual(AUTO),
      radiusFraction: validators.numberMinMax(0, 1),
      minFraction: validators.numberMinMax(0, 1),
      adjustForFiltering: validators.boolean()
    }, true),
    tooltip: validators.partialObjectWithShape({
      valueType: validators.oneOf(PIE_TOOLTIP_VALUE_TYPES),
      percentFormat: validators.numberFormat().orEqual(AUTO)
    }, true),
    centerLabel: validators.partialObjectWithShape({
      text: validators.string().orEqual(NONE),
      textStyle: validators.style()
    }, true),
    centerTotal: validators.partialObjectWithShape({
      visible: validators.boolean(),
      textStyle: validators.style(),
      format: validators.numberFormat().orEqual(AUTO),
      adjustForFiltering: validators.boolean()
    }, true),
    centerOffsetXFraction: validators.numberMinMax(-1, 1),
    centerOffsetYFraction: validators.numberMinMax(-1, 1)
  };
}
