<script setup lang="ts">
import { ref, shallowRef } from 'vue';

import { defaultTransitionConfig, demoText, getTransitionDataProviders, getTransitionMochartConfig } from '@mochart/demo-common';

import DemoTabs from '../misc/DemoTabs.vue';
import TopBar from '../misc/TopBar.vue';
import TransitionChartTab from './TransitionChartTab.vue';
import TransitionConfigTab from './TransitionConfigTab.vue';

import type { TransitionConfig } from '../../types';

interface Props {
  siteRootUrl?: string;
  onBackToDemos: () => void;
}

const props = defineProps<Props>();

const eventKeyChart = 1;
const eventKeyConfig = 2;

const activeKey = ref(eventKeyChart);

const transitionConfig = shallowRef<TransitionConfig>(defaultTransitionConfig);
const mochartConfig = shallowRef(getTransitionMochartConfig(defaultTransitionConfig));
const dataProviders = shallowRef(getTransitionDataProviders(defaultTransitionConfig));

function handleSelect(nextActiveKey: number) {
  activeKey.value = nextActiveKey;
}

function onUpdateConfig(nextTransitionConfig: TransitionConfig) {
  transitionConfig.value = nextTransitionConfig;
  mochartConfig.value = getTransitionMochartConfig(nextTransitionConfig);
  dataProviders.value = getTransitionDataProviders(nextTransitionConfig);
}

function onResetConfig() {
  transitionConfig.value = defaultTransitionConfig;
  mochartConfig.value = getTransitionMochartConfig(defaultTransitionConfig);
  dataProviders.value = getTransitionDataProviders(defaultTransitionConfig);
}
</script>

<template>
  <div class="mochart-demo-container multi">
    <TopBar :site-root-url="props.siteRootUrl" :on-back-to-demos="props.onBackToDemos">
      <template #tabs>
        <DemoTabs :active-key="activeKey" :on-select="handleSelect"
                  :tabs="[
                    { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
                    { name: 'config', key: eventKeyConfig, label: demoText.tabs.transitionConfig }
                  ]" />
      </template>
    </TopBar>
    <div class="mochart-demo-content-pane">
      <div class="mochart-demo-content">
        <TransitionChartTab :mochart-config="mochartConfig" :data-providers="dataProviders" :active="activeKey === eventKeyChart" />
        <TransitionConfigTab :transition-config="transitionConfig" :on-update="onUpdateConfig" :on-reset="onResetConfig"
                             :active="activeKey === eventKeyConfig" />
      </div>
    </div>
  </div>
</template>
