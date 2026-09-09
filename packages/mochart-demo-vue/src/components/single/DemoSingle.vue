<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';

import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import TopBar from '../misc/TopBar.vue';
import ChartTab from './ChartTab.vue';
import ConfigTab from './ConfigTab.vue';
import DataTab from './DataTab.vue';
import DemoTabs from '../misc/DemoTabs.vue';
import ErrorTab from '../misc/ErrorTab.vue';

import type { DemoData, DemoConfig, DataObject } from '../../types';

interface Props {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  onBackToDemos: () => void;
}

type DataError = string | boolean | null;

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

const props = defineProps<Props>();

const activeKey = ref(eventKeyChart);

// A share link carries edited config/data in the URL hash; it overrides the
// demo's own config/data for the initial mount only.
const sharedState = consumeSingleShareState();

// Config/data edits made on the Config/Data tabs stay "pending" until the
// Chart tab is shown again (so the chart animates one combined change).
const demoId = ref(props.initialDemoId);
const pendingConfig = shallowRef<DemoConfig | null>(null);
const pendingData = shallowRef<DataObject[] | null>(null);
const pendingDataError = shallowRef<DataError>(false);
const config = shallowRef<DemoConfig>(sharedState?.config ?? props.demoData.demoObjectMap[props.initialDemoId].config);
const data = shallowRef<DataObject[]>(sharedState?.data ?? props.demoData.demoObjectMap[props.initialDemoId].data);
const viewingConfig = shallowRef<DemoConfig>(config.value);
const viewingData = shallowRef<DataObject[]>(data.value);
const viewingDataError = shallowRef<DataError>(false);

function chartShown() {
  if (pendingConfig.value !== null || pendingData.value !== null || pendingDataError.value !== null) {
    if (pendingConfig.value !== null) {
      viewingConfig.value = pendingConfig.value;
      pendingConfig.value = null;
    }
    if (pendingData.value !== null) {
      viewingData.value = pendingData.value;
      pendingData.value = null;
    }
    if (pendingDataError.value !== null) {
      viewingDataError.value = pendingDataError.value;
      pendingDataError.value = null;
    }
  }
}

function handleSelect(nextActiveKey: number) {
  const previousActiveKey = activeKey.value;
  activeKey.value = nextActiveKey;
  if (nextActiveKey === eventKeyChart && previousActiveKey !== eventKeyChart) {
    chartShown();
  }
}

// When the routed demo changes (history navigation between two demos), reload
// its config/data and promote them straight to the visible chart.
watch(() => props.initialDemoId, (initialDemoId) => {
  activeKey.value = eventKeyChart;
  demoId.value = initialDemoId;
  config.value = props.demoData.demoObjectMap[initialDemoId].config;
  data.value = props.demoData.demoObjectMap[initialDemoId].data;
  pendingConfig.value = config.value;
  pendingData.value = data.value;
  chartShown();
});

function onConfigChange(nextPendingConfig: DemoConfig) {
  pendingConfig.value = nextPendingConfig;
}

function onConfigReset() {
  const resetConfig = { ...props.demoData.demoObjectMap[demoId.value].config };
  pendingConfig.value = resetConfig;
  config.value = resetConfig;
}

function onDataChange(nextPendingData: DataObject[]) {
  pendingData.value = nextPendingData;
  pendingDataError.value = false;
}

function onDataError(errorMessage: string) {
  pendingDataError.value = errorMessage;
}

function onDataReset() {
  // give it a new array reference so children know to update
  pendingData.value = props.demoData.demoObjectMap[demoId.value].data.slice();
  pendingDataError.value = false;
}

// Applied config/data edits are held until the Chart tab is shown; badge the
// Chart tab so it's visible that something is waiting there.
const hasPendingChanges = computed(() =>
  activeKey.value !== eventKeyChart && (pendingConfig.value !== null || pendingData.value !== null));

// editor-reported error, or the viewing config/data pair failing validation
const chartDataError = computed(() => viewingDataError.value || getConfigDataError(viewingConfig.value, viewingData.value));
</script>

<template>
  <div class="mochart-demo-container">
    <TopBar :site-root-url="props.siteRootUrl" :on-back-to-demos="props.onBackToDemos"
            :notes="props.demoData.demoObjectMap[props.initialDemoId]"
            :modes="{ demoMode: 'single', onModeChanged: props.onModeChanged }">
      <template #tabs>
        <DemoTabs :active-key="activeKey" :on-select="handleSelect"
                  :tabs="[
                    { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart, pending: hasPendingChanges },
                    { name: 'config', key: eventKeyConfig, label: demoText.tabs.config },
                    { name: 'data', key: eventKeyData, label: demoText.tabs.data }
                  ]" />
      </template>
    </TopBar>
    <div class="mochart-demo-content-pane">
      <div class="mochart-demo-content">
        <ErrorTab :active="activeKey === eventKeyChart">
          <ChartTab :active="activeKey === eventKeyChart" :config="viewingConfig" :data="viewingData" :data-error="chartDataError" />
        </ErrorTab>
        <ErrorTab :active="activeKey === eventKeyConfig">
          <ConfigTab :active="activeKey === eventKeyConfig" :config="config" :on-config-change="onConfigChange" :on-config-reset="onConfigReset" />
        </ErrorTab>
        <ErrorTab :active="activeKey === eventKeyData">
          <DataTab :active="activeKey === eventKeyData" :config="viewingConfig" :data="data"
                   :on-data-change="onDataChange" :on-data-error="onDataError" :on-data-reset="onDataReset" />
        </ErrorTab>
      </div>
    </div>
  </div>
</template>
