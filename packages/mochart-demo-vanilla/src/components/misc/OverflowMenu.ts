import { createMenuController, isMenuDismissingClick } from '@mochart/demo-common';
import type { MenuPlacement } from '@mochart/demo-common';

import { el, icon, withPreservedFocus } from './dom';

// The phone fold's container: a single `…` trigger whose panel HOSTS the
// controls that did not fit in the strip beside it.
//
// Hosts, not mirrors. The caller hands `setItems` the very DOM nodes it already
// built for the strip, and this moves them into the panel; unfolding moves them
// back. That is the whole design, and it is what makes the fold nearly free:
// the caller's existing `setDisabled` / `setPressed` / `setContent` calls keep
// pointing at the same elements, so a button disabled in the strip is still
// disabled in the menu with no state mirroring, no duplicate `id`s, and no
// second accessible name for a screen reader to read out twice.
//
// Open/close, the fixed-position arithmetic, dismissal, focus and the
// disclosure ARIA all come from demo-common's `createMenuController` — the same
// machinery the export/share dropdown uses, and for the same reasons (the
// control strips clip an absolutely-positioned panel, and the chart's
// interaction rect swallows clicks through anything stacked below it).
//
// Looks are entirely `css/demo.css`'s job: `.demo-menu-overflow` restyles the
// hosted `.demo-btn`s into full-width menu rows *by context*, so nothing here
// swaps classes on the way in and an unfold cannot leave a stale one behind.
//
// Callers that fold LOOSE buttons (rather than one of the strip's existing
// groups) give them a menu-side home: a cached `.demo-btn-group`. A group,
// because that is the class `.demo-menu-overflow` restyles into a full-width
// column — a loose button wrapper span dropped straight into the panel
// would lay out inline. Cached, because a wrapper minted per call is never
// identical to the last one and would defeat `setItems`' bail-out exactly the
// way a freshly created divider would (see the divider cache below).

/**
 * Placeholder for a rule between two sections of the menu. Resolved to a
 * `.demo-menu-divider` element by `setItems` — a symbol rather than a node so
 * callers can describe the list declaratively without minting elements (see
 * the divider cache below for why minting them would be actively harmful).
 */
export const menuDivider: unique symbol = Symbol('demo-menu-divider');

export type MenuItem = Node | typeof menuDivider | null | undefined;

export interface OverflowMenuProps {
  /** Trigger copy. Lives in demo-common's `demoText.overflowMenu`. */
  text: { tooltip: string; aria: string };
  placement?: MenuPlacement;
  /**
   * Element to measure the panel against, when that is not the trigger itself.
   *
   * `align: 'end'` lines the panel's right edge up with the anchor's. If the
   * trigger is not the last thing in its row — the single-mode strip puts the
   * export/share trigger after it — measuring from the trigger leaves the panel
   * short of the row's end by exactly the width of whatever follows, and a panel
   * wider than the space that remains hangs off the opposite edge of the screen.
   * Passing the whole row fixes the panel to the edge the eye expects.
   */
  getAnchor?: () => HTMLElement;
  /** Extra classes on the wrapper, for callers that need to target it. */
  className?: string;
  /** Font Awesome solid icon name for the trigger. */
  iconName?: string;
}

export interface OverflowMenuHandle {
  el: HTMLElement;
  triggerEl: HTMLElement;
  panelEl: HTMLElement;
  /**
   * Move `items` into the panel, in order. An empty list hides the whole
   * wrapper, so a layout with nothing folded renders no trigger at all.
   */
  setItems(items: readonly MenuItem[]): void;
  setDisabled(disabled: boolean): void;
  close(): void;
  destroy(): void;
}

/** No caret: `.demo-menu-trigger` draws one, and the ellipsis already says "more". */
const triggerClassName = 'demo-btn demo-btn-secondary';

export function overflowMenu(props: OverflowMenuProps): OverflowMenuHandle {
  const { text, placement, getAnchor, className, iconName = 'ellipsis' } = props;

  // No `aria-haspopup`/`aria-expanded` here: the controller wires the
  // disclosure ARIA itself.
  const trigger = el('button', {
    className: triggerClassName,
    attrs: { type: 'button', title: text.tooltip, 'aria-label': text.aria }
  }, [icon(iconName, { size: 'lg', fixedWidth: true })]);

  const panel = el('div', { className: 'demo-menu demo-menu-overflow' });

  const root = el('div', {
    className: 'demo-btn-group demo-overflow-menu' + (className === undefined ? '' : ' ' + className)
  }, [trigger, panel]);
  // Nothing is folded until the caller says so, and an empty trigger slot in a
  // desktop strip would be a visible regression.
  root.hidden = true;

  const controller = createMenuController({ trigger, panel, placement, getAnchor });

  // One divider element per slot, reused forever.
  //
  // `setItems` runs on every `sync()`, which for the single-mode strip means
  // every keystroke in the group input, and it bails out when the resolved node
  // list is identical to the one already applied. A freshly-created divider is
  // never identical to the last one, so minting them per call would defeat that
  // bail-out entirely and re-insert every row of the menu on each keystroke —
  // blurring whatever had focus inside it.
  const dividers = new Map<number, HTMLElement>();

  function resolveDivider(slot: number): HTMLElement {
    let divider = dividers.get(slot);
    if (divider === undefined) {
      divider = el('div', { className: 'demo-menu-divider' });
      dividers.set(slot, divider);
    }
    return divider;
  }

  let appliedItems: Node[] = [];

  function isSameAsApplied(nodes: readonly Node[]): boolean {
    if (nodes.length !== appliedItems.length) {
      return false;
    }
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] !== appliedItems[i]) {
        return false;
      }
    }
    return true;
  }

  function setItems(items: readonly MenuItem[]): void {
    const nodes: Node[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === null || item === undefined) {
        continue;
      }
      nodes.push(item === menuDivider ? resolveDivider(i) : item);
    }
    // `replaceChildren` with an identical list is not a no-op: it detaches and
    // re-inserts every node, which blurs any focused descendant and forces a
    // layout. See the divider cache above.
    if (isSameAsApplied(nodes)) {
      return;
    }
    appliedItems = nodes;
    // …and when the list HAS changed, the same detach still drops focus to
    // <body> — even for a node that is put straight back. Not a corner case:
    // pressing Edit Series from inside this panel re-runs the fold with a
    // different list, and the button that was pressed is in both.
    withPreservedFocus(() => panel.replaceChildren(...nodes));
    root.hidden = nodes.length === 0;
    if (nodes.length === 0) {
      controller.close();
    }
  }

  // Closing on activation, in one delegated listener rather than by wrapping the
  // hosted controls: the panel does not own them and must not touch their own
  // click handlers. Bubble phase — not capture — so this runs *after* the
  // target's handler, i.e. the button has already done its work by the time the
  // panel disappears out from under it.
  function onPanelClick(event: MouseEvent): void {
    if (isMenuDismissingClick(event.target, panel)) {
      controller.close();
    }
  }

  panel.addEventListener('click', onPanelClick);

  return {
    el: root,
    triggerEl: trigger,
    panelEl: panel,
    setItems,
    setDisabled(disabled: boolean) {
      trigger.disabled = disabled;
      // A disabled button fires no `click`, so it cannot be opened — but a menu
      // already open when its trigger is disabled would be stranded with no way
      // back to it.
      if (disabled) {
        controller.close();
      }
    },
    close() {
      controller.close();
    },
    destroy() {
      panel.removeEventListener('click', onPanelClick);
      controller.destroy();
    }
  };
}
