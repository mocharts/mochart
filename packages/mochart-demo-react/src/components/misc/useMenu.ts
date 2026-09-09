import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

import { getMenuPosition, menuZIndex, watchMenuDismiss } from '@mochart/demo-common';
import type { MenuPlacement } from '@mochart/demo-common';

// The react half of demo-common's menu machinery. The imperative ports use
// `createMenuController`; a react component owns its own open state, so this
// hook takes only the two shared layers — `getMenuPosition` (where the fixed
// panel goes) and `watchMenuDismiss` (when it closes) — and re-expresses the
// controller's remaining behaviour in react idiom:
//
// - the panel is positioned in a layout effect BEFORE it gets the `open`
//   class, so it is never painted at coordinates carried over from last time;
// - dismissal (outside pointerdown, Escape, scroll outside the panel, resize,
//   visual-viewport resize) is subscribed only while open;
// - closing with focus inside the panel hands focus back to the trigger, so a
//   keyboard user is not dumped at the top of the document;
// - the trigger/panel pair gets disclosure ARIA (`aria-expanded` +
//   `aria-controls` / `aria-labelledby`) — these are disclosures, not
//   `role="menu"` menus, for the reasons in demo-common/src/menu.ts.

export interface UseMenuOptions {
  placement?: MenuPlacement;
  /**
   * Measure from something other than the trigger — e.g. a whole controls row,
   * when the trigger is not the last thing in it and `align: 'end'` must reach
   * the row's true right edge.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Trigger id override; omit and the hook mints a unique one per instance. */
  triggerId?: string;
}

export interface MenuState {
  open: boolean;
  // Declared as properties, not method shorthands: these are `useCallback`
  // arrows with no `this`, and components destructure them off the returned
  // object. Method shorthand would promise a `this` binding that does not
  // exist — which is what `@typescript-eslint/unbound-method` flags.
  toggle: () => void;
  close: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  /** Spread onto the trigger `<button>`. */
  triggerProps: {
    id: string;
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
  };
  /** Spread onto the panel element. `style` is undefined until positioned. */
  panelProps: {
    id: string;
    'aria-labelledby': string;
    style: CSSProperties | undefined;
  };
  /** True once the panel is positioned — append the `open` class on this. */
  isPositioned: boolean;
}

export function useMenu(options: UseMenuOptions = {}): MenuState {
  const { triggerId } = options;

  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Options are object literals at every call site, so they change identity on
  // each render; the effects below read them through a ref instead of listing
  // them as dependencies, which would tear the menu down on every keystroke.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const autoId = useId();
  const resolvedTriggerId = triggerId ?? autoId + '-trigger';
  const panelId = autoId + '-panel';

  const close = useCallback(() => {
    // Ask before hiding: once the panel loses the `open` class it is
    // `display: none` and the browser has already dropped focus to <body>.
    const panel = panelRef.current;
    if (panel !== null && panel.contains(document.activeElement)) {
      triggerRef.current?.focus();
    }
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen(previous => {
      if (previous) {
        const panel = panelRef.current;
        if (panel !== null && panel.contains(document.activeElement)) {
          triggerRef.current?.focus();
        }
      }
      return !previous;
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(undefined);
      return;
    }
    const anchor = optionsRef.current.anchorRef?.current ?? triggerRef.current;
    if (anchor === null) {
      return;
    }
    // The layout viewport, not the visual one: `position: fixed` resolves
    // against the former (the latter is the right ruler for *when* to close).
    const position = getMenuPosition(
      anchor.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      optionsRef.current.placement
    );
    setPanelStyle({
      position: 'fixed',
      top: position.top,
      bottom: position.bottom,
      left: position.left,
      right: position.right,
      maxHeight: position.maxHeight,
      // The panel is usually a dropdown inside a button group, whose margins
      // would otherwise offset the coordinates just measured.
      margin: 0,
      zIndex: menuZIndex
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    return watchMenuDismiss({
      isInside: target => {
        if (target === null) {
          return false;
        }
        const trigger = triggerRef.current;
        const panel = panelRef.current;
        return (trigger !== null && trigger.contains(target))
          || (panel !== null && panel.contains(target));
      },
      onDismiss: close,
      getScrollableEl: () => panelRef.current
    });
  }, [open, close]);

  return {
    open,
    toggle,
    close,
    triggerRef,
    panelRef,
    triggerProps: {
      id: resolvedTriggerId,
      'aria-expanded': open,
      'aria-controls': panelId,
      onClick: toggle
    },
    panelProps: {
      id: panelId,
      'aria-labelledby': resolvedTriggerId,
      style: panelStyle
    },
    isPositioned: open && panelStyle !== undefined
  };
}
