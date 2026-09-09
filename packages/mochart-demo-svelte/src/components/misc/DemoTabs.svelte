<script lang="ts">
  import { demoTabId, demoTabPanelId, demoTabPendingId, demoText, nextDemoTabIndex } from '@mochart/demo-common';
  import type { DemoTab } from '@mochart/demo-common';

  // The Chart / Config / Data strip as an ARIA tablist: roving tabindex, arrow/Home/End keys via the shared nextDemoTabIndex, and automatic selection (arrowing shows the pane).
  interface Props {
    tabs: readonly DemoTab[];
    activeKey: number;
    onSelect: (key: number) => void;
  }

  let { tabs, activeKey, onSelect }: Props = $props();

  let list = $state<HTMLUListElement | null>(null);

  function onKeyDown(event: KeyboardEvent) {
    const activeIndex = tabs.findIndex(tab => tab.key === activeKey);
    const nextIndex = nextDemoTabIndex(event.key, activeIndex < 0 ? 0 : activeIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }
    // Home/End would scroll the pane, and the arrows are ours once focus is on a tab.
    event.preventDefault();
    onSelect(tabs[nextIndex].key);
    // Every tab is already rendered, so focus lands before the roving-tabindex update.
    list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }
</script>

<ul bind:this={list} class="demo-tabs" role="tablist" aria-label={demoText.tabs.listAria}
    onkeydown={onKeyDown}>
  {#each tabs as tab (tab.key)}
    {@const selected = tab.key === activeKey}
    {@const pending = tab.pending === true && !selected}
    <!-- `presentation`, not `listitem`: a tablist's children are its tabs. -->
    <li class="demo-tab-item" role="presentation">
      <button type="button" id={demoTabId(tab.name)} role="tab"
              class={"demo-tab" + (selected ? " active" : "")}
              aria-selected={selected} aria-controls={demoTabPanelId(tab.name)}
              tabindex={selected ? 0 : -1}
              title={pending ? demoText.tabs.chartPendingTitle : undefined}
              aria-describedby={pending ? demoTabPendingId : undefined}
              onclick={() => onSelect(tab.key)}>
        {tab.label}{#if pending}<span class="mochart-pending-badge" aria-hidden="true"></span>{/if}
      </button>
      <!-- Hidden text is still exposed through the tab's `aria-describedby` while the badge shows. -->
      {#if tab.name === 'chart'}
        <span id={demoTabPendingId} hidden>{demoText.tabs.chartPendingTitle}</span>
      {/if}
    </li>
  {/each}
</ul>
