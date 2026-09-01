<script setup lang="ts">
// Thumbnails of every animation easing: each cell plots eased progress (y)
// over linear time (x). The easing functions are imported on mount, the same
// SSR-safety pattern as LiveChart.
import { onMounted, ref } from 'vue';

import type { AnimationEasing } from '@mochart/core';

interface Curve { name: string; points: string }

const curves = ref<Curve[]>([]);

const SAMPLES = 120;
// vertical padding inside the 100x100 viewBox, sized for elastic's excursions outside 0 to 1
const pad = 22;

onMounted(async () => {
  const { EASINGS, getEasingFunction } = await import('@mochart/core');
  curves.value = EASINGS.map(name => {
    const fn = getEasingFunction(name as AnimationEasing);
    const points: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const x = t * 100;
      const y = 100 - pad - fn(t) * (100 - 2 * pad);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { name, points: points.join(' ') };
  });
});
</script>

<template>
  <div class="easing-gallery">
    <figure v-for="curve in curves" :key="curve.name" class="easing-gallery-cell">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <line class="easing-gallery-guide" x1="0" :y1="pad" x2="100" :y2="pad" />
        <line class="easing-gallery-guide" x1="0" :y1="100 - pad" x2="100" :y2="100 - pad" />
        <polyline :points="curve.points" />
      </svg>
      <figcaption>{{ curve.name }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.easing-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.easing-gallery-cell {
  margin: 0;
  text-align: center;
}
.easing-gallery-cell svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
}
.easing-gallery-cell polyline {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 2.5;
}
.easing-gallery-guide {
  stroke: var(--vp-c-divider);
  stroke-width: 1;
}
.easing-gallery-cell figcaption {
  margin-top: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.3;
  color: var(--vp-c-text-2);
}
</style>
