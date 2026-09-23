// Viewport-width tiers shared by all six framework ports, so the one thing the
// stylesheet cannot do on its own (leaving a mode out of the switcher) agrees
// with the breakpoints in demo.css.

import { switchableDemoModes } from './gallery';
import type { SwitchableDemoMode } from './gallery';

/**
 * Phones. At this size the demo drops Multi mode: a rows × cols grid of charts
 * has no room to be legible, and the shell does not scroll, so there is nowhere
 * for the overflow to go.
 *
 * Keep in step with the phone tier in demo.css.
 */
export const phoneMaxWidth = 640;

/**
 * A phone turned sideways is still a phone, but it is wider than
 * `phoneMaxWidth` (896×414 for the largest of them). Height alone would catch
 * short desktop windows too, so both bounds are needed.
 */
export const landscapePhoneMaxWidth = 900;
export const landscapePhoneMaxHeight = 480;

const phoneQuery = '(max-width: ' + phoneMaxWidth + 'px), '
  + '(max-width: ' + landscapePhoneMaxWidth + 'px) and (max-height: ' + landscapePhoneMaxHeight + 'px)';

/**
 * The custom property demo.css sets to `0` on `:root` and to `1` from inside
 * its phone media block, i.e. the stylesheet's own answer, rather than a
 * second derivation of the same numbers.
 */
const phoneTierProperty = '--demo-phone';

/**
 * Dev-only guard against the two copies of the phone breakpoint drifting.
 *
 * `phoneQuery` above and the `@media (max-width: 640px), (max-width: 900px) and
 * (max-height: 480px)` block at the bottom of demo.css are the same rule
 * written twice, in two languages, and until now nothing but a comment in each
 * asked them to stay in step. The two directions of drift fail very
 * differently, which is why this is worth a check rather than a comment:
 *
 * - Stylesheet narrower than the JS: the JS drops Multi mode from the switcher
 *   at a width the stylesheet still lays out as a desktop. Cosmetic, and the
 *   missing button is right there to see.
 * - Stylesheet wider than the JS: the stylesheet applies `flex-wrap: nowrap` to
 *   a navigation row whose surplus controls the JS has *not* folded into the
 *   overflow menu, inside a container with `overflow: hidden`. The controls
 *   past the right edge are simply gone: no wrap, no scrollbar, no clue on
 *   screen that anything is missing. That failure can survive review.
 *
 * Development builds only; this is a development aid, not behaviour. It is also
 * quiet whenever it cannot get a real answer (during SSR/prerender, and in
 * jsdom-style test environments where demo.css was never loaded and the
 * property resolves to the empty string), so it can never turn a missing
 * stylesheet into console noise.
 */
function assertPhoneTierInSync(matches: boolean): void {
  if (import.meta.env?.DEV !== true) {
    return;
  }
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return;
  }
  const declared = getComputedStyle(document.documentElement).getPropertyValue(phoneTierProperty).trim();
  if (declared === '') {
    return;
  }
  const stylesheetSaysPhone = declared === '1';
  if (stylesheetSaysPhone !== matches) {
    console.error(
      '[demo-common] phone breakpoint drift: demo.css says ' + phoneTierProperty + ': ' + declared
        + ' (phone=' + String(stylesheetSaysPhone) + ') but matchMedia("' + phoneQuery + '") says '
        + String(matches) + '. The phone @media block in demo-common/css/demo.css and phoneQuery in '
        + 'demo-common/src/viewport.ts have to describe the same viewports.'
    );
  }
}

/** False during SSR/prerender, where there is no viewport to ask. */
export function isPhoneViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const matches = window.matchMedia(phoneQuery).matches;
  assertPhoneTierInSync(matches);
  return matches;
}

/**
 * Calls `onChange` whenever the viewport crosses the phone breakpoint (a
 * rotation or a resized desktop window, not just the initial load). Returns the
 * unsubscribe function; it does not fire on subscribe.
 */
export function watchPhoneViewport(onChange: (isPhone: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(phoneQuery);
  // Checked on every crossing as well as on read: a resize is the moment the
  // two tiers are actually being asked the same question, and a drift of a
  // single pixel only shows up in the band between the two breakpoints.
  const listener = (event: MediaQueryListEvent): void => {
    assertPhoneTierInSync(event.matches);
    onChange(event.matches);
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** The mode a phone falls back to when it asks for one it cannot show. */
export const phoneFallbackDemoMode: SwitchableDemoMode = 'single';

/**
 * Whether a mode is offered at all at this width. Keeping the policy here rather
 * than in each port means the switcher, the router and the share-link handling
 * cannot drift apart.
 */
export function isDemoModeAvailable(mode: SwitchableDemoMode, isPhone: boolean): boolean {
  return !(isPhone && mode === 'multi');
}

/** The modes the in-demo switcher should offer at this width. */
export function getAvailableDemoModes(isPhone: boolean): readonly SwitchableDemoMode[] {
  return switchableDemoModes.filter(mode => isDemoModeAvailable(mode, isPhone));
}
