import validators from './validators';

import { AUTO, NONE, TYPE_NUMBER, SCALE_LINEAR } from '../core/constants';

import getAxisValidators, { axisStyleValidators, getTickLabelValidators } from './axisConfig';

export default function getValidators(pieMode = false) {
  return {
    ...getAxisValidators(validators.number(), {
      ...getTickLabelValidators(),
      format: validators.numberFormat().orOneOf([NONE, AUTO]),
      adjustSizeForFiltering: validators.boolean()
    }, pieMode),

    adjustForFiltering: validators.boolean(),

    visibleWhenAllFiltered: validators.boolean(),

    base: validators.number().orEqual(NONE),
    baseLine: validators.partialObjectWithShape({
      visible: validators.boolean(),
      front: validators.boolean(),
      style: axisStyleValidators.styleStates(axisStyleValidators.lineMembers)
    }, true),

    focusOnHover: validators.boolean(),
    focusOnClick: validators.boolean(),

    id: validators.id(),
    ignore: validators.boolean(),

    max: validators.number().orEqual(AUTO),
    maxOffset: validators.number(),
    maxMarginFraction: validators.numberMin(0),

    min: validators.number().orEqual(AUTO),
    minOffset: validators.number(),
    minMarginFraction: validators.numberMin(0),

    order: validators.integer(),

    scale: validators.equal(SCALE_LINEAR),

    ticks: validators.arrayOf(validators.objectWithShape({
      value: validators.number(),
      label: validators.string().orEqual(undefined)
    }), true).orEqual(NONE),

    softMax: validators.number().orEqual(NONE),
    softMin: validators.number().orEqual(NONE),

    type: validators.equal(TYPE_NUMBER),

    useSeriesFocus: validators.boolean()
  };
}