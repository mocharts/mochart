import validators from './validators';

import { AUTO, NONE, SCALE_ORDINAL, SCALE_LINEAR, TYPE_STRING, TYPE_NUMBER, TYPE_DATE } from '../core/constants';

import getAxisValidators, { getTickLabelValidators } from './axisConfig';
import { getPropertyMessage, isConfigObject } from './messages';
import type { CategoryAxisConfig } from '../../types/config';
import type { ConfigObject, LocatedValidationMessage } from './messages';

type CategoryAxisCondition = Pick<CategoryAxisConfig, 'type' | 'scale'>;

const typeStringSuffix = 'when type is ' + TYPE_STRING;
const typeDateSuffix = 'when type is ' + TYPE_DATE;
const typeNumberSuffix = 'when type is ' + TYPE_NUMBER;
const scaleOrdinalSuffix = 'when scale is ' + SCALE_ORDINAL;
const scaleLinearSuffix = 'when scale is ' + SCALE_LINEAR;
const linearDateSuffix = 'when scale is ' + SCALE_LINEAR + ' and type is ' + TYPE_DATE;
const linearNumberSuffix = 'when scale is ' + SCALE_LINEAR + ' and type is ' + TYPE_NUMBER;

const typeStringRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_STRING, suffix: typeStringSuffix };
const typeDateRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_DATE, suffix: typeDateSuffix };
const typeNumberRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_NUMBER, suffix: typeNumberSuffix };
const scaleOrdinalRule = { condition: ({ scale }: CategoryAxisCondition) => scale === SCALE_ORDINAL, suffix: scaleOrdinalSuffix };
const scaleLinearRule = { condition: ({ scale }: CategoryAxisCondition) => scale === SCALE_LINEAR, suffix: scaleLinearSuffix };
const linearDateRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_LINEAR && type === TYPE_DATE, suffix: linearDateSuffix };
const linearNumberRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_LINEAR && type === TYPE_NUMBER, suffix: linearNumberSuffix };
const defaultRule = { condition: () => true };

export default function getValidators(config: Partial<CategoryAxisConfig>, pieMode = false) {
  return {
    ...getAxisValidators(validators.conditional([
      { ...typeDateRule, validator: validators.datePrimitive() },
      { ...defaultRule, validator: validators.number() }
    ], config), {
      ...getTickLabelValidators(),
      format: validators.conditional([
        { ...typeStringRule, validator: validators.oneOf([NONE, AUTO]) },
        { ...typeDateRule, validator: validators.dateFormat().orOneOf([NONE, AUTO]) },
        { ...typeNumberRule, validator: validators.numberFormat().orOneOf([NONE, AUTO]) },
        { ...defaultRule, validator: validators.any() }
      ], config),
      truncationEnabled: validators.conditional([
        { ...scaleLinearRule, validator: validators.equal(false) },
        { ...defaultRule, validator: validators.boolean() }
      ], config),
      truncationMaxFraction: validators.numberMinMax(0, 1),
      truncationMinLength: validators.numberMin(0),
      truncationText: validators.string(),
      truncationTooltipEnabled: validators.boolean()
    }, pieMode),

    dateUTC: validators.boolean(),

    keyProperty: validators.propertyOptional(),

    categoryPaddingFraction: validators.partialObjectWith(['inner', 'outer'], validators.numberMinMax(0, 1)),
    categoryCountPadding: validators.numberMin(0),

    max: validators.conditional([
      { ...linearDateRule, validator: validators.datePrimitive().orEqual(AUTO) },
      { ...linearNumberRule, validator: validators.number().orEqual(AUTO) },
      { ...scaleOrdinalRule, validator: validators.equal(AUTO) },
      { ...defaultRule, validator: validators.any() }
    ], config),
    maxOffset: validators.conditional([
      { ...scaleLinearRule, validator: validators.number() },
      { ...scaleOrdinalRule, validator: validators.equal(0) },
      { ...defaultRule, validator: validators.any() }
    ], config),

    min: validators.conditional([
      { ...linearDateRule, validator: validators.datePrimitive().orEqual(AUTO) },
      { ...linearNumberRule, validator: validators.number().orEqual(AUTO) },
      { ...scaleOrdinalRule, validator: validators.equal(AUTO) },
      { ...defaultRule, validator: validators.any() }
    ], config),
    minCategoryValueExtent: validators.numberMin(1),
    minOffset: validators.conditional([
      { ...scaleLinearRule, validator: validators.number() },
      { ...scaleOrdinalRule, validator: validators.equal(0) },
      { ...defaultRule, validator: validators.any() }
    ], config),

    property: validators.propertyRequired(),

    scale: validators.conditional([
      { ...typeStringRule, validator: validators.equal(SCALE_ORDINAL) },
      { ...defaultRule, validator: validators.oneOf([SCALE_LINEAR, SCALE_ORDINAL]) }
    ], config),

    softMax: validators.conditional([
      { ...linearDateRule, validator: validators.datePrimitive().orEqual(NONE) },
      { ...linearNumberRule, validator: validators.number().orEqual(NONE) },
      { ...scaleOrdinalRule, validator: validators.equal(NONE) },
      { ...defaultRule, validator: validators.any() }
    ], config),
    softMin: validators.conditional([
      { ...linearDateRule, validator: validators.datePrimitive().orEqual(NONE) },
      { ...linearNumberRule, validator: validators.number().orEqual(NONE) },
      { ...scaleOrdinalRule, validator: validators.equal(NONE) },
      { ...defaultRule, validator: validators.any() }
    ], config),
    type: validators.oneOf([TYPE_NUMBER, TYPE_DATE, TYPE_STRING]),

    valueFormat: validators.conditional([
      { ...typeStringRule, validator: validators.oneOf([NONE, AUTO]) },
      { ...typeDateRule, validator: validators.dateFormat().orOneOf([NONE, AUTO]) },
      { ...typeNumberRule, validator: validators.numberFormat().orOneOf([NONE, AUTO]) },
      { ...defaultRule, validator: validators.any() }
    ], config),
    valueLabel: validators.string().orEqual(NONE),
    valuePrefix: validators.string().orEqual(NONE),
    valueSuffix: validators.string().orEqual(NONE)
  };
}

/** An ordinal axis places its categories at even positions, so there is no value scale to place a threshold on. */
export const ordinalThresholdsMessage = 'should be an empty array when scale is ' + SCALE_ORDINAL;

export function validateOrdinalThresholds(config: ConfigObject, errors: string[], errorDetails: LocatedValidationMessage[]): void {
  const categoryAxis = config['categoryAxis'];
  if (!isConfigObject(categoryAxis) || categoryAxis['scale'] !== SCALE_ORDINAL) {
    return;
  }
  const thresholds = categoryAxis['thresholds'];
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    return;
  }
  errors.push(getPropertyMessage('categoryAxis', 'thresholds', ordinalThresholdsMessage));
  errorDetails.push({ path: ['categoryAxis', 'thresholds'], message: ordinalThresholdsMessage });
}
