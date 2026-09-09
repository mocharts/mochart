<script lang="ts">
  import type { Snippet } from 'svelte';

  import { demoText, navMenuPlacement } from '@mochart/demo-common';
  import type { SwitchableDemoMode } from '@mochart/demo-common';

  import BackToDemosButton from './BackToDemosButton.svelte';
  import ModeSwitcher from './ModeSwitcher.svelte';
  import NotesMenu from './NotesMenu.svelte';
  import NotesMenuItem from './NotesMenuItem.svelte';
  import OverflowMenu from './OverflowMenu.svelte';
  import SiteRootButton from './SiteRootButton.svelte';
  import ThemeToggleButton from './ThemeToggleButton.svelte';
  import { createPhoneViewport } from './phoneViewport.svelte';

  // The bar across the top of every demo view: the site-root link, the back
  // link to the gallery, the view's tab strip, the "about this demo" popover,
  // the Single/Multi/Random mode switcher and the theme toggle. It was
  // hand-written six times (and in two shapes) before this — the same
  // consolidation the vanilla port made in its TopBar.ts, whose header
  // documents the design.
  //
  // The phone fold: below the phone breakpoint a bar that can fold keeps
  // exactly one thing directly tappable — the tab strip — and renders
  // everything else inside a single `…` menu at the far end. Each control
  // renders in exactly ONE of the two places, from the same markup, so nothing
  // is duplicated (see OverflowMenu.svelte). A bar folds only when it has
  // tabs, notes or a mode switcher: rotation and sparkline have none of the
  // three, their bar is just the back link and the theme toggle (which fits at
  // every width), and folding them would produce a row whose only content is a
  // `…` holding two rows.
  interface Props {
    /** Undefined in a standalone build, where there is no docs site to go back to. */
    siteRootUrl?: string;
    onBackToDemos: () => void;
    /** The view's tab strip (`DemoTabs`/`StaticDemoTabs`), if the view has one. */
    tabs?: Snippet;
    /** The demo the ⓘ popover describes. The standalone pages describe none. */
    notes?: { title: string; notes?: string };
    /** Omitted by the pages that are not one of the three switchable modes. */
    modes?: { demoMode: SwitchableDemoMode; onModeChanged: (nextDemoMode: SwitchableDemoMode) => void };
  }

  let { siteRootUrl = undefined, onBackToDemos, tabs = undefined, notes = undefined, modes = undefined }: Props = $props();

  const phone = createPhoneViewport();
  const canFold = $derived(tabs !== undefined || notes !== undefined || modes !== undefined);
  const folded = $derived(phone.isPhone && canFold);
  const hasNotes = $derived(notes !== undefined && notes.notes !== undefined);
</script>

{#if folded}
  <!-- `demo-has-overflow` gates the stylesheet's `flex-wrap: nowrap` chain,
       which is only safe while the row's surplus has somewhere to go — the
       class and the trigger that justifies it render together or not at all. -->
  <div class="mochart-demo-tabs-container demo-has-overflow">
    <div class="mochart-demo-nav-group">
      {#if tabs !== undefined}{@render tabs()}{/if}
    </div>
    <OverflowMenu text={demoText.overflowMenu.nav} placement={navMenuPlacement}>
      <!-- The menu's contents, in the order a thumb should meet them: what
           this demo is, then where else to see it, then how it looks, then the
           two ways out. The about row has no trailing divider when the Mode
           section follows — the section label draws its own rule above itself
           whenever it is not the panel's first child. -->
      {#if notes !== undefined && notes.notes !== undefined}
        <NotesMenuItem title={notes.title} notes={notes.notes} />
      {/if}
      {#if hasNotes && modes === undefined}<div class="demo-menu-divider"></div>{/if}
      {#if modes !== undefined}
        <div class="demo-menu-section-label">{demoText.modeSwitcher.menuSectionLabel}</div>
        <ModeSwitcher demoMode={modes.demoMode} onModeChanged={modes.onModeChanged} />
        <div class="demo-menu-divider"></div>
      {/if}
      <ThemeToggleButton />
      <div class="demo-menu-divider"></div>
      <BackToDemosButton {onBackToDemos} />
      <SiteRootButton {siteRootUrl} />
    </OverflowMenu>
  </div>
{:else}
  <!-- The trailing slot is the one place the two historical shapes differ:
       with a mode switcher it is a second nav group holding the switcher and
       the toggle; without one the toggle is a direct child of the row (an
       intermediate group of one would add its own gap and move it). -->
  <div class="mochart-demo-tabs-container">
    <div class="mochart-demo-nav-group">
      <SiteRootButton {siteRootUrl} />
      <BackToDemosButton {onBackToDemos} />
      {#if tabs !== undefined}{@render tabs()}{/if}
      {#if notes !== undefined && notes.notes !== undefined}
        <NotesMenu title={notes.title} notes={notes.notes} />
      {/if}
    </div>
    {#if modes !== undefined}
      <div class="mochart-demo-nav-group">
        <ModeSwitcher demoMode={modes.demoMode} onModeChanged={modes.onModeChanged} />
        <ThemeToggleButton />
      </div>
    {:else}
      <ThemeToggleButton />
    {/if}
  </div>
{/if}
