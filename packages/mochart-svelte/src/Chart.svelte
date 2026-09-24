<script lang="ts">
  // Svelte wrapper around mochart's `createChart`: takes an enhanced config
  // (`mochartConfig`) and a data provider. Omit `width`/`height` to have the
  // chart track the container div's size. `bind:this` exposes `refresh()`.
  import { createChart } from '@mochart/core';
  import ChartHost from './ChartHost.svelte';
  import type { ChartProps } from './types.js';

  let props: ChartProps = $props();

  let chartHost: ChartHost;

  /** Re-read the current data without a new reference: calls the provider's optional `refresh()` hook, then re-reads it. */
  export function refresh(): void {
    chartHost?.refresh();
  }
</script>

<ChartHost bind:this={chartHost} create={createChart} {...props} />
