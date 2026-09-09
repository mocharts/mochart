<script setup lang="ts">
import { ref } from 'vue';

import { demoTabId, demoTabPanelId, demoTabPendingId, demoText, nextDemoTabIndex } from '@mochart/demo-common';
import type { DemoTab } from '@mochart/demo-common';

// The Chart / Config / Data strip as an ARIA tablist: roving tabindex, arrow/Home/End keys via the shared nextDemoTabIndex, and automatic selection (arrowing shows the pane).
interface Props {
  tabs: readonly DemoTab[];
  activeKey: number;
  onSelect: (key: number) => void;
}

const props = defineProps<Props>();

const list = ref<HTMLUListElement | null>(null);

function onKeyDown(event: KeyboardEvent): void {
  const activeIndex = props.tabs.findIndex(tab => tab.key === props.activeKey);
  const nextIndex = nextDemoTabIndex(event.key, activeIndex < 0 ? 0 : activeIndex, props.tabs.length);
  if (nextIndex === null) {
    return;
  }
  // Home/End would scroll the pane, and the arrows are ours once focus is on a tab.
  event.preventDefault();
  props.onSelect(props.tabs[nextIndex].key);
  // Every tab is already rendered, so focus lands before the roving-tabindex update.
  list.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
}

function isPending(tab: DemoTab): boolean {
  return tab.pending === true && tab.key !== props.activeKey;
}
</script>

<template>
  <ul ref="list" class="demo-tabs" role="tablist" :aria-label="demoText.tabs.listAria" @keydown="onKeyDown">
    <!-- `presentation`, not `listitem`: a tablist's children are its tabs. -->
    <li v-for="tab in props.tabs" :key="tab.key" class="demo-tab-item" role="presentation">
      <button type="button" role="tab" :id="demoTabId(tab.name)"
              :class="'demo-tab' + (tab.key === props.activeKey ? ' active' : '')"
              :aria-selected="tab.key === props.activeKey" :aria-controls="demoTabPanelId(tab.name)"
              :tabindex="tab.key === props.activeKey ? 0 : -1"
              :title="isPending(tab) ? demoText.tabs.chartPendingTitle : undefined"
              :aria-describedby="isPending(tab) ? demoTabPendingId : undefined"
              @click="props.onSelect(tab.key)">
        {{ tab.label }}<span v-if="isPending(tab)" class="mochart-pending-badge" aria-hidden="true"></span>
      </button>
      <!-- Hidden text is still exposed through the tab's `aria-describedby` while the badge shows. -->
      <span v-if="tab.name === 'chart'" :id="demoTabPendingId" hidden>{{ demoText.tabs.chartPendingTitle }}</span>
    </li>
  </ul>
</template>
