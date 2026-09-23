import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Measures an element's client size with a ResizeObserver, the Vue
 * equivalent of Svelte's `bind:clientWidth`/`bind:clientHeight`.
 */
export function useElementSize(): { elementRef: Ref<HTMLElement | null>; width: Ref<number>; height: Ref<number> } {
  const elementRef = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);

  let observer: ResizeObserver | null = null;

  function measure(element: Element) {
    width.value = element.clientWidth;
    height.value = element.clientHeight;
  }

  onMounted(() => {
    const element = elementRef.value;
    if (element !== null) {
      measure(element);
      observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          measure(entry.target);
        }
      });
      observer.observe(element);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return { elementRef, width, height };
}
