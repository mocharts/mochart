import { createMenuController, demoText, menuKeepOpenClassName, notesMenuPlacement } from '@mochart/demo-common';

import { el, icon } from './dom';

// The "about this demo" button in each mode's navigation row: an info icon that
// opens the demo's `notes` (the detail kept out of its one-sentence gallery
// description) in a popover panel.
//
// Open/close, positioning, dismissal, focus and the disclosure ARIA come from
// demo-common's `createMenuController`; this component owns the panel's content
// and which demo it describes.
//
// Two representations of the same notes, because a phone has room for only one
// of them. Above the phone breakpoint the ⓘ button sits in the navigation row
// and opens the popover. Below it the whole row folds into an overflow menu —
// and the popover CANNOT come along: its panel would be a descendant of an
// element that menu hides with `display: none`, so it would be invisible while
// the menu was open and taken away the moment the menu closed. So the fold gets
// `menuItemEl` instead: a menu row that expands the same title and body inline,
// inside the panel that is already open. That panel is `overflow-y: auto` under
// a `max-height`, so a long note scrolls there rather than overrunning a screen
// that does not scroll (the longest in the gallery, `candlestick`, is a little
// over a thousand characters).
export interface NotesMenuProps {
  /** Demo title, shown as the panel heading. */
  title: string;
  /** The demo's notes; the trigger hides itself when there are none. */
  notes?: string;
}

export interface NotesMenuHandle {
  el: HTMLElement;
  /**
   * The phone fold's stand-in for the trigger/panel pair: a `.demo-menu-item`
   * button and the block it discloses, for the navigation row's overflow menu to
   * host. Deliberately NOT a child of `el` — it stays detached until the fold
   * hands it over, so it can never render in the bar.
   */
  menuItemEl: HTMLElement;
  /** False for a demo with no notes, where neither representation is offered. */
  hasNotes(): boolean;
  /** Hide the popover trigger while the fold is showing the disclosure instead. */
  setFolded(folded: boolean): void;
  /** Re-point at another demo (history navigation between demos). */
  setDemo(title: string, notes?: string): void;
  destroy(): void;
}

/** `aria-controls` has to point at an id, and ids have to be unique. */
let disclosureIdCounter = 0;

export function notesMenu(props: NotesMenuProps): NotesMenuHandle {
  // No `aria-haspopup`/`aria-expanded` here: the controller owns the disclosure
  // ARIA (and removes `aria-haspopup`, which announced a menu this is not).
  const trigger = el('button', {
    className: 'demo-btn demo-btn-secondary mochart-demo-notes-trigger',
    attrs: {
      type: 'button',
      title: demoText.demoNotes.trigger.tooltip,
      'aria-label': demoText.demoNotes.trigger.aria
    }
  }, [icon('circle-info', { size: 'lg', fixedWidth: true })]);

  const titleEl = el('span', { className: 'demo-menu-notes-title', text: props.title });
  const bodyEl = el('span', { className: 'demo-menu-notes-body', text: props.notes ?? '' });
  const menu = el('div', { className: 'demo-menu demo-menu-notes' }, [titleEl, bodyEl]);

  const root = el('div', { className: 'demo-btn-group mochart-demo-notes-menu' }, [trigger, menu]);

  const controller = createMenuController({
    trigger,
    panel: menu,
    placement: notesMenuPlacement
  });

  // ---------------------------------------------------------------------
  // the phone fold's inline disclosure
  // ---------------------------------------------------------------------

  disclosureIdCounter += 1;
  const disclosureId = 'demo-notes-disclosure-' + disclosureIdCounter;

  const menuTitleEl = el('span', { className: 'demo-menu-notes-title' });
  const menuBodyEl = el('span', { className: 'demo-menu-notes-body' });
  // `.demo-field` is the overflow panel's existing hook for a row that is not a
  // `.demo-btn` — the only thing that gives such a row the same inset the button
  // rows get from their own padding (see the rule beside it in demo.css). It
  // carries no layout of its own outside a form, so the title and body keep the
  // block flow their own classes give them and their text wraps as prose.
  const disclosureEl = el('div', { className: 'demo-field', id: disclosureId }, [menuTitleEl, menuBodyEl]);
  disclosureEl.hidden = true;

  // Inline rather than a stylesheet rule: `.demo-menu-item` is a flex row shared
  // by every menu in the demo, and this is the only one of them with a trailing
  // affordance to push to the far edge.
  const disclosureIcon = icon('chevron-down', { fixedWidth: true });
  disclosureIcon.setAttribute('style', 'margin-left: auto;');

  const disclosureButton = el('button', {
    className: 'demo-menu-item',
    attrs: {
      type: 'button',
      title: demoText.demoNotes.trigger.tooltip,
      'aria-expanded': 'false',
      'aria-controls': disclosureId
    }
  }, [
    icon('circle-info', { fixedWidth: true }), ' ',
    el('span', { text: demoText.demoNotes.trigger.aria }),
    disclosureIcon
  ]);

  // `.demo-menu-keep-open` on the pair, so the overflow menu's delegated close
  // handler leaves the panel open when the disclosure is toggled — otherwise the
  // note would be revealed and taken away again in the same tap.
  const menuItemEl = el('div', {
    className: 'mochart-demo-notes-item ' + menuKeepOpenClassName
  }, [disclosureButton, disclosureEl]);

  let expanded = false;

  function setExpanded(nextExpanded: boolean): void {
    expanded = nextExpanded;
    disclosureEl.hidden = !nextExpanded;
    disclosureButton.setAttribute('aria-expanded', String(nextExpanded));
    disclosureIcon.classList.toggle('fa-chevron-down', !nextExpanded);
    disclosureIcon.classList.toggle('fa-chevron-up', nextExpanded);
  }

  disclosureButton.addEventListener('click', () => setExpanded(!expanded));

  // ---------------------------------------------------------------------

  let folded = false;
  let currentNotes = props.notes;

  function render(title: string, notes?: string): void {
    currentNotes = notes;
    titleEl.textContent = title;
    bodyEl.textContent = notes ?? '';
    menuTitleEl.textContent = title;
    menuBodyEl.textContent = notes ?? '';
    // Hidden both when there is nothing to say and when the fold is showing the
    // disclosure instead — two ways into one note would be one too many.
    root.hidden = notes === undefined || folded;
  }

  render(props.title, props.notes);

  return {
    el: root,
    menuItemEl,
    hasNotes: () => currentNotes !== undefined,
    setFolded(nextFolded: boolean) {
      if (nextFolded === folded) {
        return;
      }
      folded = nextFolded;
      controller.close();
      setExpanded(false);
      root.hidden = currentNotes === undefined || folded;
    },
    setDemo(title: string, notes?: string) {
      controller.close();
      setExpanded(false);
      render(title, notes);
    },
    destroy() {
      controller.destroy();
    }
  };
}
