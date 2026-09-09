<script lang="ts">
  // Internal component shared by Chart and DefaultChart: mounts the chart via
  // `create` into the div below, pushes prop changes through the chart handle,
  // and destroys the chart when the component is destroyed.
  import { getAllContexts, onMount } from 'svelte';
  import { mountChartHost } from './host';
  import type { CreateChartFn, HostHandle } from './host';
  import type { BaseChartProps } from './types';

  type ChartHostProps = BaseChartProps & {
    create: CreateChartFn;
    [key: string]: any;
  };

  let { create, class: className = undefined, style = undefined, dataTestId = undefined, ...chartProps }: ChartHostProps = $props();

  let container: HTMLDivElement;
  let host: HostHandle | null = null;
  let syncedProps: Record<string, any> = {};

  function sameProps(a: Record<string, any>, b: Record<string, any>): boolean {
    const aKeys = Object.keys(a);
    return aKeys.length === Object.keys(b).length && aKeys.every((key) => Object.is(a[key], b[key]));
  }

  /** Re-read the current config/data without new references (see Chart/DefaultChart). */
  export function refresh(): void {
    host?.refresh();
  }
  // captured at init time: placeholders mount with this component's contexts
  const componentContext = getAllContexts();

  onMount(() => {
    syncedProps = { ...chartProps };
    host = mountChartHost(create, container, syncedProps, componentContext);
    return () => {
      const current = host;
      host = null;
      current?.destroy();
    };
  });

  // one style string, size declarations after the host's: removing an explicit size then restores the host's own width or height
  const containerStyle = $derived([
    style,
    typeof chartProps.width === 'number' ? `width: ${chartProps.width}px` : null,
    typeof chartProps.height === 'number' ? `height: ${chartProps.height}px` : null
  ].filter(Boolean).join('; ') || undefined);

  $effect(() => {
    // Spreading reads every chart prop so this effect tracks them all; comparing
    // (not run-counting) keeps a change made before the first run, e.g. in a
    // parent's onMount, from being dropped.
    const next = { ...chartProps };
    if (host === null || sameProps(next, syncedProps)) {
      return;
    }
    syncedProps = next;
    host.update(next);
  });
</script>

<div
  bind:this={container}
  class={className}
  style={containerStyle}
  data-testid={dataTestId}
></div>
