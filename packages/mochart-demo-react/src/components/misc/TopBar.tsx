import type { ReactNode } from 'react';

import { demoText, navMenuPlacement } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { BackToDemosButton, ModeSwitcher, SiteRootButton, ThemeToggleButton } from './ModeSwitcher';
import NotesMenu, { NotesMenuItem } from './NotesMenu';
import OverflowMenu, { MenuDivider, MenuSectionLabel } from './OverflowMenu';
import { usePhoneViewport } from './usePhoneViewport';

import type { OnModeChanged, OnBackToDemos } from '../../types';

// The bar across the top of every demo view: the site-root link, the back link
// to the gallery, the view's tab strip, the "about this demo" popover, the
// Single/Multi/Random mode switcher and the theme toggle. It was hand-written
// six times (and in two shapes) before this — the same consolidation the
// vanilla port made in its TopBar.ts, whose header documents the design.
//
// The phone fold: below the phone breakpoint a bar that can fold keeps exactly
// one thing directly tappable — the tab strip — and renders everything else
// inside a single `…` menu at the far end. Each control renders in exactly ONE
// of the two places, from the same JSX, so nothing is duplicated (see
// OverflowMenu.tsx). A bar folds only when it has tabs, notes or a mode
// switcher: rotation and sparkline have none of the three, their bar is just
// the back link and the theme toggle (which fits at every width), and folding
// them would produce a row whose only content is a `…` holding two rows.

export interface TopBarProps {
  /** Undefined in a standalone build, where there is no docs site to go back to. */
  siteRootUrl?: string;
  onBackToDemos: OnBackToDemos;
  /** The view's tab strip (`DemoTabs`/`StaticDemoTabs`), if the view has one. */
  tabs?: ReactNode;
  /** The demo the ⓘ popover describes. The standalone pages describe none. */
  notes?: { title: string; notes?: string };
  /** Omitted by the pages that are not one of the three switchable modes. */
  modes?: { demoMode: SwitchableDemoMode; onModeChanged: OnModeChanged };
}

export default function TopBar({ siteRootUrl, onBackToDemos, tabs, notes, modes }: TopBarProps) {
  const isPhone = usePhoneViewport();
  const canFold = tabs !== undefined || notes !== undefined || modes !== undefined;
  const folded = isPhone && canFold;

  const hasNotes = notes !== undefined && notes.notes !== undefined;
  const switcher = modes === undefined
    ? null
    : <ModeSwitcher demoMode={modes.demoMode} onModeChanged={modes.onModeChanged} />;

  if (folded) {
    // `demo-has-overflow` gates the stylesheet's `flex-wrap: nowrap` chain,
    // which is only safe while the row's surplus has somewhere to go — the
    // class and the trigger that justifies it render together or not at all.
    return (
      <div className="mochart-demo-tabs-container demo-has-overflow">
        <div className="mochart-demo-nav-group">
          {tabs}
        </div>
        <OverflowMenu text={demoText.overflowMenu.nav} placement={navMenuPlacement}>
          {/* The menu's contents, in the order a thumb should meet them: what
              this demo is, then where else to see it, then how it looks, then
              the two ways out. The about row has no trailing divider when the
              Mode section follows — the section label draws its own rule above
              itself whenever it is not the panel's first child. */}
          {hasNotes ? <NotesMenuItem title={notes.title} notes={notes.notes} /> : null}
          {hasNotes && switcher === null ? <MenuDivider /> : null}
          {switcher !== null ? (
            <>
              <MenuSectionLabel>{demoText.modeSwitcher.menuSectionLabel}</MenuSectionLabel>
              {switcher}
              <MenuDivider />
            </>
          ) : null}
          <ThemeToggleButton />
          <MenuDivider />
          <BackToDemosButton onBackToDemos={onBackToDemos} />
          <SiteRootButton siteRootUrl={siteRootUrl} />
        </OverflowMenu>
      </div>
    );
  }

  // The trailing slot is the one place the two historical shapes differ: with
  // a mode switcher it is a second nav group holding the switcher and the
  // toggle; without one the toggle is a direct child of the row (an
  // intermediate group of one would add its own gap and move it).
  return (
    <div className="mochart-demo-tabs-container">
      <div className="mochart-demo-nav-group">
        <SiteRootButton siteRootUrl={siteRootUrl} />
        <BackToDemosButton onBackToDemos={onBackToDemos} />
        {tabs}
        {hasNotes ? <NotesMenu title={notes.title} notes={notes.notes} /> : null}
      </div>
      {switcher !== null ? (
        <div className="mochart-demo-nav-group">
          {switcher}
          <ThemeToggleButton />
        </div>
      ) : <ThemeToggleButton />}
    </div>
  );
}
