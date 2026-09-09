import seedrandom from 'seedrandom';

import { NONE, AUTO, TYPE_DATE, TYPE_NUMBER, TYPE_STRING, SCALE_ORDINAL } from '@mochart/core';
import type { MochartConfig } from '@mochart/core';

import type { RandomConfig, CategoryValue, DemoDataProvider } from './types';

const globalId = 'global';

/** A pseudo-random number source (seedrandom's PRNG is callable). */
type Rng = () => number;
/** Produces category-axis values (dates are emitted as millisecond numbers). */
type ValueGenerator = () => CategoryValue;

// seedrandom's types only accept a string seed; the original demo passed
// numbers too, relying on seedrandom's internal string coercion. Centralize
// that coercion so behavior is preserved.
function rng(seed: string | number): Rng {
  return seedrandom(String(seed));
}

type RandomCategoryConfig = RandomConfig['category'];

interface CategoryData {
  stepPrevValues: CategoryValue[];
  globalValues: CategoryValue[];
  ownValues: CategoryValue[];
  stepNextValues: CategoryValue[];
  categoryValues: CategoryValue[];
}

function categorySortFunction(a: CategoryValue, b: CategoryValue): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function toMillis(value: string | number | Date): number {
  return new Date(value).getTime();
}

function createValue(generator: Rng, range: number): number {
  return Math.round(generator() * range);
}

const intervalUnitToDateUnit: Record<string, number> = {
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 86400000
};

const categoryTypeToGenerator: Record<string, (categoryConfig: RandomCategoryConfig, randomGenerator: Rng) => ValueGenerator> = {
  [TYPE_DATE]: categoryDateGenerator,
  [TYPE_NUMBER]: categoryNumberGenerator,
  [TYPE_STRING]: categoryStringGenerator
};

const CAPITAL_STRING_START = 65;
const LOWERCASE_STRING_START = 97;

function getFirstCharacter(_prevDigit: number | null, digit: number): string {
  return String.fromCharCode(CAPITAL_STRING_START + digit);
}

function getOtherCharacter(prevDigit: number | null, digit: number): string {
  return digit === 9 && prevDigit !== 9 ? ' ' : String.fromCharCode(LOWERCASE_STRING_START + digit);
}

function numberToString(number: number): string {
  const numberString = '' + number;
  const result: string[] = [];
  let getCharacter = getFirstCharacter;
  let prevChar: number | null = null;
  for (const char of numberString) {
    result.push(getCharacter(prevChar, +char));
    getCharacter = getOtherCharacter;
    prevChar = +char;
  }
  return result.join('');
}

function categoryDateGenerator({ date }: RandomCategoryConfig, randomGenerator: Rng): ValueGenerator {
  let { interval } = date;
  const { intervalUnit } = date;
  const min = toMillis(date.min);
  const max = toMillis(date.max);
  let range = max - min;
  let dateUnit = 1;
  if (intervalUnitToDateUnit[intervalUnit] !== undefined) {
    dateUnit = intervalUnitToDateUnit[intervalUnit];
  }
  interval *= dateUnit;
  range = Math.floor(range / interval);
  return () => min + createValue(randomGenerator, range) * interval;
}

function categoryNumberGenerator({ number }: RandomCategoryConfig, randomGenerator: Rng): ValueGenerator {
  const { min, max, interval } = number;
  let range = max - min;
  range = Math.floor(range / interval);
  return () => min + createValue(randomGenerator, range) * interval;
}

function categoryStringGenerator({ string }: RandomCategoryConfig, randomGenerator: Rng): ValueGenerator {
  const min = Math.pow(10, string.minLength - 1);
  const max = Math.pow(10, string.maxLength - 1);
  const range = max - min;
  return () => numberToString(min + createValue(randomGenerator, range));
}

function categoryGenerator(type: string, categoryConfig: RandomCategoryConfig, randomGenerator: Rng): ValueGenerator {
  return categoryTypeToGenerator[type](categoryConfig, randomGenerator);
}

function generateCategoryValues(
  generator: ValueGenerator,
  missingGenerator: Rng,
  categoryCount: number,
  missingProbability: number,
  categoryValueMap: Record<string, CategoryValue> = {}
): CategoryValue[] {
  const categoryValues: CategoryValue[] = [];
  let i, v: CategoryValue;
  for (i = 0; i < categoryCount; i++) {
    if (missingProbability === 0 || missingGenerator() >= missingProbability) {
      v = generator();
      while (categoryValueMap['' + v] !== undefined) {
        v = generator();
      }
      categoryValueMap['' + v] = v;
      categoryValues.push(v);
    }
  }
  return categoryValues;
}

function generateChartCategoryValues(
  { categoryAxis: categoryAxisConfig }: MochartConfig,
  { category: categoryConfig }: RandomConfig,
  randomId: number
): CategoryData {
  const { type } = categoryAxisConfig;
  const { count, missing, reuse } = categoryConfig;
  const { probability } = missing;
  const { globalFraction, stepFraction } = reuse;

  const globalCount = Math.floor(globalFraction * count);
  const stepCount = globalFraction < 1 && stepFraction > 0 ? 2 * Math.floor((count - globalCount) * stepFraction / 2.0) : 0;
  const halfStepCount = Math.floor(stepCount / 2);
  const ownCount = count - globalCount - stepCount;

  const globalGenerator = categoryGenerator(type, categoryConfig, rng(globalId));
  const globalMissingGenerator = rng(globalId);
  const stepPrevGenerator = categoryGenerator(type, categoryConfig, rng((randomId - 1) + 0.5));
  const stepPrevMissingGenerator = rng((randomId - 1) + 0.5);
  const stepNextGenerator = categoryGenerator(type, categoryConfig, rng(randomId + 0.5));
  const stepNextMissingGenerator = rng(randomId + 0.5);
  const ownGenerator = categoryGenerator(type, categoryConfig, rng(randomId));
  const missingGenerator = rng(randomId);

  const categoryValueMap: Record<string, CategoryValue> = {};
  const globalValues = generateCategoryValues(globalGenerator, globalMissingGenerator, globalCount, probability, categoryValueMap);

  const globalCategoryValueMap = { ...categoryValueMap };
  let stepPrevValues: CategoryValue[];
  let stepNextValues: CategoryValue[];
  if (randomId % 2 === 0) {
    const stepPrevCategoryValueMap = { ...globalCategoryValueMap };
    stepPrevValues = generateCategoryValues(stepPrevGenerator, stepPrevMissingGenerator, halfStepCount, probability, stepPrevCategoryValueMap);
    const stepNextNextCategoryValueMap = { ...globalCategoryValueMap };
    const stepNextNextGenerator = categoryGenerator(type, categoryConfig, rng((randomId + 1) + 0.5));
    const stepNextNextMissingGenerator = rng((randomId + 1) + 0.5);
    generateCategoryValues(stepNextNextGenerator, stepNextNextMissingGenerator, halfStepCount, probability, stepNextNextCategoryValueMap);
    const stepNextCategoryValueMap = { ...stepPrevCategoryValueMap, ...stepNextNextCategoryValueMap };
    stepNextValues = generateCategoryValues(stepNextGenerator, stepNextMissingGenerator, halfStepCount, probability, stepNextCategoryValueMap);
  }
  else {
    const stepNextCategoryValueMap = { ...globalCategoryValueMap };
    stepNextValues = generateCategoryValues(stepNextGenerator, stepNextMissingGenerator, halfStepCount, probability, stepNextCategoryValueMap);
    const stepPrevPrevCategoryValueMap = { ...globalCategoryValueMap };
    const stepPrevPrevGenerator = categoryGenerator(type, categoryConfig, rng((randomId - 2) + 0.5));
    const stepPrevPrevMissingGenerator = rng((randomId - 2) + 0.5);
    generateCategoryValues(stepPrevPrevGenerator, stepPrevPrevMissingGenerator, halfStepCount, probability, stepPrevPrevCategoryValueMap);
    const stepPrevCategoryValueMap = { ...stepNextCategoryValueMap, ...stepPrevPrevCategoryValueMap };
    stepPrevValues = generateCategoryValues(stepPrevGenerator, stepPrevMissingGenerator, halfStepCount, probability, stepPrevCategoryValueMap);
  }
  for (const value of stepPrevValues) {
    categoryValueMap['' + value] = value;
  }
  for (const value of stepNextValues) {
    categoryValueMap['' + value] = value;
  }

  const ownValues = generateCategoryValues(ownGenerator, missingGenerator, ownCount, probability, categoryValueMap);
  const categoryValues = ([] as CategoryValue[]).concat(stepPrevValues, globalValues, ownValues, stepNextValues);

  return {
    stepPrevValues,
    globalValues,
    ownValues,
    stepNextValues,
    categoryValues
  };
}

function generateSeriesValuesForCategoryValues(
  categoryValues: CategoryValue[],
  min: number,
  range: number,
  probability: number,
  round: boolean,
  randomGenerator: Rng,
  missingGenerator: Rng
): (number | undefined)[] {
  return categoryValues.map(() => {
    if (probability > 0 && missingGenerator() < probability) {
      return undefined;
    }
    else if (round) {
      return Math.round(min + randomGenerator() * range);
    }
    else {
      return min + randomGenerator() * range;
    }
  });
}

function generateSeriesValues(
  _id: string,
  categoryData: CategoryData,
  reuse: RandomConfig['series']['reuse'],
  min: number,
  range: number,
  probability: number,
  round: boolean,
  randomGenerator: Rng,
  missingGenerator: Rng,
  globalGenerator: Rng,
  globalMissingGenerator: Rng,
  stepPrevGenerator: Rng,
  stepPrevMissingGenerator: Rng,
  stepNextGenerator: Rng,
  stepNextMissingGenerator: Rng
): (number | undefined)[] {
  const { stepPrevValues, globalValues, ownValues, stepNextValues, categoryValues } = categoryData;
  const { global, step } = reuse;
  if (global || step) {
    const prevSeriesValues = generateSeriesValuesForCategoryValues(stepPrevValues, min, range, probability, round, step ? stepPrevGenerator : randomGenerator, step ? stepPrevMissingGenerator : missingGenerator);
    const globalSeriesValues = generateSeriesValuesForCategoryValues(globalValues, min, range, probability, round, global ? globalGenerator : randomGenerator, global ? globalMissingGenerator : missingGenerator);
    const ownSeriesValues = generateSeriesValuesForCategoryValues(ownValues, min, range, probability, round, randomGenerator, missingGenerator);
    const nextSeriesValues = generateSeriesValuesForCategoryValues(stepNextValues, min, range, probability, round, step ? stepNextGenerator : randomGenerator, step ? stepNextMissingGenerator : missingGenerator);

    return ([] as (number | undefined)[]).concat(
      prevSeriesValues,
      globalSeriesValues,
      ownSeriesValues,
      nextSeriesValues
    );
  }
  else {
    return generateSeriesValuesForCategoryValues(categoryValues, min, range, probability, round, randomGenerator, missingGenerator);
  }
}

const allPropertyKeys = ['property', 'rangeProperty', 'markerProperty', 'colorProperty', 'labelProperty', 'tooltipProperty', 'errorLowProperty', 'errorHighProperty'];
const axisPropertyMap: Record<string, boolean> = {
  property: true,
  rangeProperty: true,
  errorLowProperty: true,
  errorHighProperty: true
};

function generateChartSeriesValues(
  { series: seriesConfigs, valueAxes }: MochartConfig,
  { series }: RandomConfig,
  randomId: number,
  categoryData: CategoryData
): Record<string, (number | undefined)[]> {
  const { number, missing, reuse } = series;
  const { min, max, limitToAxisConfig, round } = number;
  const { probability } = missing;
  const seriesValues: Record<string, (number | undefined)[]> = {};
  const randomGenerator = rng(randomId);
  const missingGenerator = rng(randomId);
  const globalGenerator = rng(globalId);
  const globalMissingGenerator = rng(globalId);
  const stepPrevGenerator = rng((randomId - 1) + 0.5);
  const stepPrevMissingGenerator = rng((randomId - 1) + 0.5);
  const stepNextGenerator = rng(randomId + 0.5);
  const stepNextMissingGenerator = rng(randomId + 0.5);
  seriesConfigs.forEach(seriesConfig => {
    const { id } = seriesConfig;
    const axisConfig = valueAxes.find((candidate) => candidate.id === seriesConfig.axis)!;
    const seriesConfigRecord = seriesConfig as unknown as Record<string, unknown>;
    let keyMin, keyMax, keyRange;
    for (const key of allPropertyKeys) {
      const propertyValue = seriesConfigRecord[key];
      if (propertyValue !== NONE) {
        keyMin = axisPropertyMap[key] && axisConfig.min !== AUTO && limitToAxisConfig ? (axisConfig.min as number) : min;
        keyMax = axisPropertyMap[key] && axisConfig.max !== AUTO && limitToAxisConfig ? (axisConfig.max as number) : max;
        keyRange = keyMax - keyMin;
        seriesValues[propertyValue as string] = generateSeriesValues(id, categoryData, reuse, keyMin, keyRange, probability,
          round, randomGenerator, missingGenerator, globalGenerator, globalMissingGenerator,
          stepPrevGenerator, stepPrevMissingGenerator, stepNextGenerator, stepNextMissingGenerator);
      }
    }
  });
  return seriesValues;
}

export function generateChartDataProvider(
  mochartConfig: MochartConfig,
  random: RandomConfig,
  randomId: number
): DemoDataProvider {
  const { categoryAxis: categoryAxisConfig } = mochartConfig;
  const { keyProperty, scale } = categoryAxisConfig;
  const { category: categoryConfig } = random;

  const categoryData = generateChartCategoryValues(mochartConfig, random, randomId);
  let { categoryValues } = categoryData;
  const seriesValues = generateChartSeriesValues(mochartConfig, random, randomId, categoryData);

  const { order } = categoryConfig;
  const { sort } = order;

  if (scale !== SCALE_ORDINAL || sort) {
    const sortedCategoryValues = categoryValues.slice().sort(categorySortFunction);
    const oldValueToIndex = categoryValues.reduce<Record<string, number>>((m, g, i) => { m['' + g] = i; return m; }, {});
    const sortedIndexToIndex = sortedCategoryValues.map(g => oldValueToIndex['' + g]);
    categoryValues = sortedCategoryValues;
    const oldToNew = (values: (number | undefined)[]) => values.map((_v, i) => values[sortedIndexToIndex[i]]);

    const seriesKeys = Object.keys(seriesValues);
    for (const seriesKey of seriesKeys) {
      seriesValues[seriesKey] = oldToNew(seriesValues[seriesKey]);
    }
  }

  if (keyProperty) {
    seriesValues[keyProperty] = categoryValues as (number | undefined)[];
  }

  const categoryProperty = categoryAxisConfig.property;
  return {
    categoryValues,
    seriesValues,
    getPropertyValues: property => property === categoryProperty ? categoryValues : seriesValues[property]
  };
}
