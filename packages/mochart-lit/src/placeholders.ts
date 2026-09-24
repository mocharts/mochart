import { nothing, render } from 'lit-html';
import type { PlaceholderProps, PlaceholderTemplate } from './types.js';

// Maps the wrapper's template props to the core's DOM-factory prop names.
const FACTORY_PROP_NAMES: Record<string, string> = {
  loadingTemplate: 'getLoadingComponent',
  errorTemplate: 'getErrorComponent',
  noDataTemplate: 'getNoDataComponent',
  noSizeTemplate: 'getNoSizeComponent',
  noSeriesTemplate: 'getNoSeriesComponent',
  configErrorTemplate: 'getConfigErrorComponent'
};

interface PlaceholderSlot {
  template: PlaceholderTemplate;
  /** The last context the core rendered this slot with; null until its first factory call. */
  context: PlaceholderProps | null;
  container: HTMLDivElement;
  /** Whether the container holds a rendered template; false once the core dropped the container from the chart. */
  rendered: boolean;
  factory: (context: PlaceholderProps) => Node;
}

export interface PlaceholderAdapter {
  transform(props: Record<string, any>): Record<string, any>;
  /** Watches the chart host so a slot the core detaches (chart left that state) renders nothing, disconnecting its directives, and one it re-attaches renders again; returns the stop function. */
  attach(host: Element): () => void;
  destroy(): void;
}

/**
 * Adapts placeholder template props into the DOM-node factories the core
 * expects: each slot keeps one persistent container div that templates are
 * rendered into, so repeat factory calls patch in place. The factory identity
 * is stable per slot; a template change (every host render, for an inline
 * template) flows through `transform` and re-renders a slot the core has
 * already rendered with its last context.
 */
export function createPlaceholderAdapter(): PlaceholderAdapter {
  const slots = new Map<string, PlaceholderSlot>();

  function renderSlot(slot: PlaceholderSlot, context: PlaceholderProps): Node {
    slot.context = context;
    slot.rendered = true;
    render(slot.template({ ...context }), slot.container);
    return slot.container;
  }

  // Renders nothing into the container, which disconnects the template's directives.
  function clearSlot(slot: PlaceholderSlot): void {
    if (slot.rendered) {
      slot.rendered = false;
      render(nothing, slot.container);
    }
  }

  /** The core only removes a slot's container when the chart leaves the state: the template goes with it, and re-entry renders it again, as React and Svelte do. */
  function syncAttached(slot: PlaceholderSlot, host: Element): void {
    // containment, not isConnected: a chart hosted in a detached tree still owns its placeholders
    const attached = host.contains(slot.container);
    if (!attached && slot.rendered) {
      clearSlot(slot);
    }
    else if (attached && !slot.rendered && slot.context !== null) {
      renderSlot(slot, slot.context);
    }
  }

  function getSlot(propName: string, template: PlaceholderTemplate): PlaceholderSlot {
    let slot = slots.get(propName);
    if (!slot) {
      const container = document.createElement('div');
      // The container is a neutral wrapper; the placeholder template owns layout.
      container.style.display = 'contents';
      slot = {
        template,
        context: null,
        container,
        rendered: false,
        factory: (context: PlaceholderProps) => renderSlot(slots.get(propName)!, context)
      };
      slots.set(propName, slot);
    }
    if (slot.template !== template) {
      slot.template = template;
      // the core's factory gate keys on the stable factory identity, so it would not re-run for this
      if (slot.context) {
        renderSlot(slot, slot.context);
      }
    }
    return slot;
  }

  // Clears a slot's rendered template (disconnecting its directives) and forgets it.
  function releaseSlot(propName: string): void {
    const slot = slots.get(propName);
    if (!slot) {
      return;
    }
    clearSlot(slot);
    slots.delete(propName);
  }

  return {
    transform(props: Record<string, any>): Record<string, any> {
      const out = { ...props };
      for (const propName of Object.keys(FACTORY_PROP_NAMES)) {
        const template = out[propName] as PlaceholderTemplate | undefined;
        delete out[propName];
        if (template) {
          out[FACTORY_PROP_NAMES[propName]] = getSlot(propName, template).factory;
        }
        else {
          // the chart falls back to its built-in placeholder, so nothing keeps this render alive
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
          syncAttached(slot, host);
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
