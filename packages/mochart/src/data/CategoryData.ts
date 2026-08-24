import { getCategoryDomainForValues } from './DomainData';
import { getAxisDomain, getRenderAxisDomain } from './AxisDomainData';
import { readAlignedValues, readCategoryValues } from './PropertyData';
import { NONE, TYPE_DATE, SCALE_ORDINAL } from '../config/core/constants';
import type { CategoryAxisConfig } from '../types/config';
import type {
  DataProvider,
  CategoryAxisDomain,
  CategoryData,
  CategoryValue,
  CategoryValueObject,
  CategoryValues
} from '../types/data';

export function getCategoryKeyProperty(categoryAxisConfig: CategoryAxisConfig): string {
  return categoryAxisConfig.keyProperty !== NONE ? categoryAxisConfig.keyProperty : categoryAxisConfig.property!;
}

export function getCategoryData(categoryAxisConfig: CategoryAxisConfig, dataProvider: DataProvider): CategoryData {
  // config/provider mismatches and duplicate/missing categories are getDataErrors' job; this hot path trusts its input
  const displayCategoryValues = readCategoryValues(dataProvider, categoryAxisConfig.property!);
  let keyCategoryValues: readonly CategoryValue[] = displayCategoryValues;
  if (categoryAxisConfig.keyProperty !== NONE) {
    // the keys identify categories across data changes; the property values stay the typed, positioned, shown values
    // a category with no key value keys as its property value, as it would with no keyProperty at all
    const keyValues = readAlignedValues(dataProvider, categoryAxisConfig.keyProperty, displayCategoryValues.length);
    keyCategoryValues = displayCategoryValues.map((propertyValue, i) => (keyValues[i] ?? propertyValue) as CategoryValue);
  }
  return getCategoryDataFromValues(categoryAxisConfig, keyCategoryValues, displayCategoryValues);
}

export function getCategoryDataFromValues(
  categoryAxisConfig: CategoryAxisConfig,
  keyCategoryValues: readonly CategoryValue[],
  displayCategoryValues: readonly CategoryValue[],
  numericCategoryValueOffsets: readonly number[] | null = null
): CategoryData {
  const categoryValues = getCategoryValues(categoryAxisConfig, keyCategoryValues, displayCategoryValues, numericCategoryValueOffsets);
  const axisDomain = getCategoryAxisDomain(categoryAxisConfig, categoryValues.parsed);
  // an ordinal domain is index-based and already handled when collapsed, so it is never widened
  const renderAxisDomain = categoryAxisConfig.scale === SCALE_ORDINAL ? axisDomain : getRenderAxisDomain(categoryAxisConfig, axisDomain);

  return {
    axisDomain,
    renderAxisDomain,
    values: categoryValues
  };
}

export function getCategoryDataWithRenderAxisDomain(categoryData: CategoryData, renderAxisDomain: CategoryAxisDomain): CategoryData {
  return Object.assign({}, categoryData, { renderAxisDomain });
}

export function getCategoryDataWithNumericValues(categoryData: CategoryData, numericValues: number[]): CategoryData {
  const values = Object.assign({}, categoryData.values, { numeric: numericValues });
  return Object.assign({}, categoryData, { values });
}

function getCategoryValues(
  categoryAxisConfig: CategoryAxisConfig,
  keyCategoryValues: readonly CategoryValue[],
  displayCategoryValues: readonly CategoryValue[],
  numericCategoryValueOffsets: readonly number[] | null = null
): CategoryValues {
  const parsedCategoryValues = getParsedCategoryValues(categoryAxisConfig, displayCategoryValues);
  const numericCategoryValues = getNumericCategoryValues(categoryAxisConfig, parsedCategoryValues, numericCategoryValueOffsets);
  return {
    key: keyCategoryValues,
    display: displayCategoryValues,
    parsed: parsedCategoryValues,
    numeric: numericCategoryValues
  };
}

function getParsedCategoryValues(categoryAxisConfig: CategoryAxisConfig, categoryValues: readonly CategoryValue[]): readonly CategoryValue[] {
  let parsedCategoryValues: readonly CategoryValue[] = categoryValues;
  if (categoryAxisConfig.type === TYPE_DATE) {
    parsedCategoryValues = [];
    for (const categoryValue of categoryValues) {
      (parsedCategoryValues as Date[]).push(categoryValue instanceof Date ? new Date(categoryValue.getTime()) : new Date(categoryValue));
    }
  }
  return parsedCategoryValues;
}

export function getNumericCategoryValues(
  categoryAxisConfig: CategoryAxisConfig,
  parsedCategoryValues: readonly CategoryValue[],
  numericCategoryValueOffsets: readonly number[] | null = null
): number[] {
  let numericCategoryValues: number[];
  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    numericCategoryValues = [];
    const categoryCount = parsedCategoryValues.length;
    if (numericCategoryValueOffsets !== null) {
      for (let ordinalIndex = 0; ordinalIndex < categoryCount; ordinalIndex++) {
        numericCategoryValues.push(ordinalIndex - numericCategoryValueOffsets[ordinalIndex]);
      }
    }
    else {
      for (let ordinalIndex = 0; ordinalIndex < categoryCount; ordinalIndex++) {
        numericCategoryValues.push(ordinalIndex);
      }
    }
  }
  else if (categoryAxisConfig.type === TYPE_DATE) {
    numericCategoryValues = [];
    for (const categoryValue of parsedCategoryValues) {
      numericCategoryValues.push((categoryValue as Date).getTime());
    }
  }
  else {
    numericCategoryValues = parsedCategoryValues.map(categoryValue => typeof categoryValue === 'number' ? categoryValue : Number(categoryValue));
  }
  return numericCategoryValues;
}

function getCategoryAxisDomain(categoryAxisConfig: CategoryAxisConfig, parsedCategoryValues: readonly CategoryValue[]): CategoryAxisDomain {
  if (categoryAxisConfig.scale === SCALE_ORDINAL) {
    return getOrdinalCategoryAxisDomain(parsedCategoryValues.length);
  }
  else {
    return getLinearCategoryAxisDomain(categoryAxisConfig, parsedCategoryValues)
  }
}

function getOrdinalCategoryAxisDomain(categoryCount: number): CategoryAxisDomain {
  return [0, categoryCount > 0 ? categoryCount-1 : 0];
}

function getLinearCategoryAxisDomain(categoryAxisConfig: CategoryAxisConfig, parsedCategoryValues: readonly CategoryValue[]): CategoryAxisDomain {
  const domainValues = parsedCategoryValues as readonly (number | Date)[];
  return getAxisDomain(categoryAxisConfig, () => getCategoryDomainForValues(domainValues));
}

export function getCategoryValueObject(categoryData: CategoryData, categoryIndex: number): CategoryValueObject {
  const { axisDomain, values } = categoryData;
  return {
    axisDomain,
    values: {
      key: values.key[categoryIndex],
      display: values.display[categoryIndex],
      parsed: values.parsed[categoryIndex],
      numeric: values.numeric[categoryIndex]
    }
  };
}
