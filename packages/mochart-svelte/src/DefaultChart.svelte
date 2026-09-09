<script lang="ts">
  // Svelte wrapper around mochart's `createDefaultChart`: takes a raw `config`
  // (enhanced internally) and a plain `data` — an array of objects or an object of arrays. Omit
  // `width`/`height` to have the chart track the container div's size.
  // `bind:this` exposes `refresh()`.
  import { createDefaultChart } from '@mochart/core';
  import ChartHost from './ChartHost.svelte';
  import type { DefaultChartProps } from './types';

  let props: DefaultChartProps = $props();

  let chartHost: ChartHost;

  /** Re-read the current config/data (rebuilding the provider over `data`) without new references. */
  export function refresh(): void {
    chartHost?.refresh();
  }
</script>

<ChartHost bind:this={chartHost} create={createDefaultChart} {...props} />
