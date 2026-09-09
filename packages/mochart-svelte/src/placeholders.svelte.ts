// The `.svelte.ts` name lets the svelte plugin compile this file so the
// `$state` rune is available for reactive placeholder props.
import { mount, unmount } from 'svelte';
import type { PlaceholderComponent, PlaceholderProps } from './types';

// Maps the wrapper's component props to the core's DOM-factory prop names.
const FACTORY_PROP_NAMES: Record<string, string> = {
  loadingComponent: 'getLoadingComponent',
  errorComponent: 'getErrorComponent',
  noDataComponent: 'getNoDataComponent',
  noSizeComponent: 'getNoSizeComponent',
  noSeriesComponent: 'getNoSeriesComponent',
  configErrorComponent: 'getConfigErrorComponent'
};

class PlaceholderSlot {
  component: PlaceholderComponent;
  container: HTMLDivElement;
  factory: (context: PlaceholderProps) => Node;
  private mounted: PlaceholderComponent | null = null;
  private instance: Record<string, any> | null = null;
  private props: PlaceholderProps = $state({});
  private readonly componentContext: Map<any, any> | undefined;

  constructor(component: PlaceholderComponent, componentContext?: Map<any, any>) {
    this.component = component;
    this.componentContext = componentContext;
    this.container = document.createElement('div');
    // The container is a neutral wrapper; the placeholder component owns layout.
    this.container.style.display = 'contents';
    this.factory = (context: PlaceholderProps) => this.render(context);
  }

  private render(context: PlaceholderProps): Node {
    for (const key of Object.keys(this.props)) {
      if (!(key in context)) {
        delete (this.props as Record<string, any>)[key];
      }
    }
    Object.assign(this.props, context);
    this.mountCurrent();
    return this.container;
  }

  /** Mounted or unmounted to match whether the core still holds the container in the chart. */
  syncAttached(host: Element): void {
    const attached = host.contains(this.container);
    if (attached && !this.instance && this.mounted !== null) {
      this.mountCurrent();
    }
    else if (!attached && this.instance) {
      void unmount(this.instance);
      this.instance = null;
    }
  }

  /** Mount the current component, replacing an instance of a previous one. */
  private mountCurrent(): void {
    if (this.instance && this.mounted !== this.component) {
      void unmount(this.instance);
      this.instance = null;
    }
    if (!this.instance) {
      // the chart component's contexts, so placeholders can read app-level providers
      this.instance = mount(this.component, { target: this.container, props: this.props, context: this.componentContext });
      this.mounted = this.component;
    }
  }

  /** A component change remounts a slot the core has already rendered; the core's factory gate would not re-run for it. */
  setComponent(component: PlaceholderComponent): void {
    if (this.component !== component) {
      this.component = component;
      if (this.instance) {
        this.mountCurrent();
      }
    }
  }

  destroy(): void {
    if (this.instance) {
      void unmount(this.instance);
      this.instance = null;
    }
  }
}

export interface PlaceholderAdapter {
  transform(props: Record<string, any>): Record<string, any>;
  /** Watches the chart host so a slot the core detaches (chart left that state) unmounts its instance; returns the stop function. */
  attach(host: Element): () => void;
  destroy(): void;
}

/**
 * Adapts placeholder component props into the DOM-node factories the core
 * expects: each slot keeps one persistent container div holding a mounted
 * instance whose reactive props are updated on repeat factory calls. The
 * factory identity is stable per slot; a component change flows through
 * `transform` and remounts a slot the core has already rendered.
 */
export function createPlaceholderAdapter(componentContext?: Map<any, any>): PlaceholderAdapter {
  const slots = new Map<string, PlaceholderSlot>();

  // Unmounts a slot's instance and forgets it; a later prop gets a fresh slot.
  function releaseSlot(propName: string): void {
    const slot = slots.get(propName);
    if (!slot) {
      return;
    }
    slot.destroy();
    slots.delete(propName);
  }

  return {
    transform(props: Record<string, any>): Record<string, any> {
      const out = { ...props };
      for (const propName of Object.keys(FACTORY_PROP_NAMES)) {
        const component = out[propName] as PlaceholderComponent | undefined;
        delete out[propName];
        if (component) {
          let slot = slots.get(propName);
          if (!slot) {
            slot = new PlaceholderSlot(component, componentContext);
            slots.set(propName, slot);
          }
          slot.setComponent(component);
          out[FACTORY_PROP_NAMES[propName]] = slot.factory;
        }
        else {
          // the chart falls back to its built-in placeholder, so nothing keeps this instance alive
          releaseSlot(propName);
        }
      }
      return out;
    },
    attach(host: Element): () => void {
      if (typeof MutationObserver === 'undefined') {
        return () => {};
      }
      const observer = new MutationObserver(() => {
        for (const slot of slots.values()) {
          slot.syncAttached(host);
        }
      });
      observer.observe(host, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    destroy(): void {
      for (const propName of [...slots.keys()]) {
        releaseSlot(propName);
      }
    }
  };
}
