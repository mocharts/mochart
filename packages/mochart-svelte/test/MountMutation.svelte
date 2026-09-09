<script lang="ts">
  // Parent whose onMount flushes after the chart's: mutates a chart-feeding
  // prop before the chart's first $effect run.
  import { onMount } from 'svelte';
  import { Chart } from '../src/index';

  let { mochartConfig, dataProvider }: { mochartConfig: any; dataProvider: any } = $props();
  let width = $state(400);

  onMount(() => {
    width = 500;
  });
</script>

<Chart {mochartConfig} {dataProvider} {width} height={300} />
