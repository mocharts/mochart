import { ChartController } from './chart/ChartController';
import { DefaultChartInput } from './chart/DefaultChartInput';
import type { DefaultChartProps, ManagedChartProps } from './types/chart';
import type { DataProvider } from './types/data';

/** Handle returned by `createChart`/`createDefaultChart` for a mounted chart. */
export interface ChartHandle<TProps extends object = ManagedChartProps> {
  /**
   * Merge new props into the chart. Change detection is by object identity — in-place mutation is
   * not seen (use `refresh` for that). Changes animate when animation is enabled, except structural
   * config changes (rebuild + initial animation replay); width/height re-layout instantly.
   */
  update(nextProps: Partial<TProps>): void;
  /**
   * Replace the props wholesale: a key absent from `nextProps` is unset and returns to
   * chart-managed behavior, where `update` would keep its previous value. Identity-detected like
   * `update`. For hosts that pass the complete prop set on every render.
   */
  replace(nextProps: TProps): void;
  /**
   * Re-read the current data without a new reference — the escape hatch for in-place mutation: a
   * default chart rebuilds its provider over `data`; a managed chart calls the provider's optional
   * `refresh()` hook, then re-reads it (the built-in providers are stateless, so the re-read alone
   * suffices; a caching custom provider should implement `refresh()` to invalidate).
   */
  refresh(): void;
  /**
   * Cancel running tweens and remove the chart's DOM from the container. Safe to call more than
   * once, and the other methods no-op afterwards — a late `update`/`replace`/`refresh` from a
   * pending timer or an unmounted component does nothing at all, not even re-read the data.
   */
  destroy(): void;
}

/** A delegating copy with a new identity, so the pipeline re-reads a provider it has already seen. */
function withFreshIdentity(dataProvider: DataProvider): DataProvider {
  const fresh = {} as DataProvider;
  if (typeof dataProvider.getPropertyValues === 'function') {
    fresh.getPropertyValues = property => dataProvider.getPropertyValues(property);
  }
  if (dataProvider.getError) {
    fresh.getError = () => dataProvider.getError!();
  }
  if (dataProvider.getLoading) {
    fresh.getLoading = () => dataProvider.getLoading!();
  }
  return fresh;
}

/**
 * Imperative entry point: mount a managed chart into a DOM element from an enhanced config
 * (`mochartConfig`) and a data provider. Retained-mode rendering — updates write only changed
 * DOM attributes; there is no vdom.
 */
export function createChart(container: Element, props: ManagedChartProps): ChartHandle<ManagedChartProps> {
  // props keep the host's own provider (what the state factories get); the pipeline and the
  // Chart's own loading/error reads go through a delegate so refresh() can re-read an unchanged identity
  let currentProps = { ...props };
  let readDataProvider = wrapForReads(currentProps.dataProvider);
  const controller = new ChartController(container, currentProps, readDataProvider);
  let destroyed = false;
  return {
    update(nextProps: Partial<ManagedChartProps>) {
      if (destroyed) {
        return;
      }
      nextProps = withoutUndefinedKeys(nextProps);
      if (nextProps.dataProvider !== undefined && nextProps.dataProvider !== currentProps.dataProvider) {
        readDataProvider = wrapForReads(nextProps.dataProvider);
      }
      currentProps = { ...currentProps, ...nextProps };
      controller.update(currentProps, readDataProvider);
    },
    replace(nextProps: ManagedChartProps) {
      if (destroyed) {
        return;
      }
      if (nextProps.dataProvider !== currentProps.dataProvider) {
        readDataProvider = wrapForReads(nextProps.dataProvider);
      }
      currentProps = { ...nextProps };
      controller.update(currentProps, readDataProvider);
    },
    refresh() {
      if (destroyed) {
        return;
      }
      currentProps.dataProvider?.refresh?.();
      readDataProvider = wrapForReads(currentProps.dataProvider);
      controller.update(currentProps, readDataProvider);
    },
    destroy() {
      destroyed = true;
      controller.destroy();
    }
  };
}

/** An explicitly-undefined key means "no change", like an absent key; replace() is the way to unset. */
function withoutUndefinedKeys<TProps extends object>(props: Partial<TProps>): Partial<TProps> {
  const defined: Partial<TProps> = {};
  for (const key of Object.keys(props) as (keyof TProps)[]) {
    if (props[key] !== undefined) {
      defined[key] = props[key];
    }
  }
  return defined;
}

/** null stays null: bindings mount with no provider for the loading/error states. */
function wrapForReads(dataProvider: DataProvider | null | undefined): DataProvider | null {
  return dataProvider ? withFreshIdentity(dataProvider) : null;
}

/**
 * Convenience entry point for plain-JavaScript hosts: takes a raw `config` (enhanced internally)
 * and a plain `data` dataset — an array of objects or an object of arrays.
 */
export function createDefaultChart(container: Element, props: DefaultChartProps): ChartHandle<DefaultChartProps> {
  let currentProps = { ...props };
  const input = new DefaultChartInput();
  input.start(currentProps);
  // no delegate here: DefaultChartInput mints a new provider whenever it re-reads
  const controller = new ChartController(container, toManagedProps(currentProps, input), input.dataProvider);
  let destroyed = false;
  return {
    update(nextProps: Partial<DefaultChartProps>) {
      if (destroyed) {
        return;
      }
      nextProps = withoutUndefinedKeys(nextProps);
      const prevProps = currentProps;
      currentProps = { ...currentProps, ...nextProps };
      input.update(prevProps, currentProps);
      controller.update(toManagedProps(currentProps, input), input.dataProvider);
    },
    replace(nextProps: DefaultChartProps) {
      if (destroyed) {
        return;
      }
      const prevProps = currentProps;
      currentProps = { ...nextProps };
      input.update(prevProps, currentProps);
      controller.update(toManagedProps(currentProps, input), input.dataProvider);
    },
    refresh() {
      if (destroyed) {
        return;
      }
      input.refresh(currentProps);
      controller.update(toManagedProps(currentProps, input), input.dataProvider);
    },
    destroy() {
      destroyed = true;
      controller.destroy();
    }
  };
}

function toManagedProps(props: DefaultChartProps, input: DefaultChartInput): ManagedChartProps {
  const { config: _config, data: _data, ...rest } = props;
  return { ...rest, mochartConfig: input.mochartConfig, dataProvider: input.dataProvider };
}
