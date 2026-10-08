import validators from './validators.js';

import { AUTO, NONE, MAJOR, TYPE_NUMBER, SCALE_LINEAR, SCALE_LOG } from '../core/constants.js';

import getAxisValidators, { axisStyleValidators, getTickLabelValidators, getMinorTickLabelValidators, getThresholdStepValidators, getTickStepValidators, positiveNumber } from './axisConfig.js';
import type { ValueAxisConfig } from '../../types/config.js';
import type { Validator } from '@mochart/movalid';

type ValueAxisCondition = Partial<Pick<ValueAxisConfig, 'scale'>>;

const scaleLogSuffix = 'when scale is ' + SCALE_LOG;
const scaleLinearSuffix = 'when scale is ' + SCALE_LINEAR;

const scaleLogRule = { condition: ({ scale }: ValueAxisCondition) => scale === SCALE_LOG, suffix: scaleLogSuffix };
const scaleLinearRule = { condition: ({ scale }: ValueAxisCondition) => scale !== SCALE_LOG, suffix: scaleLinearSuffix };

/**
 * The value axis validators. The section config decides the scale-conditional rules, and hasStack whether a
 * series stack draws on the axis: a log axis cannot show a stack, which starts at 0.
 */
export default function getValidators(config: ValueAxisCondition = {}, pieMode = false, hasStack = false) {
  const logOrLinear = (logValidator: Validator, linearValidator: Validator) => validators.conditional([
    { ...scaleLogRule, validator: logValidator },
    { ...scaleLinearRule, validator: linearValidator }
  ], config);
  const stepInterval = logOrLinear(validators.equal(NONE), positiveNumber.orEqual(NONE));
  return {
    // a threshold range may have one end at or below 0 on a log axis, so the entry rule is checked with both ends (validateThresholdEntries)
    ...getAxisValidators(validators.number(), {
      ...getTickLabelValidators(),
      format: validators.numberFormat().orOneOf([NONE, AUTO]),
      adjustSizeForFiltering: validators.boolean()
    }, pieMode, {
      ...getThresholdStepValidators(),
      interval: stepInterval
    }, {
      ...getTickStepValidators(),
      interval: stepInterval,
      minorSteps: logOrLinear(validators.equal(NONE), validators.integerMin(2).orEqual(NONE))
    }, {
      ...getMinorTickLabelValidators(),
      format: validators.numberFormat().orOneOf([NONE, AUTO, MAJOR])
    }),

    adjustForFiltering: validators.boolean(),

    visibleWhenAllFiltered: validators.boolean(),

    // a filtered pie slice shrinks to the base, so a pie takes only 0; a stacked log axis already fails its scale rule, so base adds no second error there
    base: validators.conditional([
      { condition: () => pieMode, suffix: 'when chart type is not xy', validator: validators.equal(0) },
      { condition: ({ scale }: ValueAxisCondition) => scale === SCALE_LOG && !hasStack, suffix: scaleLogSuffix, validator: positiveNumber.orEqual(NONE) },
      { condition: () => true, validator: validators.number().orEqual(NONE) }
    ], config),
    baseLine: validators.partialObjectWithShape({
      visible: validators.boolean(),
      front: validators.boolean(),
      style: axisStyleValidators.styleStates(axisStyleValidators.lineMembers)
    }, true),

    focusOnHover: validators.boolean(),
    focusOnClick: validators.boolean(),

    id: validators.id(),
    ignore: validators.boolean(),

    max: logOrLinear(positiveNumber.orEqual(AUTO), validators.number().orEqual(AUTO)),
    maxOffset: logOrLinear(validators.equal(0), validators.number()),
    maxMarginFraction: validators.numberMin(0),

    min: logOrLinear(positiveNumber.orEqual(AUTO), validators.number().orEqual(AUTO)),
    minOffset: logOrLinear(validators.equal(0), validators.number()),
    minMarginFraction: validators.numberMin(0),

    minTickInterval: logOrLinear(validators.equal(0), validators.numberMin(0)),

    order: validators.integer(),

    scale: validators.conditional([
      { condition: () => pieMode, suffix: 'when chart type is not xy', validator: validators.equal(SCALE_LINEAR) },
      { condition: () => hasStack, suffix: 'when a series stack uses the axis', validator: validators.equal(SCALE_LINEAR) },
      { condition: () => true, validator: validators.oneOf([SCALE_LINEAR, SCALE_LOG]) }
    ], config),

    ticks: validators.arrayOf(validators.objectWithShape({
      value: logOrLinear(positiveNumber, validators.number()),
      label: validators.string().orEqual(undefined),
      minor: validators.boolean().orEqual(undefined)
    }), true).orEqual(NONE),

    softMax: logOrLinear(positiveNumber.orEqual(NONE), validators.number().orEqual(NONE)),
    softMin: logOrLinear(positiveNumber.orEqual(NONE), validators.number().orEqual(NONE)),

    type: validators.equal(TYPE_NUMBER),

    useSeriesFocus: validators.boolean()
  };
}
