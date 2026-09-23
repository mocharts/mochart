import { onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';

import { isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';

/**
 * Tracks whether the viewport is phone-width, so the parts the stylesheet cannot
 * express (leaving a mode out of the switcher, routing away from it) react to a
 * rotation the same way the media queries do.
 */
export function usePhoneViewport(): Ref<boolean> {
  const isPhone = ref(isPhoneViewport());
  const unsubscribe = watchPhoneViewport(value => {
    isPhone.value = value;
  });
  onUnmounted(unsubscribe);

  return isPhone;
}
