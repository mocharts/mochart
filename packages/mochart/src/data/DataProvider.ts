import type { DataProvider, DataObject, DataValue, ObjectOfArraysData } from '../types/data';

/** Stateless per-property reads over an array of objects. Objects added, removed, or
 * edited in place are seen whenever the chart re-reads; the chart handle's `refresh` triggers that. */
export class ArrayOfObjectsDataProvider<TObject extends DataObject = DataObject> implements DataProvider {
  constructor(private readonly data: readonly TObject[]) {
  }

  getPropertyValues(property: string): readonly DataValue[] | undefined {
    // a property in no object is absent, not N missing values; a null entry has no properties rather than throwing on `in`
    if (this.data.length > 0 && !this.data.some(obj => obj != null && property in obj)) {
      return undefined;
    }
    return this.data.map(obj => obj?.[property] as DataValue);
  }
}

/** Stateless zero-copy reads over an object holding one array per property. Mutated and
 * reassigned arrays alike are seen whenever the chart re-reads; the chart handle's `refresh` triggers that. */
export class ObjectOfArraysDataProvider<TData extends ObjectOfArraysData = ObjectOfArraysData> implements DataProvider {
  constructor(private readonly data: TData) {
  }

  getPropertyValues(property: string): readonly DataValue[] | undefined {
    const values = this.data[property];
    return Array.isArray(values) ? values as readonly DataValue[] : undefined;
  }
}
