import { DestroyRef, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';

/**
 * The phone-tier flag as a signal, the angular counterpart of the react and
 * vue ports' `usePhoneViewport` and the svelte port's `createPhoneViewport`.
 *
 * Call it from a field initializer (or the constructor); it needs an injection
 * context for `DestroyRef`, which is what unsubscribes the media-query
 * listener. That is the one difference from the `implements OnDestroy` +
 * stored-unsubscribe shape ModeSwitcher used when it was the only consumer.
 * Six components now want this, and six copies of the teardown is six chances
 * to forget it.
 */
export function phoneViewport(): Signal<boolean> {
  const isPhone = signal(isPhoneViewport());
  inject(DestroyRef).onDestroy(watchPhoneViewport(value => isPhone.set(value)));
  return isPhone.asReadonly();
}
