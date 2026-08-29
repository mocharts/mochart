import { untrack } from 'svelte';

import { getMenuPosition, menuZIndex, watchMenuDismiss } from '@mochart/demo-common';
import type { MenuPlacement } from '@mochart/demo-common';

// The svelte half of demo-common's menu machinery — the runes counterpart of
// the react port's useMenu. The imperative ports use `createMenuController`; a
// svelte component owns its own open state, so this takes only the two shared
// layers — `getMenuPosition` (where the fixed panel goes) and
// `watchMenuDismiss` (when it closes) — and re-expresses the controller's
// remaining behaviour:
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
// Construct in a component's init (`const menu = new Menu({ … })`) — the
// dismissal `$effect` needs the component's effect context. Wire the elements
// with `bind:this={menu.trigger}` / `bind:this={menu.panel}` and spread
// `{...menu.triggerProps}` / `{...menu.panelProps}`.

export interface MenuOptions {
  placement?: MenuPlacement;
  /**
   * Measure from something other than the trigger — e.g. a whole controls row,
   * when the trigger is not the last thing in it and `align: 'end'` must reach
   * the row's true right edge.
   */
  getAnchor?: () => HTMLElement | null;
  /** Explicit trigger id; omit and a unique one is minted. */
  triggerId?: string;
}

let menuIdCounter = 0;

export class Menu {
  open = $state(false);
  trigger = $state<HTMLButtonElement | null>(null);
  panel = $state<HTMLElement | null>(null);

  #style = $state<string | undefined>(undefined);
  #options: MenuOptions;
  #triggerId: string;
  #panelId: string;

  constructor(options: MenuOptions = {}) {
    this.#options = options;
    menuIdCounter += 1;
    this.#triggerId = options.triggerId ?? 'demo-menu-trigger-s' + menuIdCounter;
    this.#panelId = 'demo-menu-panel-s' + menuIdCounter;

    $effect(() => {
      if (!this.open) {
        return;
      }
      return watchMenuDismiss({
        isInside: target => {
          if (target === null) {
            return false;
          }
          return (this.trigger !== null && this.trigger.contains(target))
            || (this.panel !== null && this.panel.contains(target));
        },
        onDismiss: () => this.close(),
        getScrollableEl: () => this.panel
      });
    });
  }

  toggle = (): void => {
    if (this.open) {
      this.close();
    }
    else {
      this.#openMenu();
    }
  };

  /**
   * `untrack`, and it is required — this is the one method components call
   * from inside an `$effect` (NotesMenu closes the popover when the demo
   * changes under it; ExportShareMenu and OverflowMenu close on `disabled` /
   * `active`). `open`, `panel` and `trigger` are all `$state`, so *reading*
   * them here would register them as dependencies of the CALLER's effect —
   * and an effect that depends on `open` and calls `close()` is a trap that
   * springs the moment the menu opens: the write re-runs the effect, which
   * closes the menu again before it is ever painted. That is exactly what
   * broke the desktop notes popover once this class replaced NotesMenu's own
   * write-only `close()`. Only the reads are hidden; the writes below still
   * notify normally.
   */
  close = (): void => {
    untrack(() => {
      if (!this.open) {
        return;
      }
      // Ask before hiding: once the panel loses the `open` class it is
      // `display: none` and the browser has already dropped focus to <body>.
      if (this.panel !== null && this.panel.contains(document.activeElement)) {
        this.trigger?.focus();
      }
      this.open = false;
      this.#style = undefined;
    });
  };

  #openMenu(): void {
    const anchor = this.#options.getAnchor?.() ?? this.trigger;
    if (anchor !== null && anchor !== undefined) {
      // The layout viewport, not the visual one: `position: fixed` resolves
      // against the former (the latter is the right ruler for *when* to close).
      const position = getMenuPosition(
        anchor.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        this.#options.placement
      );
      const edges = [
        position.top !== undefined ? `top: ${position.top}px;` : '',
        position.bottom !== undefined ? `bottom: ${position.bottom}px;` : '',
        position.left !== undefined ? `left: ${position.left}px;` : '',
        position.right !== undefined ? `right: ${position.right}px;` : ''
      ].join(' ');
      // `margin: 0` because the panel is usually a dropdown inside a button
      // group, whose margins would otherwise offset the measured coordinates.
      this.#style = `position: fixed; ${edges} max-height: ${position.maxHeight}px; margin: 0; z-index: ${menuZIndex};`;
    }
    this.open = true;
  }

  /** Spread onto the trigger `<button>`. */
  get triggerProps() {
    return {
      id: this.#triggerId,
      'aria-expanded': this.open,
      'aria-controls': this.#panelId,
      onclick: this.toggle
    };
  }

  /** Spread onto the panel element. `style` is undefined until positioned. */
  get panelProps() {
    return {
      id: this.#panelId,
      'aria-labelledby': this.#triggerId,
      style: this.#style
    };
  }

  /** True once the panel is positioned — append the `open` class on this. */
  get isPositioned(): boolean {
    return this.open && this.#style !== undefined;
  }
}
