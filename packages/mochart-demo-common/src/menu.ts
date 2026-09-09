// The popover machinery shared by every demo menu: the export/share dropdown,
// the demo-notes panel, and the overflow menus the narrow layout collapses its
// controls into. All six framework ports had grown their own copy of it.
//
// Why any of this exists: the demo shell nests panes that use
// `overflow: hidden`, which clips a normally-positioned dropdown, and the chart
// paints a transparent interaction rect that swallows clicks landing on
// anything stacked below it. So a menu is positioned `fixed` at coordinates
// measured from its trigger, at a z-index above the chart. That escapes both
// problems, at the price of doing by hand everything `position: absolute` would
// have done for free — the arithmetic, the "the world moved" invalidation, and
// the accessibility wiring that comes with detaching a panel from its trigger.
//
// Three layers, because the ports do not all want the same amount of it:
//
//   1. `getMenuPosition` — pure geometry over plain numbers. No DOM, no
//      globals, so it is testable and safe to call during SSR.
//   2. `watchMenuDismiss` — the outside-click / Escape / the-viewport-moved
//      listeners, as one subscription with one unsubscribe.
//   3. `createMenuController` — the whole imperative open/close dance against
//      a trigger and a panel element.
//
// The reactive ports (react, svelte, vue) own their own DOM and their own
// open state, so they take layers 1 and 2 only; the imperative ports (vanilla,
// lit, angular) take all three.

/** 'bottom' opens downward from the trigger; 'top' opens upward. */
export type MenuSide = 'top' | 'bottom';

/** 'start' left-aligns the panel with the trigger; 'end' right-aligns it. */
export type MenuAlign = 'start' | 'end';

/**
 * Structurally a `DOMRect`, so callers can hand one straight from
 * `getBoundingClientRect()` while tests hand a plain object literal — the
 * geometry never needs the rest of a real rect.
 */
export type MenuAnchorRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>;

/** Viewport box the panel must stay inside, in the same coordinates as the anchor. */
export interface MenuViewport {
  width: number;
  height: number;
}

export interface MenuPlacement {
  /** Which way the panel opens. Default 'bottom'. */
  side?: MenuSide;
  /** Which edge the panel lines up with. Default 'start'. */
  align?: MenuAlign;
  /** Gap from the trigger, and the minimum gap from the viewport edge. Default 4. */
  gap?: number;
  /**
   * The panel's CSS width. Only `align: 'start'` needs it, and only to clamp:
   * left-anchoring a panel wider than the room to the right of the trigger
   * would push its far edge off screen, and the panel is `display: none` until
   * it opens, so measuring it before opening reads 0 and the clamp silently
   * does nothing. Take the number from the stylesheet instead.
   */
  width?: number;
  /** Width the viewport keeps for itself when clamping a wide panel. Default 32. */
  viewportMargin?: number;
}

// The demo shell has exactly three menu placements; named here so the numbers live once.

/** The navigation row's overflow trigger: below the bar, right-aligned with the row-ending trigger. */
export const navMenuPlacement: MenuPlacement = { side: 'bottom', align: 'end', gap: 6 };

/** Every menu hanging off a controls strip (export/share, overflow triggers): upward from the bottom-of-pane strip, right-aligned. */
export const controlsMenuPlacement: MenuPlacement = { side: 'top', align: 'end', gap: 4 };

/** The "about this demo" popover; `width` mirrors `.demo-menu-notes` in demo.css (a `display: none` panel measures 0) — keep the two in step. */
export const notesMenuPlacement: MenuPlacement = { side: 'bottom', align: 'start', gap: 6, width: 340, viewportMargin: 32 };

/** Marks a subtree inside a menu panel whose clicks must NOT dismiss it (a stepper beside a number input, say). */
export const menuKeepOpenClassName = 'demo-menu-keep-open';

/** Whether a click inside a menu panel should close it: only activating a button or link outside a keep-open subtree; `panel` rejects actionable ancestors outside it. */
export function isMenuDismissingClick(target: EventTarget | null, panel?: HTMLElement | null): boolean {
  const element = target instanceof Element ? target : null;
  const actionable = element === null ? null : element.closest('button, a');
  if (actionable === null) {
    return false;
  }
  if (panel !== undefined && panel !== null && !panel.contains(actionable)) {
    return false;
  }
  return actionable.closest('.' + menuKeepOpenClassName) === null;
}

/**
 * Only the two edges the placement anchors from are set; the other two are left
 * `undefined` so the caller can skip writing them and let CSS keep `auto`.
 */
export interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** Cap so a tall menu cannot overshoot the viewport edge it opens away from. */
  maxHeight: number;
}

/** Gap from the trigger and the viewport edge when the caller has no opinion. */
const defaultGap = 4;
const defaultViewportMargin = 32;

/**
 * Above the chart and its interaction rect. Exported for the reactive ports,
 * which write their panel styles from render rather than through
 * `createMenuController`; `--demo-menu-z` in demo.css names the same number.
 */
export const menuZIndex = 1080;

/**
 * Floor for `maxHeight`. A trigger pinned against the edge it opens away from
 * leaves no room at all, and both a negative and a two-pixel `max-height` are
 * useless — a panel that overflows a little and scrolls is the better failure.
 */
const minMenuHeight = 96;

/**
 * Where to pin a fixed-position menu panel, given its trigger's rect and the
 * viewport it has to live in.
 *
 * `align: 'end'` deliberately needs no width: anchoring from the right lets the
 * panel size itself when it opens, which is the only way a `display: none`
 * panel gets an honest width (see `MenuPlacement.width`).
 */
export function getMenuPosition(
  anchor: MenuAnchorRect,
  viewport: MenuViewport,
  placement: MenuPlacement = {}
): MenuPosition {
  const {
    side = 'bottom',
    align = 'start',
    gap = defaultGap,
    width,
    viewportMargin = defaultViewportMargin
  } = placement;

  // Each side pins the edge nearest the trigger and spends whatever is left
  // between the panel and the far edge of the viewport on `max-height`.
  const vertical = side === 'top'
    ? { bottom: viewport.height - anchor.top + gap, maxHeight: anchor.top - gap - gap }
    : { top: anchor.bottom + gap, maxHeight: viewport.height - (anchor.bottom + gap) - gap };

  const horizontal = align === 'end'
    // `Math.max` only bites when the trigger sits flush against (or past) the
    // right edge, where a raw offset of 0 would leave the panel touching it.
    ? { right: Math.max(gap, viewport.width - anchor.right) }
    // Clamp the assumed width to the viewport first, so a panel wider than a
    // phone screen still lands at the left gap rather than off to the left.
    : { left: Math.max(gap, Math.min(anchor.left, viewport.width - Math.min(width ?? 0, viewport.width - viewportMargin) - gap)) };

  return { ...vertical, ...horizontal, maxHeight: Math.max(minMenuHeight, vertical.maxHeight) };
}

export interface MenuDismissOptions {
  /** True for anything that counts as "in the menu": the trigger, the panel, any satellite. */
  isInside: (target: Node | null) => boolean;
  onDismiss: () => void;
  /** The element that may itself scroll; scrolls inside it must NOT dismiss. */
  getScrollableEl?: () => HTMLElement | null;
}

/** Event targets are `EventTarget`s; only the ones in the tree can be contained. */
function toNode(target: EventTarget | null): Node | null {
  return target instanceof Node ? target : null;
}

/**
 * Subscribes the four things that should close an open menu — a press outside
 * it, Escape, a scroll, and a viewport resize — and returns the unsubscribe.
 *
 * A fixed panel is pinned to coordinates measured once, so anything that moves
 * the trigger or the viewport under it invalidates those coordinates; the demos
 * close rather than reposition, which is both cheaper and less startling.
 */
export function watchMenuDismiss(options: MenuDismissOptions): () => void {
  // Nothing to listen to during SSR/prerender, and no menu can be open there.
  if (typeof window === 'undefined') {
    return () => {};
  }

  const { isInside, onDismiss, getScrollableEl } = options;

  // `pointerdown`, not `mousedown`: it fires for every pointer type before any
  // synthesized mouse events, so tap dismissal does not depend on the compat
  // mouse sequence, which a page-level touch handler may cancel. Capture phase
  // for the same family of reasons: a handler in between that stops propagation
  // must not be able to hold the menu open either.
  function onPointerDown(event: PointerEvent): void {
    if (!isInside(toNode(event.target))) {
      onDismiss();
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onDismiss();
    }
  }

  // `scroll` does not bubble, so this has to be a capture-phase listener on
  // window to hear scrolls in nested scrollers at all. That catches the panel's
  // own scrolling too, and the overflow menus are `overflow-y: auto` — without
  // this guard, scrolling a menu would close it mid-gesture.
  function onScroll(event: Event): void {
    const scrollable = getScrollableEl === undefined ? null : getScrollableEl();
    const target = toNode(event.target);
    if (scrollable !== null && target !== null && scrollable.contains(target)) {
      return;
    }
    onDismiss();
  }

  function onResize(): void {
    onDismiss();
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);

  // On iOS the on-screen keyboard (and pinch-zoom) resizes the visual viewport
  // only, leaving `window.resize` silent and a fixed menu stranded over
  // whatever moved beneath it. The visual viewport reports those.
  const visualViewport = window.visualViewport;
  if (visualViewport !== null && visualViewport !== undefined) {
    visualViewport.addEventListener('resize', onResize);
  }

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (visualViewport !== null && visualViewport !== undefined) {
      visualViewport.removeEventListener('resize', onResize);
    }
  };
}

export interface MenuControllerOptions {
  /** The button that opens the menu. Gets the `active` class and the disclosure ARIA. */
  trigger: HTMLElement;
  /** The panel. Gets the `open` class and the inline fixed-position styles. */
  panel: HTMLElement;
  /** Measure from something other than the trigger, e.g. a whole controls row. */
  getAnchor?: () => HTMLElement;
  /**
   * Extra elements that count as "inside" for outside-press dismissal, for
   * panels whose contents are not all descendants — a reparented control, or a
   * second trigger. Called per event, so it may return elements that come and go.
   */
  getExtraInside?: () => readonly (HTMLElement | null | undefined)[];
  placement?: MenuPlacement;
  zIndex?: number;
  onOpenChange?: (open: boolean) => void;
  /** Return focus to the trigger when the menu closes with focus inside it. Default true. */
  restoreFocus?: boolean;
  /**
   * Whether the controller binds the trigger's `click` to `toggle()`. Default
   * true, since every port wants exactly that. Ports that bind the click in a
   * template instead (Angular) pass false, or the two handlers cancel out and
   * the menu never appears to open.
   */
  bindTrigger?: boolean;
}

export interface MenuController {
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  /** Closes, unbinds, and removes the ARIA attributes the controller added. */
  destroy(): void;
}

let menuIdCounter = 0;

/** Elements need ids to point `aria-controls`/`aria-labelledby` at each other. */
function ensureId(element: HTMLElement, prefix: string): string {
  if (element.id === '') {
    menuIdCounter += 1;
    element.id = prefix + '-' + menuIdCounter;
  }
  return element.id;
}

/**
 * Drives one menu: open/close state, the fixed-position arithmetic, dismissal,
 * focus and ARIA.
 *
 * ARIA note — these are **disclosures, not menus**. The trigger gets
 * `aria-expanded` and `aria-controls`; the panel gets `aria-labelledby` back.
 * No `role="menu"`, no `menuitem`, no `aria-haspopup` (which the ports used to
 * set, promising a keyboard menu with roving tabindex that the markup never
 * implemented). The promise would be unkeepable anyway: these panels hold a
 * link, a row of buttons and a number input, none of which are valid
 * `menuitem`s, and `aria-pressed` — which several of the toggles rely on — is
 * invalid on `role="menuitem"`. A disclosure describes what is actually there.
 */
export function createMenuController(options: MenuControllerOptions): MenuController {
  const {
    trigger, panel, getAnchor, getExtraInside, placement,
    zIndex = menuZIndex, onOpenChange, restoreFocus = true, bindTrigger = true
  } = options;

  let open = false;
  let stopDismiss: (() => void) | null = null;

  const panelId = ensureId(panel, 'demo-menu-panel');
  const triggerId = ensureId(trigger, 'demo-menu-trigger');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);
  // Drop any inherited `aria-haspopup` from the port's markup: leaving it would
  // re-announce this disclosure as a menu it is not (see the note above).
  trigger.removeAttribute('aria-haspopup');
  panel.setAttribute('aria-labelledby', triggerId);

  function positionPanel(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const anchorEl = getAnchor === undefined ? trigger : getAnchor();
    // `position: fixed` resolves against the layout viewport, so that is the
    // box to measure against — the visual viewport is the right ruler for
    // *when* to close (see watchMenuDismiss) but the wrong one for *where*.
    const position = getMenuPosition(
      anchorEl.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      placement
    );
    const style = panel.style;
    style.position = 'fixed';
    if (position.top !== undefined) {
      style.top = position.top + 'px';
    }
    if (position.bottom !== undefined) {
      style.bottom = position.bottom + 'px';
    }
    if (position.left !== undefined) {
      style.left = position.left + 'px';
    }
    if (position.right !== undefined) {
      style.right = position.right + 'px';
    }
    style.maxHeight = position.maxHeight + 'px';
    // The panel is usually a dropdown inside a button group, whose margins
    // would otherwise offset the coordinates just measured.
    style.margin = '0';
    style.zIndex = String(zIndex);
  }

  function isInside(target: Node | null): boolean {
    if (target === null) {
      return false;
    }
    if (trigger.contains(target) || panel.contains(target)) {
      return true;
    }
    const extras = getExtraInside === undefined ? [] : getExtraInside();
    return extras.some(element => element !== null && element !== undefined && element.contains(target));
  }

  function openMenu(): void {
    if (open) {
      return;
    }
    open = true;
    // Position before the `open` class lands: the panel is `display: none`
    // until then, so styling it first means it is never painted at whatever
    // coordinates it happened to carry from last time.
    positionPanel();
    panel.classList.add('open');
    trigger.classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
    stopDismiss = watchMenuDismiss({ isInside, onDismiss: closeMenu, getScrollableEl: () => panel });
    if (onOpenChange !== undefined) {
      onOpenChange(true);
    }
  }

  function closeMenu(): void {
    if (!open) {
      return;
    }
    open = false;
    if (stopDismiss !== null) {
      stopDismiss();
      stopDismiss = null;
    }
    // Ask before hiding: once the panel is `display: none` the browser has
    // already dropped focus to <body>, and there is nothing left to detect.
    const hadFocus = restoreFocus && panel.contains(document.activeElement);
    panel.classList.remove('open');
    trigger.classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
    // Drop the whole inline style rather than unset each edge: the next open
    // may use a different placement, and a stale `right` would fight its `left`.
    panel.removeAttribute('style');
    // A disclosure is not a modal, so focus is never trapped — but losing it to
    // <body> because the thing holding it was hidden strands keyboard users
    // back at the top of the document. Hand it back to the trigger they used.
    if (hadFocus) {
      trigger.focus();
    }
    if (onOpenChange !== undefined) {
      onOpenChange(false);
    }
  }

  function toggle(): void {
    if (open) {
      closeMenu();
    }
    else {
      openMenu();
    }
  }

  function onTriggerClick(): void {
    toggle();
  }

  if (bindTrigger) {
    trigger.addEventListener('click', onTriggerClick);
  }

  return {
    isOpen: () => open,
    open: openMenu,
    close: closeMenu,
    toggle,
    destroy() {
      closeMenu();
      if (bindTrigger) {
        trigger.removeEventListener('click', onTriggerClick);
      }
      trigger.removeAttribute('aria-expanded');
      trigger.removeAttribute('aria-controls');
      panel.removeAttribute('aria-labelledby');
    }
  };
}
