<script lang="ts">
  import { demoText, notesMenuPlacement } from '@mochart/demo-common';

  import Icon from './Icon.svelte';
  import { Menu } from './menu.svelte';

  // The "about this demo" button in each mode's navigation row: an info icon
  // that opens the demo's `notes` (the detail kept out of its one-sentence
  // gallery description) in a popover panel. This is the desktop shape; below
  // the phone breakpoint the navigation row folds into an overflow menu, where
  // a popover cannot come along — its panel would be a descendant of an
  // element the menu hides with `display: none` — so TopBar renders
  // NotesMenuItem (a disclosure row inside the panel) instead of this.
  //
  // Positioning, dismissal, focus return and the disclosure ARIA come from the
  // `Menu` class (demo-common's menu geometry + dismissal under runes).
  interface Props {
    /** Demo title, shown as the panel heading. */
    title: string;
    /** The demo's notes; nothing renders when there are none. */
    notes?: string;
  }

  let { title, notes = undefined }: Props = $props();

  const menu = new Menu({ placement: notesMenuPlacement });

  // Close whenever the demo changes under us (history navigation between demos).
  $effect(() => {
    void title;
    void notes;
    menu.close();
  });
</script>

{#if notes !== undefined}
  <div class="demo-btn-group mochart-demo-notes-menu">
    <button type="button" bind:this={menu.trigger} {...menu.triggerProps}
            class={'demo-btn demo-btn-secondary mochart-demo-notes-trigger' + (menu.open ? ' active' : '')}
            title={demoText.demoNotes.trigger.tooltip} aria-label={demoText.demoNotes.trigger.aria}>
      <Icon size="lg" fixedWidth={true} name="circle-info" />
    </button>
    <div bind:this={menu.panel} {...menu.panelProps}
         class={'demo-menu demo-menu-notes' + (menu.isPositioned ? ' open' : '')}>
      <span class="demo-menu-notes-title">{title}</span>
      <span class="demo-menu-notes-body">{notes}</span>
    </div>
  </div>
{/if}
