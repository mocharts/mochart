import { scaleLinear } from 'd3-scale';

import { getDomainExtent, numericValue } from './DomainData';
import { AUTO, NONE, TYPE_DATE } from '../config/core/constants';
import type { AxisConfigBase } from '../types/config';
import type { DataType } from '../config/core/constants';
import type { DomainValue, CategoryAxisDomain } from '../types/data';

type AxisDomainConfig = AxisConfigBase & {
  type: DataType;
  base?: number | null;
  minMarginFraction?: number;
  maxMarginFraction?: number;
};
type AxisDomainCalculator = () => CategoryAxisDomain;

export function getAxisDomain(axisConfig: AxisDomainConfig, axisDomainCalculator: AxisDomainCalculator): CategoryAxisDomain {
  const axisDomain = getAxisDomainWithMinAndMax(axisConfig, axisDomainCalculator);
  adjustAxisDomainForOffsets(axisConfig, axisDomain);
  return axisDomain;
}

/** True when both bounds are set and equal: a zero-extent domain (one category, or all values alike). */
export function isCollapsedDomain(axisDomain: CategoryAxisDomain): boolean {
  const [min, max] = axisDomain;
  return min !== null && max !== null && numericValue(min) === numericValue(max);
}

/** True when both bounds are explicit and equal: the user asked for this zero-extent domain. */
export function isExplicitCollapsedDomain(axisConfig: AxisDomainConfig, axisDomain: CategoryAxisDomain): boolean {
  return axisConfig.min !== AUTO && axisConfig.max !== AUTO && isCollapsedDomain(axisDomain);
}

/** The domain scales/ticks are built from: the semantic domain itself (same reference) unless collapsed,
 * then a widened copy so values render off the midline; clip detection keeps the domain itself. */
export function getRenderAxisDomain(axisConfig: AxisDomainConfig, axisDomain: CategoryAxisDomain): CategoryAxisDomain {
  const [min, max] = axisDomain;
  if (min === null || max === null || numericValue(min) !== numericValue(max)) {
    return axisDomain;
  }
  const value = numericValue(min);
  if (axisConfig.type === TYPE_DATE) {
    const half = getDateHalfWidth(axisConfig);
    return [new Date(value - half), new Date(value + half)];
  }
  if (value === 0) { // widen upward so a zero baseline stays on the axis
    return [0, 1];
  }
  const half = Math.abs(value) * 0.05; // relative: a fixed span makes large-magnitude tick labels identical
  return scaleLinear().domain([value - half, value + half]).nice().domain() as CategoryAxisDomain;
}

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30 * MS_DAY;
const MS_YEAR = 365 * MS_DAY;

/** Milliseconds implied by each d3 time-format directive, keyed by directive letter. */
const dateDirectiveUnits: Record<string, number> = {
  L: 1, f: 1, Q: 1, s: MS_SECOND, S: MS_SECOND, X: MS_SECOND, c: MS_SECOND,
  M: MS_MINUTE, H: MS_HOUR, I: MS_HOUR, p: MS_HOUR,
  a: MS_DAY, A: MS_DAY, d: MS_DAY, e: MS_DAY, j: MS_DAY, u: MS_DAY, w: MS_DAY, x: MS_DAY,
  U: MS_WEEK, V: MS_WEEK, W: MS_WEEK,
  b: MS_MONTH, B: MS_MONTH, m: MS_MONTH,
  y: MS_YEAR, Y: MS_YEAR, G: MS_YEAR, g: MS_YEAR
};

// half-width for a collapsed date domain: the tick config's finest unit, else one day
function getDateHalfWidth(axisConfig: AxisDomainConfig): number {
  if (axisConfig.minTickInterval > 0) {
    return axisConfig.minTickInterval;
  }
  const { format: tickLabelFormat } = axisConfig.tickLabel;
  if (tickLabelFormat !== AUTO && tickLabelFormat !== NONE) {
    let unit = Infinity;
    const directivePattern = /%[-_0]?(.)/g;
    let match;
    while ((match = directivePattern.exec(tickLabelFormat)) !== null) {
      unit = Math.min(unit, dateDirectiveUnits[match[1]] ?? Infinity);
    }
    if (Number.isFinite(unit)) {
      return unit;
    }
  }
  return MS_DAY;
}

function getAxisDomainWithMinAndMax(axisConfig: AxisDomainConfig, axisDomainCalculator: AxisDomainCalculator): CategoryAxisDomain {
  const { min, max, base = null } = axisConfig;
  let axisDomain: CategoryAxisDomain = [null, null];
  const valueCreator = getAxisValueCreator(axisConfig);
  if (min !== AUTO && max !== AUTO) {
    axisDomain[0] = valueCreator(min);
    axisDomain[1] = valueCreator(max);
  }
  else {
    axisDomain = axisDomainCalculator();
    if (min === AUTO) {
      const { softMin } = axisConfig;
      if (softMin !== NONE && (axisDomain[0] === null || numericValue(axisDomain[0]) > numericValue(valueCreator(softMin)))) {
        axisDomain[0] = valueCreator(softMin);
      }
    }
    else {
      axisDomain[0] = valueCreator(min);
    }
    if (max === AUTO) {
      const { softMax } = axisConfig;
      if (softMax !== NONE && (axisDomain[1] === null || numericValue(axisDomain[1]) < numericValue(valueCreator(softMax)))) {
        axisDomain[1] = valueCreator(softMax);
      }
    }
    else {
      axisDomain[1] = valueCreator(max);
    }
    // Empty data with a soft/fixed bound on one end only: collapse to keep the null-pair invariant.
    if (axisDomain[0] === null && axisDomain[1] !== null) {
      axisDomain[0] = axisDomain[1];
    }
    else if (axisDomain[1] === null && axisDomain[0] !== null) {
      axisDomain[1] = axisDomain[0];
    }
    // an explicit bound past all the data clips the auto bound to it rather than inverting the domain
    if (min !== AUTO && axisDomain[1] !== null && numericValue(axisDomain[1]) < numericValue(axisDomain[0]!)) {
      axisDomain[1] = axisDomain[0];
    }
    else if (max !== AUTO && axisDomain[0] !== null && numericValue(axisDomain[0]) > numericValue(axisDomain[1]!)) {
      axisDomain[0] = axisDomain[1];
    }
    const axisExtent = getDomainExtent(axisDomain);
    if (axisExtent > 0) {
      const { minMarginFraction = 0, maxMarginFraction = 0 } = axisConfig;
      if (min === AUTO && axisDomain[0] !== null && (base === NONE || axisDomain[0] !== base) && minMarginFraction > 0) {
        axisDomain[0] = adjustAxisValue(axisConfig, axisDomain[0], -minMarginFraction * axisExtent);
      }
      if (max === AUTO && axisDomain[1] !== null && (base === NONE || axisDomain[1] !== base) && maxMarginFraction > 0) {
        axisDomain[1] = adjustAxisValue(axisConfig, axisDomain[1], maxMarginFraction * axisExtent);
      }
    }
  }
  return axisDomain;
}

function adjustAxisDomainForOffsets(axisConfig: AxisDomainConfig, axisDomain: CategoryAxisDomain): void {
  const { min, minOffset, max, maxOffset } = axisConfig;
  if (min === AUTO && minOffset !== 0 && axisDomain[0] !== null) {
    axisDomain[0] = adjustAxisValue(axisConfig, axisDomain[0], minOffset);
  }
  if (max === AUTO && maxOffset !== 0 && axisDomain[1] !== null) {
    axisDomain[1] = adjustAxisValue(axisConfig, axisDomain[1], maxOffset);
  }
}

// a linear date category axis takes its bounds as a timestamp or an ISO date string; only a date axis ever sees the string form
type AxisBoundValue = number | string;

function getAxisValueCreator(axisConfig: AxisDomainConfig): (value: AxisBoundValue) => DomainValue {
  return axisConfig.type === TYPE_DATE ? (value: AxisBoundValue) => new Date(value) : (value: AxisBoundValue) => value as number;
}

function adjustAxisValue(axisConfig: AxisDomainConfig, value: DomainValue, adjustment: number): DomainValue {
  return axisConfig.type === TYPE_DATE
    ? new Date(numericValue(value) + adjustment)
    : numericValue(value) + adjustment;
}
