import { useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';

import { isMenuDismissingClick } from '@mochart/demo-common';
import type { MenuPlacement } from '@mochart/demo-common';

import Icon from './Icon';
import { useMenu } from './useMenu';

// The phone fold's container: a single `…` trigger whose panel holds the
// controls that did not fit in the strip beside it.
//
// The vanilla port MOVES its retained DOM nodes into the panel (hosts, not
// mirrors — see the header of vanilla's OverflowMenu.ts). React owns its DOM,
// so the equivalent contract here is: every folded control is RENDERED in
// exactly one place — the strip above the phone tier, this panel below it —
// from the same JSX, driven by the same props. Same outcome: no duplicate ids,
// no second accessible name, no mirrored disabled/pressed state. A port that
// renders a control twice and hides one with CSS has missed the design.
//
// The panel's children keep their own classes (`.demo-btn`, `.demo-btn-group`,
// `.demo-toolbar`); `css/demo.css`'s `.demo-menu-overflow` rules restyle them
// into full-width menu rows by context. Loose buttons (not part of a group)
// should be wrapped in a `.demo-btn-group`, the class those rules turn into a
// full-width column.
//
// Activating any button or link inside the panel closes it, except inside a
// `.demo-menu-keep-open` subtree (a stepper beside a number input, say, where
// closing after every press would make the control unusable).

interface OverflowMenuProps {
  /** Trigger copy — one of `demoText.overflowMenu.*`, so each trigger names what it holds. */
  text: { tooltip: string; aria: string };
  placement?: MenuPlacement;
  /** Anchor the panel to a whole row when the trigger is not the row's end. */
  anchorRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert
   * and shifted offscreen, and an open panel is `position: fixed` — it would
   * keep painting over whichever pane replaced this one. False closes it.
   */
  active?: boolean;
  children: ReactNode;
}

export default function OverflowMenu(props: OverflowMenuProps) {
  const { text, placement, anchorRef, disabled = false, active = true, children } = props;
  const menu = useMenu({ placement, anchorRef });
  const { close } = menu;

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  useEffect(() => {
    if (disabled || !active) {
      close();
    }
  }, [disabled, active, close]);

  const onPanelClick = (event: React.MouseEvent) => {
    if (isMenuDismissingClick(event.target)) {
      close();
    }
  };

  return (
    <div className="demo-btn-group demo-overflow-menu">
      <button type="button" ref={menu.triggerRef} {...menu.triggerProps}
        className={'demo-btn demo-btn-secondary' + (menu.open ? ' active' : '')}
        disabled={disabled} title={text.tooltip} aria-label={text.aria}>
        <Icon size="lg" fixedWidth={true} name="ellipsis" />
      </button>
      <div ref={menu.panelRef} {...menu.panelProps}
        className={'demo-menu demo-menu-overflow' + (menu.isPositioned ? ' open' : '')}
        onClick={onPanelClick}>
        {children}
      </div>
    </div>
  );
}

export function MenuDivider() {
  return <div className="demo-menu-divider" />;
}

export function MenuSectionLabel({ children }: { children: ReactNode }) {
  return <div className="demo-menu-section-label">{children}</div>;
}
