import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Measures an element's client size with a ResizeObserver, the Lit
 * equivalent of the Vue demo's `useElementSize` composable (which covered
 * Svelte's `bind:clientWidth`/`bind:clientHeight`).
 * Attach it to the measured element with lit-html's `ref()` directive:
 * `<div ${ref(this.size.attach)}>`.
 */
export class ElementSizeController implements ReactiveController {
  width = 0;
  height = 0;

  private host: ReactiveControllerHost;
  private observer: ResizeObserver | null = null;
  private element: Element | undefined;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  // Ref callback for lit-html's `ref()` directive; called with undefined
  // when the element leaves the DOM.
  attach = (element?: Element): void => {
    if (element === this.element) {
      return;
    }
    this.disconnect();
    this.element = element;
    if (element !== undefined) {
      this.measure(element);
      this.observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.measure(entry.target);
        }
      });
      this.observer.observe(element);
    }
  };

  hostDisconnected(): void {
    this.disconnect();
    this.element = undefined;
  }

  private measure(element: Element): void {
    const nextWidth = element.clientWidth;
    const nextHeight = element.clientHeight;
    if (nextWidth !== this.width || nextHeight !== this.height) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.host.requestUpdate();
    }
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
