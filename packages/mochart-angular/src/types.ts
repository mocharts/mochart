import type { Type } from '@angular/core';
import type { DataProvider, MochartConfig } from '@mochart/core';

/** Props mochart passes to placeholder components (loading, error, and empty states). */
export interface PlaceholderProps {
  width?: number;
  height?: number;
  mochartConfig?: MochartConfig | null;
  dataProvider?: DataProvider | null;
  error?: unknown;
  hasData?: boolean;
}

/**
 * An Angular component rendered for one of the chart's placeholder states.
 * The chart context (`width`, `height`, `error`, …) is applied to whichever
 * of the `PlaceholderProps` names the component declares as inputs.
 */
export type PlaceholderComponent = Type<unknown>;
