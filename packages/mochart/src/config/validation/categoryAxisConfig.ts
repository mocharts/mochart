import validators from './validators';

import { AUTO, NONE, SCALE_ORDINAL, SCALE_LINEAR, TYPE_STRING, TYPE_NUMBER, TYPE_DATE, STEP_PERIODS } from '../core/constants';

import getAxisValidators, { getTickLabelValidators, getThresholdStepValidators, thresholdStepIntervalValidator } from './axisConfig';
import getTruncationValidators from './truncationConfig';
import type { CategoryAxisConfig } from '../../types/config';

type CategoryAxisCondition = Pick<CategoryAxisConfig, 'type' | 'scale'> & { keyProperty?: string | null };

const typeStringSuffix = 'when type is ' + TYPE_STRING;
const typeDateSuffix = 'when type is ' + TYPE_DATE;
const typeNumberSuffix = 'when type is ' + TYPE_NUMBER;
const scaleOrdinalSuffix = 'when scale is ' + SCALE_ORDINAL;
const scaleLinearSuffix = 'when scale is ' + SCALE_LINEAR;
const linearDateSuffix = 'when scale is ' + SCALE_LINEAR + ' and type is ' + TYPE_DATE;
const linearNumberSuffix = 'when scale is ' + SCALE_LINEAR + ' and type is ' + TYPE_NUMBER;
const ordinalDateSuffix = 'when scale is ' + SCALE_ORDINAL + ' and type is ' + TYPE_DATE;
const ordinalNumberSuffix = 'when scale is ' + SCALE_ORDINAL + ' and type is ' + TYPE_NUMBER;

const typeStringRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_STRING, suffix: typeStringSuffix };
const typeDateRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_DATE, suffix: typeDateSuffix };
const typeNumberRule = { condition: ({ type }: CategoryAxisCondition) => type === TYPE_NUMBER, suffix: typeNumberSuffix };
const scaleOrdinalRule = { condition: ({ scale }: CategoryAxisCondition) => scale === SCALE_ORDINAL, suffix: scaleOrdinalSuffix };
// a keyed ordinal axis names its categories by key, so ticks and thresholds take the key's forms there
const keyedOrdinalRule = { condition: ({ scale, keyProperty }: CategoryAxisCondition) => scale === SCALE_ORDINAL && keyProperty !== undefined && keyProperty !== null, suffix: scaleOrdinalSuffix + ' and keyProperty is set' };
const scaleLinearRule = { condition: ({ scale }: CategoryAxisCondition) => scale === SCALE_LINEAR, suffix: scaleLinearSuffix };
const linearDateRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_LINEAR && type === TYPE_DATE, suffix: linearDateSuffix };
const linearNumberRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_LINEAR && type === TYPE_NUMBER, suffix: linearNumberSuffix };
const ordinalDateRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_ORDINAL && type === TYPE_DATE, suffix: ordinalDateSuffix };
const ordinalNumberRule = { condition: ({ scale, type }: CategoryAxisCondition) => scale === SCALE_ORDINAL && type === TYPE_NUMBER, suffix: ordinalNumberSuffix };
const defaultRule = { condition: () => true };

export default function getValidators(config: Partial<CategoryAxisConfig>, pieMode = false) {
  return {
    ...getAxisValidators(validators.conditional([
      { ...keyedOrdinalRule, validator: validators.string().or(validators.number()) },
      { ...typeDateRule, validator: validators.datePrimitive() },
      { ...typeStringRule, validator: validators.string() },
      { ...defaultRule, validator: validators.number() }
    ], config), {
      ...getTickLabelValidators(),
      format: validators.conditional([
        { ...typeStringRule, validator: validators.oneOf([NONE, AUTO]) },
        { ...typeDateRule, validator: validators.dateFormat().orOneOf([NONE, AUTO]) },
        { ...typeNumberRule, validator: validators.numberFormat().orOneOf([NONE, AUTO]) },
        { ...defaultRule, validator: validators.any() }
      ], config),
      truncation: validators.partialObjectWithShape({
        ...getTruncationValidators(validators.conditional([
          { ...scaleLinearRule, validator: validators.equal(false) },
          { ...defaultRule, validator: validators.boolean() }
        ], config)),
        maxFraction: validators.numberMinMax(0, 1),
        minLength: validators.numberMin(0)
      }, true)
    }, pieMode, {
      ...getThresholdStepValidators(),
      period: validators.conditional([
        { ...typeDateRule, validator: validators.oneOf(STEP_PERIODS).orEqual(NONE) },
        { ...defaultRule, validator: validators.equal(NONE) }
      ], config),
      interval: validators.conditional([
        { ...linearNumberRule, validator: thresholdStepIntervalValidator },
        { ...defaultRule, validator: validators.equal(NONE) }
      ], config)
    }),

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

    ticks: validators.arrayOf(validators.objectWithShape({
      value: validators.conditional([
        { ...keyedOrdinalRule, validator: validators.string().or(validators.number()) },
        { ...typeStringRule, validator: validators.string() },
        { ...typeDateRule, validator: validators.datePrimitive() },
        { ...typeNumberRule, validator: validators.number() },
        { ...defaultRule, validator: validators.any() }
      ], config),
      label: validators.string().orEqual(undefined)
    }), true).orEqual(NONE),

    tickStep: validators.partialObjectWithShape({
      count: validators.conditional([
        { ...scaleOrdinalRule, validator: validators.integerMin(1).orEqual(AUTO) },
        { ...scaleLinearRule, validator: validators.equal(AUTO) },
        { ...defaultRule, validator: validators.any() }
      ], config),
      offset: validators.conditional([
        { ...scaleOrdinalRule, validator: validators.integerMin(0) },
        { ...scaleLinearRule, validator: validators.equal(0) },
        { ...defaultRule, validator: validators.any() }
      ], config),
      period: validators.conditional([
        { ...typeDateRule, validator: validators.oneOf(STEP_PERIODS).orEqual(NONE) },
        { ...defaultRule, validator: validators.equal(NONE) }
      ], config),
      includeFirst: validators.conditional([
        { ...scaleOrdinalRule, validator: validators.boolean() },
        { ...scaleLinearRule, validator: validators.equal(false) },
        { ...defaultRule, validator: validators.any() }
      ], config),
      minorFormat: validators.conditional([
        { ...ordinalDateRule, validator: validators.dateFormat().orEqual(NONE) },
        { ...ordinalNumberRule, validator: validators.numberFormat().orEqual(NONE) },
        { ...defaultRule, validator: validators.equal(NONE) }
      ], config)
    }, true),

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
