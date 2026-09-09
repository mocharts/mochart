<script module lang="ts">
  // Module-scoped so a test can observe this component's teardown.
  export const destroyLog = { destroyed: 0 };
</script>

<script lang="ts">
  // Placeholder test component that records its own destruction.
  import { onDestroy } from 'svelte';

  let { width = 0, height = 0 }: { width?: number; height?: number } = $props();

  onDestroy(() => {
    destroyLog.destroyed += 1;
  });
</script>

<div>Custom loading {width}x{height}</div>
