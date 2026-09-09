<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue';

import { buildMochartDemoConfig, demoText } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import DemoTabs from '../misc/DemoTabs.vue';
import TopBar from '../misc/TopBar.vue';
import RandomContent from './RandomContent.vue';

import type { DemoData } from '../../types';

interface Props {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  onBackToDemos: () => void;
  randomId: number;
  incrementRandomId: () => void;
  decrementRandomId: () => void;
}

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

const props = defineProps<Props>();

function buildStateForDemo(demoId: string) {
  const demo = props.demoData.demoObjectMap[demoId];
  return {
    mochartDemoConfig: buildMochartDemoConfig(demo.config),
    randomConfig: Object.assign({}, demo.random, { valid: true }),
    generator: demo.generator
  };
}

const initialState = buildStateForDemo(props.initialDemoId);

const activeKey = ref(eventKeyChart);
const mochartDemoConfig = shallowRef(initialState.mochartDemoConfig);
const randomConfig = shallowRef(initialState.randomConfig);
const generator = shallowRef(initialState.generator);

// When the routed demo changes, rebuild its config state (RandomContent's own
// watch tells a demo change apart from a randomId-only step).
watch(() => props.initialDemoId, (nextInitialDemoId) => {
  const nextState = buildStateForDemo(nextInitialDemoId);
  activeKey.value = eventKeyChart;
  mochartDemoConfig.value = nextState.mochartDemoConfig;
  randomConfig.value = nextState.randomConfig;
  generator.value = nextState.generator;
});

function handleSelect(nextActiveKey: number) {
  activeKey.value = nextActiveKey;
}
</script>

<template>
  <div class="mochart-demo-container multi">
    <TopBar :site-root-url="props.siteRootUrl" :on-back-to-demos="props.onBackToDemos"
            :notes="props.demoData.demoObjectMap[props.initialDemoId]"
            :modes="{ demoMode: 'random', onModeChanged: props.onModeChanged }">
      <template #tabs>
        <DemoTabs :active-key="activeKey" :on-select="handleSelect"
                  :tabs="[
                    { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
                    { name: 'config', key: eventKeyConfig, label: demoText.tabs.randomConfig },
                    { name: 'data', key: eventKeyData, label: demoText.tabs.data }
                  ]" />
      </template>
    </TopBar>
    <div class="mochart-demo-content-pane">
      <RandomContent :mochart-demo-config="mochartDemoConfig" :initial-random-config="randomConfig" :generator="generator"
                     :active-key="activeKey" :event-keys="{ eventKeyChart, eventKeyConfig, eventKeyData }"
                     :random-id="props.randomId" :increment-random-id="props.incrementRandomId" :decrement-random-id="props.decrementRandomId" />
    </div>
  </div>
</template>
