import { Component, Input } from '@angular/core';

import { demoText, navMenuPlacement } from '@mochart/demo-common';

import { BackToDemosButton, ModeSwitcher, SiteRootButton, ThemeToggleButton } from './mode-switcher';
import { NotesMenu } from './notes-menu';
import { NotesMenuItem } from './notes-menu-item';
import { OverflowMenu } from './overflow-menu';
import { phoneViewport } from './phone-viewport';

import type { SwitchableDemoMode } from '../../types';

/**
 * The bar across the top of every demo view: the site-root link, the back link
 * to the gallery, the view's tab strip (projected), the "about this demo"
 * popover, the Single/Multi/Random mode switcher and the theme toggle. It was
 * hand-written six times (and in two shapes) before this — the same
 * consolidation the vanilla port made in its TopBar.ts, whose header documents
 * the design.
 *
 * The phone fold: below the phone breakpoint a bar that can fold keeps exactly
 * one thing directly tappable — the tab strip — and renders everything else
 * inside a single `…` menu at the far end. Each control renders in exactly ONE
 * of the two branches, so nothing is duplicated (see OverflowMenu). A bar folds
 * only when it has tabs, notes or a mode switcher: rotation and sparkline have
 * none of the three, their bar is just the back link and the theme toggle
 * (which fits at every width), and folding them would produce a row whose only
 * content is a `…` holding two rows.
 *
 * The tab strip (`DemoTabs`/`StaticDemoTabs`) arrives as projected content
 * rather than an input, because it carries each page's own handlers. A given
 * `<ng-content>` projects to exactly one place, which is why it sits in the nav
 * group common to both branches rather than inside either of them — and why the
 * caller has to declare `[hasTabs]`, since Angular gives no way to ask whether
 * anything was projected.
 */
@Component({
  selector: 'app-top-bar',
  imports: [BackToDemosButton, ModeSwitcher, NotesMenu, NotesMenuItem, OverflowMenu, SiteRootButton, ThemeToggleButton],
  styles: [':host { display: contents; }'],
  template: `
    <!-- \`demo-has-overflow\` gates the stylesheet's \`flex-wrap: nowrap\` chain,
         which is only safe while the row's surplus has somewhere to go — the
         class and the trigger that justifies it render together or not at all. -->
    <div [class]="'mochart-demo-tabs-container' + (folded() ? ' demo-has-overflow' : '')">
      <div class="mochart-demo-nav-group">
        @if (!folded()) {
          @if (siteRootUrl !== undefined) {
            <a appSiteRootButton [href]="siteRootUrl"></a>
          }
          <button appBackToDemosButton (click)="onBackToDemos()"></button>
        }
        <ng-content />
        @if (!folded() && hasNotes()) {
          <app-notes-menu [demoTitle]="notes!.title" [notes]="notes!.notes" />
        }
      </div>
      @if (folded()) {
        <app-overflow-menu [text]="overflowText" [placement]="navPlacement">
          <!-- The menu's contents, in the order a thumb should meet them: what
               this demo is, then where else to see it, then how it looks, then
               the two ways out. The about row has no trailing divider when the
               Mode section follows — the section label draws its own rule above
               itself whenever it is not the panel's first child. -->
          @if (hasNotes()) {
            <app-notes-menu-item [demoTitle]="notes!.title" [notes]="notes!.notes" />
          }
          @if (hasNotes() && modes === undefined) {
            <div class="demo-menu-divider"></div>
          }
          @if (modes !== undefined) {
            <div class="demo-menu-section-label">{{ modeSectionLabel }}</div>
            <app-mode-switcher [demoMode]="modes.demoMode" [onModeChanged]="modes.onModeChanged" />
            <div class="demo-menu-divider"></div>
          }
          <button appThemeToggleButton></button>
          <div class="demo-menu-divider"></div>
          <button appBackToDemosButton (click)="onBackToDemos()"></button>
          @if (siteRootUrl !== undefined) {
            <a appSiteRootButton [href]="siteRootUrl"></a>
          }
        </app-overflow-menu>
      } @else if (modes !== undefined) {
        <!-- The trailing slot is the one place the two historical shapes
             differ: with a mode switcher it is a second nav group holding the
             switcher and the toggle; without one the toggle is a direct child
             of the row (an intermediate group of one would add its own gap and
             move it). -->
        <div class="mochart-demo-nav-group">
          <app-mode-switcher [demoMode]="modes.demoMode" [onModeChanged]="modes.onModeChanged" />
          <button appThemeToggleButton></button>
        </div>
      } @else {
        <button appThemeToggleButton></button>
      }
    </div>
  `
})
export class TopBar {
  /** Undefined in a standalone build, where there is no docs site to go back to. */
  @Input() siteRootUrl?: string;
  @Input({ required: true }) onBackToDemos!: () => void;
  /** Whether the caller projected a tab strip. */
  @Input() hasTabs = false;
  /** The demo the ⓘ popover describes. The standalone pages describe none. */
  @Input() notes?: { title: string; notes?: string };
  /** Omitted by the pages that are not one of the three switchable modes. */
  @Input() modes?: { demoMode: SwitchableDemoMode; onModeChanged: (nextDemoMode: SwitchableDemoMode) => void };

  readonly overflowText = demoText.overflowMenu.nav;
  readonly modeSectionLabel = demoText.modeSwitcher.menuSectionLabel;
  readonly navPlacement = navMenuPlacement;

  private readonly phone = phoneViewport();

  hasNotes(): boolean {
    return this.notes !== undefined && this.notes.notes !== undefined;
  }

  folded(): boolean {
    return this.phone() && (this.hasTabs || this.notes !== undefined || this.modes !== undefined);
  }
}
