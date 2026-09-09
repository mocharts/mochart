<script lang="ts">
  import type { Snippet } from 'svelte';

  import { isMenuDismissingClick } from '@mochart/demo-common';
  import type { MenuPlacement } from '@mochart/demo-common';

  import Icon from './Icon.svelte';
  import { Menu } from './menu.svelte';

  // The phone fold's container: a single `…` trigger whose panel holds the
  // controls that did not fit in the strip beside it.
  //
  // The vanilla port MOVES its retained DOM nodes into the panel (hosts, not
  // mirrors — see the header of vanilla's OverflowMenu.ts). A svelte component
  // owns its DOM, so the contract here is the same as the react port's: every
  // folded control is RENDERED in exactly one place — the strip above the
  // phone tier, this panel below it — from the same markup, driven by the same
  // state. Same outcome: no duplicate ids, no second accessible name, no
  // mirrored disabled/pressed state. A port that renders a control twice and
  // hides one with CSS has missed the design.
  //
  // The panel's children keep their own classes (`.demo-btn`,
  // `.demo-btn-group`, `.demo-toolbar`); `css/demo.css`'s `.demo-menu-overflow`
  // rules restyle them into full-width menu rows by context. Loose buttons
  // (not part of a group) should be wrapped in a `.demo-btn-group`, the class
  // those rules turn into a full-width column.
  //
  // Activating any button or link inside the panel closes it, except inside a
  // `.demo-menu-keep-open` subtree (a stepper beside a number input, say,
  // where closing after every press would make the control unusable).
  interface Props {
    /** Trigger copy — one of `demoText.overflowMenu.*`, so each trigger names what it holds. */
    text: { tooltip: string; aria: string };
    placement?: MenuPlacement;
    /** Anchor the panel to a whole row when the trigger is not the row's end. */
    getAnchor?: () => HTMLElement | null;
    disabled?: boolean;
    /**
     * The hosting pane's active state. A deactivated pane is only marked inert
     * and shifted offscreen, and an open panel is `position: fixed` — it would
     * keep painting over whichever pane replaced this one. False closes it.
     */
    active?: boolean;
    children: Snippet;
  }

  let { text, placement, getAnchor, disabled = false, active = true, children }: Props = $props();

  // svelte-ignore state_referenced_locally -- placement and anchor are fixed per mount
  const menu = new Menu({ placement, getAnchor });

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  $effect(() => {
    if (disabled || !active) {
      menu.close();
    }
  });

  function onPanelClick(event: MouseEvent): void {
    if (isMenuDismissingClick(event.target)) {
      menu.close();
    }
  }
</script>

<div class="demo-btn-group demo-overflow-menu">
  <button type="button" bind:this={menu.trigger} {...menu.triggerProps}
          class={'demo-btn demo-btn-secondary' + (menu.open ? ' active' : '')}
          {disabled} title={text.tooltip} aria-label={text.aria}>
    <Icon size="lg" fixedWidth={true} name="ellipsis" />
  </button>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div bind:this={menu.panel} {...menu.panelProps}
       class={'demo-menu demo-menu-overflow' + (menu.isPositioned ? ' open' : '')}
       onclick={onPanelClick}>
    {@render children()}
  </div>
</div>
