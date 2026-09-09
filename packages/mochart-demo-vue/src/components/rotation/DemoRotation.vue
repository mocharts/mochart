<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { DefaultChart } from '@mochart/vue';

import TopBar from '../misc/TopBar.vue';

import { getRotationGrid, rotationConfigs as configs, rotationData as data } from '@mochart/demo-common';

interface Props {
  siteRootUrl?: string;
  onBackToDemos: () => void;
}

const props = defineProps<Props>();

// Columns are sized from the card's measured width (not the window) so the
// grid stays inside the padded shell.
const chartsElement = ref<HTMLDivElement | null>(null);
const chartsWidth = ref(0);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = chartsElement.value;
  if (el) {
    const measure = () => { chartsWidth.value = el.clientWidth; };
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    measure();
  }
});

onBeforeUnmount(() => {
  if (resizeObserver !== null) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

const grid = computed(() => getRotationGrid(chartsWidth.value));
const cols = computed(() => grid.value.cols);
const colWidth = computed(() => grid.value.colWidth);
</script>

<template>
  <div class="mochart-demo-container">
    <TopBar :site-root-url="props.siteRootUrl" :on-back-to-demos="props.onBackToDemos" />
    <div ref="chartsElement" class="rotation-charts">
      <template v-if="colWidth > 0">
        <div v-for="(config, i) in configs" :key="i"
             :class="'rotation-chart rotation-chart-' + i"
             :style="`left: ${(i % cols) * colWidth}px; top: ${Math.floor(i / cols) * colWidth}px; width: ${colWidth}px; height: ${colWidth}px;`">
          <DefaultChart :config="config" :data="data" :width="colWidth" :height="colWidth" />
        </div>
      </template>
    </div>
  </div>
</template>
