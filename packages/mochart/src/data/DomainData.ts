import { mapMap } from '../utils/utils';
import type { DomainValue, NullableDomain } from '../types/data';

export const nullDomain: NullableDomain = [null, null];

/** A domain value as something comparable. Shared with AxisDomainData; does not parse date strings. */
export function numericValue(value: DomainValue): number {
  return value instanceof Date ? value.getTime() : value;
}

export function getCategoryDomainForValues<T extends DomainValue>(values: readonly T[]): NullableDomain<T> { // category values are never undefined
  let min: T | null = null;
  let max: T | null = null;
  let value: T;
  const valueCount = values.length;
  for (let i=0; i<valueCount; i++) {
    value = values[i];
    if (!Number.isFinite(numericValue(value))) { // NaN (e.g. an Invalid Date), Infinity or null would seed min/max and stick
      continue;
    }
    if (min === null || numericValue(value) < numericValue(min)) {
      min = value;
    }
    if (max === null || numericValue(value) > numericValue(max)) {
      max = value;
    }
  };
  return [min, max];
}

export function getDomainForValues(values: readonly number[] | null): NullableDomain {
  let min: number | null = null;
  let max: number | null = null;
  if (values !== null) {
    let value;
    const valueCount = values.length;
    for (let i=0; i<valueCount; i++) {
      value = values[i];
      // a missing value is NaN; null would compare as 0 and re-arm the `min === null` sentinel, discarding the minimum
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (min === null || value < min) {
          min = value;
        }
        if (max === null || value > max) {
          max = value;
        }
      }
    }
  }
  return [min, max];
}

export function mergeDomain(domainA: NullableDomain, domainB: NullableDomain): NullableDomain {
  if (domainA[0] === null) { // if min is null, max is always null too
    return domainB;
  }
  if (domainB[0] === null) { // if min is null, max is always null too
    return domainA;
  }
  return [Math.min(domainA[0], domainB[0]), Math.max(domainA[1]!, domainB[1]!)];
}

export function getDomainExtent(domain: NullableDomain<DomainValue>): number {
  const [min, max] = domain;
  if (min === null || max === null || numericValue(min) === numericValue(max)) {
    return 0;
  }
  else {
    return numericValue(max) - numericValue(min);
  }
}

export function getDomainExtents<T extends DomainValue>(domains: Record<string, NullableDomain<T>>): Record<string, number> {
  return mapMap(domains, x => getDomainExtent(x));
}

// Collapsed or inverted domains fall back to a positive magnitude (1 when null or 0) so delta weights stay positive.
export function getSafeDomainExtent(domain: NullableDomain): number {
  if (domain[0] !== domain[1]) {
    return Math.abs(getDomainExtent(domain));
  }
  return domain[0] === null || domain[0] === 0 ? 1 : Math.abs(domain[0]);
}

export function getSafeDomainExtents(domains: Record<string, NullableDomain>): Record<string, number> {
  return mapMap(domains, x => getSafeDomainExtent(x));
}

export function getMaxDomain<T extends DomainValue>(domain: NullableDomain<T>, otherDomain: NullableDomain<T>): NullableDomain<T> {
  if (domain[0] === null) { // if min is null, max is always null too
    return otherDomain;
  }
  else if (otherDomain[0] === null) { // if min is null, max is always null too
    return domain;
  }
  return [
    numericValue(domain[0]) < numericValue(otherDomain[0]) ? domain[0] : otherDomain[0],
    numericValue(domain[1]!) > numericValue(otherDomain[1]!) ? domain[1] : otherDomain[1]
  ]
}

export function copyDomain<T extends DomainValue>(domain: NullableDomain<T>): NullableDomain<T> {
  return [domain[0], domain[1]];
}
