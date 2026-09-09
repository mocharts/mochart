<script lang="ts">
  import { onDestroy } from 'svelte';

  import { controlsMenuPlacement, createShareLinkCopier, demoText } from '@mochart/demo-common';
  import type { ShareState } from '@mochart/demo-common';

  import Icon from './Icon.svelte';
  import { Menu } from './menu.svelte';

  // A collapsed export/share menu placed at the end of each mode's controls row.
  // The trigger uses a share icon; the menu holds PNG / SVG downloads and (when a
  // share state is provided) a copy-share-link item. The parent supplies the
  // export actions so this component stays agnostic about single vs. tiled charts.
  //
  // Positioning, dismissal, focus return and the disclosure ARIA come from the
  // `Menu` class (demo-common's menu geometry + dismissal under runes) —
  // including the reason any of it is hand-rolled (the controls strips clip an
  // absolutely-positioned dropdown, and the chart's interaction rect eats
  // clicks through anything stacked below it). What stays here is what the
  // class does not know about: the items, their copied label, `disabled`.
  interface Props {
    exportPng: () => void;
    exportSvg: () => void;
    /** Omit to hide the Share item (e.g. a chart whose state isn't shareable). */
    getShareState?: () => ShareState;
    disabled?: boolean;
    /**
     * The hosting pane's active state. A deactivated pane is only marked
     * inert, and an open panel is `position: fixed` — it would keep painting
     * over the pane that replaced this one. False closes the menu.
     */
    active?: boolean;
  }

  let { exportPng, exportSvg, getShareState = undefined, disabled = false, active = true }: Props = $props();

  let copied = $state(false);
  const shareLinkCopier = createShareLinkCopier(nextCopied => { copied = nextCopied; });

  const menu = new Menu({ placement: controlsMenuPlacement });

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  $effect(() => {
    if (disabled || !active) {
      menu.close();
    }
  });

  onDestroy(() => shareLinkCopier.dispose());

  function runAndClose(action: () => void) {
    action();
    menu.close();
  }

  function onShare() {
    if (!getShareState) {
      return;
    }
    shareLinkCopier.copy(getShareState());
    menu.close();
  }
</script>

<div class="demo-btn-group mochart-export-share-menu">
  <button type="button" bind:this={menu.trigger} {...menu.triggerProps}
          class={'demo-btn demo-btn-secondary demo-menu-trigger' + (menu.open ? ' active' : '')}
          {disabled}
          title={demoText.exportShareMenu.trigger.tooltip} aria-label={demoText.exportShareMenu.trigger.aria}>
    <Icon size="lg" fixedWidth={true} name="share-nodes" />
  </button>
  <div bind:this={menu.panel} {...menu.panelProps}
       class={'demo-menu' + (menu.isPositioned ? ' open' : '')}>
    <button type="button" class="demo-menu-item" onclick={() => runAndClose(exportPng)}
            aria-label={demoText.exportButtons.png.aria}>
      <Icon fixedWidth={true} name="file-image" /> <span>{demoText.exportButtons.png.label}</span>
    </button>
    <button type="button" class="demo-menu-item" onclick={() => runAndClose(exportSvg)}
            aria-label={demoText.exportButtons.svg.aria}>
      <Icon fixedWidth={true} name="file-code" /> <span>{demoText.exportButtons.svg.label}</span>
    </button>
    {#if getShareState}
      <div class="demo-menu-divider"></div>
      <button type="button" class="demo-menu-item" onclick={onShare}
              aria-label={demoText.shareButton.aria}>
        <Icon fixedWidth={true} name={copied ? 'check' : 'link'} /> <span>{copied ? demoText.shareButton.tooltipCopied : demoText.shareButton.label}</span>
      </button>
    {/if}
  </div>
</div>
