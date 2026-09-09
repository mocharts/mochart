import { createComponent, reflectComponentType } from '@angular/core';
import type { ApplicationRef, ComponentRef, EnvironmentInjector } from '@angular/core';
import type { PlaceholderComponent, PlaceholderProps } from './types.js';

// Maps the wrapper's component inputs to the core's DOM-factory prop names.
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
  ref: ComponentRef<unknown> | null;
  refComponent: PlaceholderComponent | null;
  inputNames: Set<string>;
  appliedKeys: Set<keyof PlaceholderProps>;
  factory: (context: PlaceholderProps) => Node;
}

export interface PlaceholderAdapter {
  transform(props: Record<string, any>): Record<string, any>;
  destroy(): void;
}

/**
 * Adapts placeholder component inputs into the DOM-node factories the core
 * expects: each slot keeps one persistent container div that a component
 * instance is rendered into, so repeat factory calls update inputs in place.
 * The factory identity is stable per slot; a component change flows through
 * `transform` and re-renders a slot the core has already rendered with its last context.
 */
export function createPlaceholderAdapter(environmentInjector: EnvironmentInjector, applicationRef: ApplicationRef): PlaceholderAdapter {
  const slots = new Map<string, PlaceholderSlot>();

  function renderSlot(slot: PlaceholderSlot, context: PlaceholderProps): Node {
    slot.context = context;
    if (slot.ref !== null && slot.refComponent !== slot.component) {
      slot.ref.destroy();
      slot.ref = null;
      slot.container.textContent = '';
    }
    if (slot.ref === null) {
      // the div becomes the component's own host element, so it keeps no inline style that would beat its :host rules
      const hostElement = document.createElement('div');
      slot.container.appendChild(hostElement);
      slot.ref = createComponent(slot.component, { environmentInjector, hostElement });
      slot.refComponent = slot.component;
      // Only chart-context keys the component actually declares as inputs are
      // applied (setInput throws on unknown inputs).
      slot.inputNames = new Set((reflectComponentType(slot.component)?.inputs ?? []).map((input) => input.templateName));
      // a fresh instance holds no applied inputs, so nothing needs clearing
      slot.appliedKeys.clear();
      applicationRef.attachView(slot.ref.hostView);
    }
    // chart states pass different key sets, so a key this call omits is cleared rather than left stale
    for (const key of slot.appliedKeys) {
      if (!(key in context)) {
        slot.ref.setInput(key, undefined);
      }
    }
    slot.appliedKeys.clear();
    for (const key of Object.keys(context) as (keyof PlaceholderProps)[]) {
      if (slot.inputNames.has(key)) {
        slot.ref.setInput(key, context[key]);
        slot.appliedKeys.add(key);
      }
    }
    slot.ref.changeDetectorRef.detectChanges();
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
        ref: null,
        refComponent: null,
        inputNames: new Set(),
        appliedKeys: new Set(),
        factory: (context: PlaceholderProps) => renderSlot(slots.get(propName)!, context)
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

  // Destroys a slot's component instance and forgets it; a later input gets a fresh slot.
  function releaseSlot(propName: string): void {
    const slot = slots.get(propName);
    if (!slot) {
      return;
    }
    slot.ref?.destroy();
    slot.ref = null;
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
