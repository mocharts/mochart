import { useEffect, useId, useState } from 'react';
import Icon from './Icon';

import { demoText, menuKeepOpenClassName, notesMenuPlacement } from '@mochart/demo-common';

import { useMenu } from './useMenu';

// The "about this demo" notes, in the two shapes a viewport can need.
//
// `NotesMenu` is the desktop shape: an info button in the navigation row that
// opens the notes in a popover panel (positioning, dismissal, focus return and
// the disclosure ARIA come from `useMenu`). `NotesMenuItem` is the phone
// shape: the navigation row folds into an overflow menu, and a popover CANNOT
// come along — its panel would be a descendant of an element the menu hides
// with `display: none` — so the notes render instead as a disclosure row
// expanding inline inside the panel that is already open. TopBar renders
// exactly one of the two.
interface Props {
  /** Demo title, shown as the panel heading. */
  title: string;
  /** The demo's notes; nothing renders when there are none. */
  notes?: string;
}

export default function NotesMenu({ title, notes }: Props) {
  const menu = useMenu({ placement: notesMenuPlacement });
  const { close } = menu;

  // Close whenever the demo changes under us (history navigation).
  useEffect(() => close(), [title, notes, close]);

  if (notes === undefined) {
    return null;
  }

  return (
    <div className="demo-btn-group mochart-demo-notes-menu">
      <button type="button" ref={menu.triggerRef} {...menu.triggerProps}
        className={'demo-btn demo-btn-secondary mochart-demo-notes-trigger' + (menu.open ? ' active' : '')}
        title={demoText.demoNotes.trigger.tooltip} aria-label={demoText.demoNotes.trigger.aria}>
        <Icon size="lg" fixedWidth={true} name="circle-info" />
      </button>
      <div ref={menu.panelRef} {...menu.panelProps}
        className={'demo-menu demo-menu-notes' + (menu.isPositioned ? ' open' : '')}>
        <span className="demo-menu-notes-title">{title}</span>
        <span className="demo-menu-notes-body">{notes}</span>
      </div>
    </div>
  );
}

/**
 * The fold's stand-in for the popover: a `.demo-menu-item` row that expands
 * the same title and body inline, inside the navigation row's overflow panel.
 * `.demo-menu-keep-open` so revealing the note does not also dismiss the menu
 * it lives in; the panel's own `overflow-y: auto` under its `max-height` is
 * what makes a long note readable on a screen that does not scroll.
 */
export function NotesMenuItem({ title, notes }: Props) {
  const [expanded, setExpanded] = useState(false);
  const disclosureId = useId();

  // A different demo's notes start collapsed again (history navigation).
  useEffect(() => setExpanded(false), [title, notes]);

  if (notes === undefined) {
    return null;
  }

  return (
    <div className={'mochart-demo-notes-item ' + menuKeepOpenClassName}>
      <button type="button" className="demo-menu-item"
        title={demoText.demoNotes.trigger.tooltip}
        aria-expanded={expanded} aria-controls={disclosureId}
        onClick={() => setExpanded(previous => !previous)}>
        <Icon fixedWidth={true} name="circle-info" /> <span>{demoText.demoNotes.trigger.aria}</span>
        {/* `margin-left: auto` on the icon itself, matching the vanilla port's
            markup pixel for pixel. */}
        <Icon fixedWidth={true} name={expanded ? 'chevron-up' : 'chevron-down'} style={{ marginLeft: 'auto' }} />
      </button>
      <div className="demo-field" id={disclosureId} hidden={!expanded}>
        <span className="demo-menu-notes-title">{title}</span>
        <span className="demo-menu-notes-body">{notes}</span>
      </div>
    </div>
  );
}
