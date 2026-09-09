import { getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { mountChartHost } from './host.js';
import type { CreateChartFn, HostHandle } from './host.js';

/**
 * Mounts a chart with `create` into the returned ref's element, pushes prop
 * changes through the chart handle whenever the reactive props read by
 * `getChartProps` change, and destroys the chart on unmount.
 */
export interface ChartHost {
  containerRef: Ref<HTMLDivElement | null>;
  refresh: () => void;
}

export function useChartHost(
  create: CreateChartFn,
  getChartProps: () => Record<string, any>
): ChartHost {
  const containerRef = ref<HTMLDivElement | null>(null);
  let host: HostHandle | null = null;
  // captured at setup time: placeholders render with the host app's context
  const appContext = getCurrentInstance()?.appContext ?? null;

  onMounted(() => {
    host = mountChartHost(create, containerRef.value as HTMLDivElement, getChartProps(), appContext);
  });

  onBeforeUnmount(() => {
    const current = host;
    host = null;
    current?.destroy();
  });

  // The getter returns a fresh snapshot object, so the watcher fires whenever
  // any prop it reads changes; before mount `host` is null and updates no-op.
  watch(getChartProps, (next) => {
    host?.update(next);
  });

  return {
    containerRef,
    refresh: () => {
      host?.refresh();
    }
  };
}
