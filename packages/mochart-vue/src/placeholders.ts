import { h, render } from 'vue';
import type { AppContext } from 'vue';
import type { PlaceholderComponent, PlaceholderProps } from './types.js';

// Maps the wrapper's component props to the core's DOM-factory prop names.
const FACTORY_PROP_NAMES: Record<string, string> = {
  loadingComponent: 'getLoadingComponent',
  errorComponent: 'getErrorComponent',
  noDataComponent: 'getNoDataComponent',
  noSizeComponent: 'getNoSizeComponent',
  noSeriesComponent: 'getNoSeriesComponent',
  configErrorComponent: 'getConfigErrorComponent'
};

interface PlaceholderSlot {
  component: PlaceholderComponent;
  /** The last context the core rendered this slot with; null until its first factory call. */
  context: PlaceholderProps | null;
  container: HTMLDivElement;
  factory: (context: PlaceholderProps) => Node;
  /** Whether a deferred render is scheduled for the container. */
  renderPending: boolean;
}

export interface PlaceholderAdapter {
  transform(props: Record<string, any>): Record<string, any>;
  destroy(): void;
}

/**
 * Adapts placeholder component props into the DOM-node factories the core
 * expects: each slot keeps one persistent container div that vnodes are
 * rendered into, so repeat factory calls patch in place. The factory identity
 * is stable per slot; a component change flows through `transform` and
 * re-renders a slot the core has already rendered with its last context.
 */
export function createPlaceholderAdapter(appContext: AppContext | null = null): PlaceholderAdapter {
  const slots = new Map<string, PlaceholderSlot>();

  // The container returns synchronously for the core to insert; the vnode renders in a microtask so the
  // placeholder mounts inside the document on every path (a mid-flush render would run its mounted hooks
  // detached). A microtask, not nextTick: it lands before a host's own awaited nextTick.
  function renderSlot(slot: PlaceholderSlot, context: PlaceholderProps): Node {
    slot.context = context;
    if (!slot.renderPending) {
      slot.renderPending = true;
      queueMicrotask(() => {
        slot.renderPending = false;
        // released before the tick: the slot is gone and its container already rendered empty
        if (slot.context === null) {
          return;
        }
        const vnode = h(slot.component as any, { ...slot.context });
        // the host app's context, so placeholders can inject app-level providers
        vnode.appContext = appContext;
        render(vnode, slot.container);
      });
    }
    return slot.container;
  }

  function getSlot(propName: string, component: PlaceholderComponent): PlaceholderSlot {
    let slot = slots.get(propName);
    if (!slot) {
      const container = document.createElement('div');
      // The container is a neutral wrapper; the placeholder component owns layout.
      container.style.display = 'contents';
      slot = {
        component,
        context: null,
        container,
        factory: (context: PlaceholderProps) => renderSlot(slots.get(propName)!, context),
        renderPending: false
      };
      slots.set(propName, slot);
    }
    if (slot.component !== component) {
      slot.component = component;
      // the core's factory gate keys on the stable factory identity, so it would not re-run for this
      if (slot.context) {
        renderSlot(slot, slot.context);
      }
    }
    return slot;
  }

  // Unmounts a slot's instance and forgets it; a later prop gets a fresh slot.
  function releaseSlot(propName: string): void {
    const slot = slots.get(propName);
    if (!slot) {
      return;
    }
    slot.context = null;
    render(null, slot.container);
    slots.delete(propName);
  }

  return {
    transform(props: Record<string, any>): Record<string, any> {
      const out = { ...props };
      for (const propName of Object.keys(FACTORY_PROP_NAMES)) {
        const component = out[propName] as PlaceholderComponent | undefined;
        delete out[propName];
        if (component) {
          out[FACTORY_PROP_NAMES[propName]] = getSlot(propName, component).factory;
        }
        else {
          // the chart falls back to its built-in placeholder, so nothing keeps this instance alive
          releaseSlot(propName);
        }
      }
      return out;
    },
    destroy(): void {
      for (const propName of [...slots.keys()]) {
        releaseSlot(propName);
      }
    }
  };
}
