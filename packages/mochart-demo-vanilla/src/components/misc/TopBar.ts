// The bar across the top of every demo view: the site-root link, the back link
// to the gallery, the view's tab strip, the "about this demo" popover, the
// Single/Multi/Random mode switcher and the theme toggle.
//
// It was hand-written six times before this, and — the reason a builder is
// worth having rather than a copied block — the six copies were not the same
// markup. Single/Multi/Random put the mode switcher and the theme toggle in a
// second `.mochart-demo-nav-group`; Transition/Rotation/Sparkline have no
// switcher, no notes, sometimes no tabs, and hang the theme toggle straight off
// the row. Both shapes are reproduced exactly here, so the difference is one
// documented conditional instead of six files that have to be diffed to find it.
//
// Everything that varies is optional: a view with no `tabs` renders no tab
// strip, no `notes` renders no ⓘ button, no `modes` renders no switcher (and,
// with it, no second nav group).
//
// The phone fold
// --------------
// Below the phone breakpoint a bar with tabs, notes or a mode switcher keeps
// exactly one thing directly tappable — the tab strip, the only control here
// whose destination is the content under it — and MOVES everything else into a
// single `…` menu at the far end. A bar with none of those (rotation,
// sparkline) never folds: see `canFold` below. Moves,
// not copies: the very elements the bar built are reparented into the panel and
// back out again (the same contract as the control strips' folds, see
// OverflowMenu.ts), so no state is mirrored and no control has two identities.
//
// The one control that cannot be moved is the notes popover, whose panel would
// be hidden along with the menu it was nested in; it hands over an inline
// disclosure row instead (see NotesMenu.ts).

import { demoText, isPhoneViewport, navMenuPlacement, watchPhoneViewport } from '@mochart/demo-common';

import { el } from './dom';
import { backToDemosButton, modeSwitcher, siteRootButton, themeToggle } from './ModeSwitcher';
import type { ModeSwitcherProps } from './ModeSwitcher';
import { notesMenu } from './NotesMenu';
import type { NotesMenuProps } from './NotesMenu';
import { menuDivider, overflowMenu } from './OverflowMenu';
import type { MenuItem } from './OverflowMenu';

export interface TopBarProps {
  /** Undefined in a standalone build, where there is no docs site to go back to. */
  siteRootUrl?: string;
  onBackToDemos: () => void;
  /** The view's tab strip (`demoTabs`/`staticDemoTabs`), if it has one. */
  tabs?: HTMLElement;
  /** The demo the ⓘ popover describes. The standalone pages describe none. */
  notes?: NotesMenuProps;
  /** Omitted by the pages that are not one of the three switchable modes. */
  modes?: ModeSwitcherProps;
}

export interface TopBarHandle {
  el: HTMLElement;
  /** Re-point the notes at another demo (history navigation between demos). */
  setDemo(title: string, notes?: string): void;
  destroy(): void;
}

/** Drops the holes a missing site-root link (or tab strip, or notes) leaves. */
function present(nodes: readonly (Node | null)[]): Node[] {
  return nodes.filter((node): node is Node => node !== null);
}

export function topBar(props: TopBarProps): TopBarHandle {
  const notes = props.notes === undefined ? null : notesMenu(props.notes);
  // Note that the switcher subscribes to the viewport too, to drop Multi mode
  // from its own toolbar on a phone. The two subscriptions are independent in
  // either order: the switcher only ever replaces the children of its inner
  // `.demo-toolbar`, and the fold below only ever moves the
  // `.mochart-demo-mode-switcher` wrapper around that toolbar. Neither can
  // observe the other's work, so which of them runs first cannot matter.
  const modes = props.modes === undefined ? null : modeSwitcher(props.modes);
  const toggle = themeToggle();

  const siteRoot = siteRootButton(props.siteRootUrl);
  const backButton = backToDemosButton(props.onBackToDemos);
  const tabsEl = props.tabs ?? null;
  const notesEl = notes === null ? null : notes.el;

  const navItems = present([siteRoot, backButton, tabsEl, notesEl]);
  // What is left in the strip once the fold has run. The notes element stays put
  // rather than being detached — `setFolded` hides it, and a hidden flex item
  // draws neither a box nor a gap.
  const foldedNavItems = present([tabsEl, notesEl]);
  const navGroup = el('div', { className: 'mochart-demo-nav-group' }, navItems);

  // The trailing slot, and the one place the two shapes genuinely differ. With a
  // mode switcher it is a second nav group holding the switcher and the toggle;
  // without one the toggle is a direct child of the row, which is what the three
  // standalone pages have always rendered — an intermediate group of one would
  // add its own `gap` and move their toggle.
  const trailItems: Node[] = modes === null ? [toggle.el] : [modes.el, toggle.el];
  const trailGroup = modes === null
    ? null
    : el('div', { className: 'mochart-demo-nav-group' }, trailItems);
  const trailing = trailGroup === null ? toggle.el : trailGroup;

  // Heading over the mode rows: reparented into the menu, "Single / Random"
  // reads as two more verbs in an undifferentiated list (the strip's own
  // `Mode:` label is display:none'd at this width). Built once — like the
  // controller's divider cache — so setItems' identity bail-out holds.
  const modeSectionLabel = el('div', {
    className: 'demo-menu-section-label',
    text: demoText.modeSwitcher.menuSectionLabel
  });

  const overflowMenuHandle = overflowMenu({
    text: demoText.overflowMenu.nav,
    // Needs no `getAnchor`: the trigger IS the last thing in the row, unlike
    // the control strips, whose triggers sit mid-row.
    placement: navMenuPlacement
  });

  const container = el('div', { className: 'mochart-demo-tabs-container' }, [
    navGroup, trailing, overflowMenuHandle.el
  ]);

  /**
   * The menu's contents, in the order a thumb should meet them: what this demo
   * is, then where else to see it, then how it looks, then the two ways out.
   *
   * Each optional section carries its own trailing divider rather than the list
   * putting dividers between fixed slots — `setItems` drops nulls but keeps
   * dividers, so a demo without notes would otherwise open its menu with a rule
   * above the first row.
   */
  function menuItems(): MenuItem[] {
    // The about row drops its trailing divider when the mode section follows:
    // the section label draws its own rule above itself whenever it is not the
    // panel's first child (`.demo-menu-overflow > * + .demo-menu-section-label`),
    // and a divider right above that rule would draw two lines.
    const about: MenuItem[] = notes !== null && notes.hasNotes()
      ? (modes === null ? [notes.menuItemEl, menuDivider] : [notes.menuItemEl])
      : [];
    const modeSection: MenuItem[] = modes === null ? [] : [modeSectionLabel, modes.el, menuDivider];
    // `siteRoot` is null in a standalone build; it is last precisely so that a
    // missing one leaves no dangling divider behind it.
    return [...about, ...modeSection, toggle.el, menuDivider, backButton, siteRoot];
  }

  // Whether this bar folds at all. A bar folds when it has something the fold
  // exists to protect: notes or a mode switcher (the menu-worthy features), or
  // a tab strip (whose labels are what actually overflow a 320px row —
  // transition's `Chart | Transition Config` plus three icon buttons wraps the
  // bar to two rows at 320x568, measured at ~290px of ~274). Rotation and
  // sparkline have none of the three; their bar is just the back link and the
  // theme toggle, which fits at every width, so folding them produced the
  // degenerate case this gate removes — a row whose only content was a `…`
  // holding two rows, saving zero height.
  const canFold = props.notes !== undefined || props.modes !== undefined || props.tabs !== undefined;
  let isPhone = isPhoneViewport();
  // `null` so the first run always lays the row out, whichever side of the
  // breakpoint it starts on.
  let placedFolded: boolean | null = null;

  function placeControls(): void {
    const folded = isPhone && canFold;
    // First, always. On the way in, moving a control into the panel is what
    // detaches it from the strip, so the restores below see honest child lists;
    // on the way out, emptying the panel is what frees the controls to be
    // re-adopted.
    overflowMenuHandle.setItems(folded ? menuItems() : []);
    if (placedFolded !== folded) {
      placedFolded = folded;
      navGroup.replaceChildren(...(folded ? foldedNavItems : navItems));
      if (!folded && trailGroup !== null) {
        trailGroup.replaceChildren(...trailItems);
      }
      // The trailing slot leaves the row entirely while folded: an emptied nav
      // group would still draw the row's `gap` on both sides of a zero-width
      // box, and `justify-content: space-between` would spend the row's slack
      // around it.
      container.replaceChildren(...(folded ? [navGroup] : [navGroup, trailing]), overflowMenuHandle.el);
      if (notes !== null) {
        notes.setFolded(folded);
      }
    }
    // Gates the stylesheet's `flex-wrap: nowrap` / `min-width: 0` chain, which is
    // only safe while there is somewhere for the row's surplus to go. Read off
    // the trigger rather than off `isPhone`, so the class and the trigger that
    // justifies it cannot disagree.
    container.classList.toggle('demo-has-overflow', !overflowMenuHandle.el.hidden);
  }

  placeControls();
  const unwatchViewport = watchPhoneViewport(next => {
    isPhone = next;
    placeControls();
  });

  return {
    el: container,
    setDemo(title: string, nextNotes?: string) {
      if (notes !== null) {
        notes.setDemo(title, nextNotes);
        // A demo with no notes offers no About row, so the menu's contents — and
        // with them which divider sits where — depend on which demo is showing.
        placeControls();
      }
    },
    destroy() {
      unwatchViewport();
      overflowMenuHandle.destroy();
      if (notes !== null) {
        notes.destroy();
      }
      if (modes !== null) {
        modes.destroy();
      }
      toggle.destroy();
    }
  };
}
