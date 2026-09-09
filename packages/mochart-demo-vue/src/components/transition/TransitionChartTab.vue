<script setup lang="ts">
import { ref, watch } from 'vue';

import { Chart } from '@mochart/vue';
import type { MochartConfig } from '@mochart/core';

import { demoText, getDemoTabPanelAttrs } from '@mochart/demo-common';

import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import Icon from '../misc/Icon.vue';

import type { ChartDataProviderLike } from '../../types';

interface Props {
  active?: boolean;
  mochartConfig: MochartConfig;
  dataProviders: ChartDataProviderLike[];
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

const dataProviderIndex = ref(0);

watch(() => [props.mochartConfig, props.dataProviders] as const, () => {
  dataProviderIndex.value = 0;
});

function onStepBack() {
  if (props.dataProviders.length > 1) {
    if (dataProviderIndex.value === 0) {
      dataProviderIndex.value = props.dataProviders.length - 1;
    }
    else {
      dataProviderIndex.value--;
    }
  }
}

function onStepForward() {
  if (props.dataProviders.length > 1) {
    if (dataProviderIndex.value === props.dataProviders.length - 1) {
      dataProviderIndex.value = 0;
    }
    else {
      dataProviderIndex.value++;
    }
  }
}

const panelAttrs = getDemoTabPanelAttrs('chart');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col chart' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="transition-chart-sizer">
      <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
             :mochart-config="props.mochartConfig" :data-provider="props.dataProviders[dataProviderIndex]" />
    </div>
    <div class="transition-controls">
      <form>
        <div class="demo-field">
          <div class="demo-toolbar">
            <div class="demo-btn-group">
              <ButtonWithTooltip id="transition-back" :label="demoText.transitionChartTab.back.label" :tooltip-text="demoText.transitionChartTab.back.tooltip" tooltip-placement="top-start"
                                 :on-click="onStepBack" :aria-label="demoText.transitionChartTab.back.aria">
                <Icon size="lg" :fixed-width="true" name="backward-step" />
              </ButtonWithTooltip>
              <ButtonWithTooltip id="transition-forward" :label="demoText.transitionChartTab.next.label" :tooltip-text="demoText.transitionChartTab.next.tooltip" tooltip-placement="top-start"
                                 :on-click="onStepForward" :aria-label="demoText.transitionChartTab.next.aria">
                <Icon size="lg" :fixed-width="true" name="forward-step" />
              </ButtonWithTooltip>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
