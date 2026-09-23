import { signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';

export interface ElementSize {
  width: WritableSignal<number>;
  height: WritableSignal<number>;
  observe(element: Element | null | undefined): void;
  disconnect(): void;
}

/**
 * Measures an element's client size with a ResizeObserver, the Angular
 * equivalent of the Vue demo's useElementSize composable. Call `observe`
 * from ngAfterViewInit and `disconnect` from ngOnDestroy.
 */
export function createElementSize(): ElementSize {
  const width = signal(0);
  const height = signal(0);

  let observer: ResizeObserver | null = null;

  function measure(element: Element) {
    width.set(element.clientWidth);
    height.set(element.clientHeight);
  }

  return {
    width,
    height,
    observe(element: Element | null | undefined): void {
      if (element) {
        measure(element);
        observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            measure(entry.target);
          }
        });
        observer.observe(element);
      }
    },
    disconnect(): void {
      observer?.disconnect();
      observer = null;
    }
  };
}
