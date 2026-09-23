import { isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';

// The phone-tier flag as a rune-backed object, the svelte counterpart of the
// react port's usePhoneViewport. Construct during component init (the watcher
// `$effect` needs the component's effect context) and read `.isPhone` from
// markup or `$derived`s.
export function createPhoneViewport(): { readonly isPhone: boolean } {
  let isPhone = $state(isPhoneViewport());
  $effect(() => watchPhoneViewport(value => { isPhone = value; }));
  return {
    get isPhone() {
      return isPhone;
    }
  };
}
