import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ComponentPublicInstance, CSSProperties, ComputedRef, Ref } from 'vue';

import { getMenuPosition, menuZIndex, watchMenuDismiss } from '@mochart/demo-common';
import type { MenuPlacement } from '@mochart/demo-common';

// The vue half of demo-common's menu machinery — the composition-API
// counterpart of the react port's useMenu and the svelte port's Menu class.
// The imperative ports use `createMenuController`; a vue component owns its
// own open state, so this takes only the two shared layers — `getMenuPosition`
// (where the fixed panel goes) and `watchMenuDismiss` (when it closes) — and
// re-expresses the controller's remaining behaviour:
//
// - the panel is positioned synchronously on open, BEFORE the `open` class
//   lands, so it is never painted at coordinates carried over from last time;
// - dismissal (outside pointerdown, Escape, scroll outside the panel, resize,
//   visual-viewport resize) is subscribed only while open;
// - closing with focus inside the panel hands focus back to the trigger, so a
//   keyboard user is not dumped at the top of the document;
// - the trigger/panel pair gets disclosure ARIA (`aria-expanded` +
//   `aria-controls` / `aria-labelledby`) — these are disclosures, not
//   `role="menu"` menus, for the reasons in demo-common/src/menu.ts.
//
// Wire the elements with `ref="trigger"` / `ref="panel"` (destructure the
// returned refs to top-level names) and `v-bind` the prop objects.

export interface UseMenuOptions {
  placement?: MenuPlacement;
  /**
   * Measure from something other than the trigger — e.g. a whole controls row,
   * when the trigger is not the last thing in it and `align: 'end'` must reach
   * the row's true right edge.
   */
  getAnchor?: () => HTMLElement | null;
  /** Trigger id, when something outside the menu must reference it; otherwise one is minted. */
  triggerId?: string;
}

export interface MenuState {
  open: Ref<boolean>;
  // Properties rather than method shorthands — see the note in the react port:
  // these have no `this`, and shorthand would claim otherwise.
  toggle: () => void;
  close: () => void;
  trigger: Ref<HTMLButtonElement | null>;
  panel: Ref<HTMLElement | null>;
  /** Bind with `:ref="setTrigger"` — templates unwrap a bare ref to its value. */
  setTrigger(el: Element | ComponentPublicInstance | null): void;
  /** Bind with `:ref="setPanel"`. */
  setPanel(el: Element | ComponentPublicInstance | null): void;
  /** `v-bind` onto the trigger `<button>`. */
  triggerProps: ComputedRef<Record<string, unknown>>;
  /** `v-bind` onto the panel element. `style` is undefined until positioned. */
  panelProps: ComputedRef<{ id: string; 'aria-labelledby': string; style: CSSProperties | undefined }>;
  /** True once the panel is positioned — append the `open` class on this. */
  isPositioned: ComputedRef<boolean>;
}

let menuIdCounter = 0;

export function useMenu(options: UseMenuOptions = {}): MenuState {
  const open = ref(false);
  const panelStyle = ref<CSSProperties | undefined>(undefined);
  const trigger = ref<HTMLButtonElement | null>(null);
  const panel = ref<HTMLElement | null>(null);

  menuIdCounter += 1;
  const triggerId = options.triggerId ?? 'demo-menu-trigger-v' + menuIdCounter;
  const panelId = 'demo-menu-panel-v' + menuIdCounter;

  function close(): void {
    if (!open.value) {
      return;
    }
    // Ask before hiding: once the panel loses the `open` class it is
    // `display: none` and the browser has already dropped focus to <body>.
    if (panel.value !== null && panel.value.contains(document.activeElement)) {
      trigger.value?.focus();
    }
    open.value = false;
    panelStyle.value = undefined;
  }

  function openMenu(): void {
    const anchor = options.getAnchor?.() ?? trigger.value;
    if (anchor !== null && anchor !== undefined) {
      // The layout viewport, not the visual one: `position: fixed` resolves
      // against the former (the latter is the right ruler for *when* to close).
      const position = getMenuPosition(
        anchor.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        options.placement
      );
      panelStyle.value = {
        position: 'fixed',
        top: position.top !== undefined ? position.top + 'px' : undefined,
        bottom: position.bottom !== undefined ? position.bottom + 'px' : undefined,
        left: position.left !== undefined ? position.left + 'px' : undefined,
        right: position.right !== undefined ? position.right + 'px' : undefined,
        maxHeight: position.maxHeight + 'px',
        // The panel is usually a dropdown inside a button group, whose margins
        // would otherwise offset the coordinates just measured.
        margin: '0',
        zIndex: menuZIndex
      };
    }
    open.value = true;
  }

  function toggle(): void {
    if (open.value) {
      close();
    }
    else {
      openMenu();
    }
  }

  let stopDismiss: (() => void) | null = null;
  watch(open, isOpen => {
    if (isOpen) {
      stopDismiss = watchMenuDismiss({
        isInside: target => {
          if (target === null) {
            return false;
          }
          return (trigger.value !== null && trigger.value.contains(target))
            || (panel.value !== null && panel.value.contains(target));
        },
        onDismiss: close,
        getScrollableEl: () => panel.value
      });
    }
    else if (stopDismiss !== null) {
      stopDismiss();
      stopDismiss = null;
    }
  });
  onBeforeUnmount(() => {
    if (stopDismiss !== null) {
      stopDismiss();
      stopDismiss = null;
    }
  });

  return {
    open,
    toggle,
    close,
    trigger,
    panel,
    setTrigger: el => {
      trigger.value = el as HTMLButtonElement | null;
    },
    setPanel: el => {
      panel.value = el as HTMLElement | null;
    },
    triggerProps: computed(() => ({
      id: triggerId,
      'aria-expanded': open.value,
      'aria-controls': panelId,
      onClick: toggle
    })),
    panelProps: computed(() => ({
      id: panelId,
      'aria-labelledby': triggerId,
      style: panelStyle.value
    })),
    isPositioned: computed(() => open.value && panelStyle.value !== undefined)
  };
}
