import type { DemoDataProvider } from './types';

/** A provider stub that only reports an error, to render the chart's error state. */
export function createErrorDataProvider(error: string | boolean): DemoDataProvider {
  return {
    getPropertyValues: () => undefined,
    getError: () => error
  };
}
