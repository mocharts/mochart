import { hasConfigStructureChange } from '../config/core/mochartConfig';
import { indexOfCategoryValue } from '../animation/CategoryAnimationData';
import { getCategoryKeyProperty } from '../data/CategoryData';
import type { ChartFocus, ChartSeriesFilter } from '../types/chart';
import type { MochartConfig } from '../types/config';
import type { CategoryValue, DataProvider } from '../types/data';
import type { InternalFocus } from './ChartDataSource';

/** Externally-controlled focus/filter values (undefined = uncontrolled). */
export interface ExternalFocusInput {
  focusedCategoryIndex?: number;
  focusedValueAxisId?: string | null;
  focusedSeriesId?: string | null;
  filteredSeriesIds?: Record<string, boolean>;
}

export interface FocusControllerInput extends ExternalFocusInput {
  // both are null while a host is still loading: the chart renders its loading/error state
  mochartConfig: MochartConfig | null;
  dataProvider: DataProvider | null;
}

/** What a `reconcile` pass changed, for the controller to report after it commits the new props. */
export interface FocusReconcileResult {
  focus?: ChartFocus;
  seriesFilter?: ChartSeriesFilter;
}

function sameFilteredSeriesIds(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every(key => a[key] === b[key]);
}

/** Whether the host set a controlled value in this update that differs from the one it passed before. */
function hostChanged<K extends keyof ExternalFocusInput>(prev: ExternalFocusInput, next: ExternalFocusInput, key: K): boolean {
  const nextValue = next[key];
  const prevValue = prev[key];
  if (nextValue === undefined) {
    return false;
  }
  return key === 'filteredSeriesIds'
    ? prevValue === undefined || !sameFilteredSeriesIds(nextValue as Record<string, boolean>, prevValue as Record<string, boolean>)
    : nextValue !== prevValue;
}

/**
 * Focus and series-filter state machine for a managed chart (was ManagedChart): tracks the focused
 * category/series/axis and the filtered series, remapping or resetting them on config/provider changes.
 */
export class FocusController {
  focusedCategoryIndex = -1;
  focusedValueAxisId: string | null = null;
  focusedSeriesId: string | null = null;
  filteredSeriesIds: Record<string, boolean> = {};
  /** Bumped when the filters change by a toggle, a reset or a host-changed value — not by a host re-asserting the value it already passed — so a pending filter report can tell it has been superseded. */
  filterGeneration = 0;

  private reset(): void {
    this.focusedCategoryIndex = -1;
    this.focusedValueAxisId = null;
    this.focusedSeriesId = null;
    this.filteredSeriesIds = {};
    this.filterGeneration++;
  }

  focus(): ChartFocus {
    const { focusedValueAxisId, focusedSeriesId, focusedCategoryIndex } = this;
    return { focusedValueAxisId, focusedSeriesId, focusedCategoryIndex };
  }

  /**
   * Reconcile focus/filter state with a config or provider change: structural resets everything, a
   * data change remaps the focused category by value (dropped when gone). `renderedCategoryValues` is the last committed ordering — the old
   * provider can't be re-read after an in-place refresh(). A controlled value the host changed in
   * this same update supersedes the remap/reset of its field and is not reported back (it came from
   * the host); one carried along unchanged gives way to the reset/remap, which is committed and
   * reported so the host can sync (it can re-assert its value on its next render). Every other
   * controlled value is applied as-is, like applyExternal. Fires no callbacks: the caller commits
   * first, then notifies re-entrancy-safely from the returned changes.
   */
  reconcile(prev: FocusControllerInput, next: FocusControllerInput,
    renderedCategoryValues: readonly CategoryValue[] | null): FocusReconcileResult {
    const { mochartConfig, dataProvider } = next;
    const { mochartConfig: oldMochartConfig, dataProvider: oldDataProvider } = prev;
    const { focusedValueAxisId: oldFocusedValueAxisId, focusedSeriesId: oldFocusedSeriesId,
      focusedCategoryIndex: oldFocusedCategoryIndex, filteredSeriesIds: oldFilteredSeriesIds } = this;
    // which fields this pass derived (reset or remapped): those stand over an unchanged controlled value
    let derivedAll = false;
    let derivedCategoryIndex = false;

    // hasConfigStructureChange counts a config appearing or disappearing (the loading
    // states) as structural, so this resets then, like a provider change does
    if (hasConfigStructureChange(oldMochartConfig, mochartConfig)) {
      this.reset();
      derivedAll = true;
    }
    else {
      if (dataProvider !== oldDataProvider) {
        if (oldDataProvider && dataProvider) {
          if (this.focusedCategoryIndex >= 0) {
            derivedCategoryIndex = true;
            // categories are identified by their key values, like every other stage; absent values drop the focus like a vanished category
            const categoryProperty = mochartConfig ? getCategoryKeyProperty(mochartConfig.categoryAxis) : undefined;
            const newCategoryValues = categoryProperty !== undefined
              ? dataProvider.getPropertyValues(categoryProperty) as readonly CategoryValue[] | undefined
              : undefined;
            if (renderedCategoryValues && newCategoryValues) {
              const categoryValue = renderedCategoryValues[this.focusedCategoryIndex];
              this.focusedCategoryIndex = indexOfCategoryValue(mochartConfig!.categoryAxis, newCategoryValues, categoryValue);
            }
            else {
              this.focusedCategoryIndex = -1;
            }
          }
        }
        else {
          this.reset();
          derivedAll = true;
        }
      }
    }
    derivedCategoryIndex = derivedCategoryIndex || derivedAll;
    // the host's controlled values, except where an unchanged one would undo what this pass derived
    const hostChangedCategoryIndex = hostChanged(prev, next, 'focusedCategoryIndex');
    const hostChangedValueAxisId = hostChanged(prev, next, 'focusedValueAxisId');
    const hostChangedSeriesId = hostChanged(prev, next, 'focusedSeriesId');
    const hostChangedFilteredSeriesIds = hostChanged(prev, next, 'filteredSeriesIds');
    this.applyExternal({
      focusedCategoryIndex: hostChangedCategoryIndex || !derivedCategoryIndex ? next.focusedCategoryIndex : undefined,
      focusedValueAxisId: hostChangedValueAxisId || !derivedAll ? next.focusedValueAxisId : undefined,
      focusedSeriesId: hostChangedSeriesId || !derivedAll ? next.focusedSeriesId : undefined,
      filteredSeriesIds: hostChangedFilteredSeriesIds || !derivedAll ? next.filteredSeriesIds : undefined
    });
    if (hostChangedFilteredSeriesIds) {
      this.filterGeneration++;
    }
    // report what this pass derived and the host did not supersede, by value
    const { focusedValueAxisId, focusedSeriesId, focusedCategoryIndex, filteredSeriesIds } = this;
    const focusChanged = (derivedAll && !hostChangedValueAxisId && focusedValueAxisId !== oldFocusedValueAxisId)
      || (derivedAll && !hostChangedSeriesId && focusedSeriesId !== oldFocusedSeriesId)
      || (derivedCategoryIndex && !hostChangedCategoryIndex && focusedCategoryIndex !== oldFocusedCategoryIndex);
    const result: FocusReconcileResult = {};
    if (focusChanged) {
      result.focus = this.focus();
    }
    // by value, not identity: a reset that finds no filters is not a change
    if (derivedAll && !hostChangedFilteredSeriesIds && !sameFilteredSeriesIds(filteredSeriesIds, oldFilteredSeriesIds)) {
      result.seriesFilter = { filteredSeriesIds };
    }
    return result;
  }

  /**
   * Apply the host's controlled focus/filter props: set fields override internal state, undefined
   * fields stay chart-managed. No callbacks fire — the values came from the host.
   */
  applyExternal(input: ExternalFocusInput): void {
    const { focusedCategoryIndex, focusedValueAxisId, focusedSeriesId, filteredSeriesIds } = input;
    if (focusedCategoryIndex !== undefined) {
      this.focusedCategoryIndex = focusedCategoryIndex;
    }
    if (focusedValueAxisId !== undefined) {
      this.focusedValueAxisId = focusedValueAxisId;
    }
    if (focusedSeriesId !== undefined) {
      this.focusedSeriesId = focusedSeriesId;
    }
    // by value: a fresh but equal object (the framework norm) must not re-run the data pipeline
    if (filteredSeriesIds !== undefined && !sameFilteredSeriesIds(filteredSeriesIds, this.filteredSeriesIds)) {
      this.filteredSeriesIds = filteredSeriesIds;
    }
  }

  /** Apply a partial focus update raised from inside the chart. */
  applyFocus(focus: InternalFocus): ChartFocus {
    const { valueAxisId, seriesId, categoryIndex } = focus;
    if (valueAxisId !== undefined) {
      this.focusedValueAxisId = valueAxisId;
    }
    if (seriesId !== undefined) {
      this.focusedSeriesId = seriesId;
    }
    if (categoryIndex !== undefined) {
      this.focusedCategoryIndex = categoryIndex ?? -1;
    }
    return this.focus();
  }

  /** Toggle a series in/out of the filtered set; follower series (`followSeries`) derive their state from it. */
  toggleSeriesFilter(seriesId: string): ChartSeriesFilter {
    // copy before mutating so snapshots handed to host callbacks stay frozen
    // null proto: an id of __proto__ must land as an own key, not hit the prototype setter
    const filteredSeriesIds: Record<string, boolean> = Object.assign(Object.create(null), this.filteredSeriesIds);
    const filtered = filteredSeriesIds[seriesId] !== true;
    if (filtered) {
      filteredSeriesIds[seriesId] = true;
    }
    else {
      delete filteredSeriesIds[seriesId];
    }
    this.filteredSeriesIds = filteredSeriesIds;
    this.filterGeneration++;
    // a filtered series cannot stay focused
    if (this.focusedSeriesId !== null && filteredSeriesIds[this.focusedSeriesId] === true) {
      this.focusedSeriesId = null;
    }
    return { filteredSeriesIds };
  }
}
