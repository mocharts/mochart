import { enhanceConfig } from '../config/helper';
import { ArrayOfObjectsDataProvider, ObjectOfArraysDataProvider } from '../data/DataProvider';
import { getDataErrors } from '../data/DataValidator';
import type { DefaultChartProps } from '../types/chart';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { ArrayOfObjectsData, DataProvider, ObjectOfArraysData } from '../types/data';

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && v !== undefined && typeof v === "object";
}

function isArrayOfObjects(data: unknown): data is ArrayOfObjectsData {
  return Array.isArray(data) && !data.some(v => !isObject(v));
}

function isObjectOfArrays(data: unknown): data is ObjectOfArraysData {
  return isObject(data) && !Array.isArray(data) && Object.values(data).every(v => Array.isArray(v));
}

function buildErrorDataProvider(error: unknown = 'Invalid Data'): DataProvider {
  return {
    getError: () => error,
    getPropertyValues: () => undefined
  };
}

function createRawDataProvider(data: unknown): DataProvider | null {
  if (isArrayOfObjects(data)) {
    return new ArrayOfObjectsDataProvider(data);
  }
  return isObjectOfArrays(data) ? new ObjectOfArraysDataProvider(data) : null;
}

/**
 * Input adapter for createDefaultChart (was the DefaultChart component): enhances the raw `config`
 * and wraps the plain `data` (array of objects or object of arrays, dispatched by shape) in a
 * validated provider for the ChartController.
 */
export class DefaultChartInput {
  mochartConfig: EnhancedMochartConfig | null = null;
  dataProvider: DataProvider | null = null;

  /** provider over the raw data, before validation against the config */
  private rawDataProvider: DataProvider | null = null;
  /** shared error provider so staying invalid keeps a stable identity */
  private errorDataProvider: DataProvider | null = null;

  private validateDataProvider(mochartConfig: EnhancedMochartConfig): DataProvider {
    if (this.rawDataProvider !== null && getDataErrors(mochartConfig, this.rawDataProvider).length === 0) {
      return this.rawDataProvider;
    }
    if (this.errorDataProvider === null) {
      this.errorDataProvider = buildErrorDataProvider();
    }
    return this.errorDataProvider;
  }

  start(props: DefaultChartProps): void {
    const { config, data } = props;
    const mochartConfig = enhanceConfig(config) as EnhancedMochartConfig;
    this.rawDataProvider = createRawDataProvider(data);
    this.mochartConfig = mochartConfig;
    this.dataProvider = this.validateDataProvider(mochartConfig);
  }

  update(prev: DefaultChartProps, next: DefaultChartProps): void {
    const { config, data } = next;
    const configChanged = config !== prev.config;
    const dataChanged = data !== prev.data;

    if (configChanged || dataChanged) {
      let { mochartConfig } = this;
      if (configChanged) {
        mochartConfig = enhanceConfig(config) as EnhancedMochartConfig;
      }
      if (dataChanged) {
        this.rawDataProvider = createRawDataProvider(data);
      }
      // validity depends on the config too (series properties, category axis),
      // so it is rechecked even when only the config changed
      this.mochartConfig = mochartConfig;
      this.dataProvider = this.validateDataProvider(mochartConfig!);
    }
  }

  /** Rebuild the provider over the current `data` reference, picking up in-place mutations. */
  refresh(props: DefaultChartProps): void {
    const { mochartConfig } = this;
    if (mochartConfig !== null) {
      this.rawDataProvider = createRawDataProvider(props.data);
      this.dataProvider = this.validateDataProvider(mochartConfig);
    }
  }
}
