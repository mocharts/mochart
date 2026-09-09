<script setup lang="ts">
// Mounts a live mochart chart from a raw config + dataset. The chart module
// is imported on mount so pages stay SSR-safe, and the chart width tracks the
// container so examples stay responsive.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { encodeShareState, getChartExportOptions, shareHashPrefix } from '@mochart/demo-common';
import type { DemoConfig, ShowcaseMode } from '@mochart/demo-common';

interface ChartHandle {
  update(props: Record<string, unknown>): void;
  destroy(): void;
}

const props = withDefaults(defineProps<{
  config: Record<string, unknown>;
  data: Record<string, unknown>[];
  altData?: Record<string, unknown>[];
  height?: number;
  demoLink?: boolean;
  /** Vanilla-gallery demo slug to host the share link (see demos.json ids). */
  demo?: string;
  /** Link to a vanilla-gallery showcase page instead of a single demo. */
  showcase?: ShowcaseMode;
  /** Show Download SVG / Download PNG buttons (the export guide's live demo). */
  exportButtons?: boolean;
  /** CSS color set on the chart host — shows chrome following `currentColor`. */
  color?: string;
  /** Wire the click/focus/filter callbacks and log the last few events under the chart. */
  events?: boolean;
  /** Extra createDefaultChart props: `loading`, `error`, state factories, size overrides. */
  chartProps?: Record<string, unknown>;
  /** Render a button that flips the given state prop live (the chart-states guide). */
  toggle?: 'loading' | 'error';
  /** Render a select that applies the chosen animation.easing live (the staged-animation guide). */
  easingPicker?: boolean;
}>(), {
  altData: undefined,
  height: 320,
  demoLink: true,
  demo: 'stacked',
  showcase: undefined,
  exportButtons: false,
  color: undefined,
  events: false,
  chartProps: undefined,
  toggle: undefined,
  easingPicker: false
});

// Deep link into the vanilla gallery with this chart's config/data as the
// share payload (see demo-common shareState) — the payload overrides the
// host demo's config and data, so the chart shown is exactly this example.
// Pages should pass the closest matching demo slug via `demo` so the URL
// reads right and stripping the hash lands somewhere sensible. Resolves only
// on the assembled site, where the galleries sit next to the docs.
const demoUrl = computed(() => {
  if (!props.demoLink) {
    return null;
  }
  // Showcase pages are curated, so they get a plain link without a payload.
  if (props.showcase !== undefined) {
    return import.meta.env.BASE_URL + 'vanilla/' + props.showcase;
  }
  const payload = encodeShareState({
    mode: 'single',
    config: props.config as DemoConfig,
    data: props.data
  });
  return import.meta.env.BASE_URL + 'vanilla/single/' + props.demo + '/' + shareHashPrefix + payload;
});

const demoLinkTitle = computed(() => props.showcase === undefined
  ? "Open this chart in the demo gallery's editor"
  : `Open the ${props.showcase} showcase in the demo gallery`);

const host = ref<HTMLElement | null>(null);
const showingAlt = ref(false);
// filled on mount from the chart module, the list the config validator accepts
const easings = ref<string[]>([]);
const selectedEasing = ref(String((props.config.animation as Record<string, unknown> | undefined)?.easing ?? 'sineInOut'));
let chart: ChartHandle | null = null;
let observer: ResizeObserver | null = null;

// Rolling log of the chart's reported events, in console order (newest last).
// Payloads render as JSON because the log's job is teaching their shapes.
interface LoggedEvent { key: number; name: string; payload: string | null }
const eventLog = ref<LoggedEvent[]>([]);
const eventList = ref<HTMLElement | null>(null);
let eventKey = 0;

function logEvent(name: string, payload?: unknown) {
  // follow the tail like a console — unless the reader scrolled up to older entries
  const list = eventList.value;
  const following = list === null || list.scrollHeight - list.scrollTop - list.clientHeight < 8;
  eventLog.value = [
    ...eventLog.value,
    { key: eventKey++, name, payload: payload === undefined ? null : JSON.stringify(payload) }
    // safety valve only — hover focus events accumulate fast on a long-lived page
  ].slice(-100);
  if (following) {
    void nextTick(() => {
      const el = eventList.value;
      if (el !== null) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}

onMounted(async () => {
  const { createDefaultChart, EASINGS } = await import('@mochart/core');
  if (props.easingPicker) {
    easings.value = [...EASINGS];
  }
  const el = host.value;
  if (el === null) {
    return;
  }
  const eventProps = props.events ? {
    onFocus: (payload: unknown) => logEvent('onFocus', payload),
    onSeriesFilter: (payload: unknown) => logEvent('onSeriesFilter', payload),
    onChartClick: (payload: unknown) => logEvent('onChartClick', payload),
    onSliceClick: (payload: unknown) => logEvent('onSliceClick', payload),
    onSeriesClick: (payload: unknown) => logEvent('onSeriesClick', payload),
    onTitleClick: () => logEvent('onTitleClick')
  } : {};
  chart = createDefaultChart(el, {
    config: props.config,
    data: props.data,
    width: el.clientWidth,
    height: props.height,
    ...eventProps,
    ...props.chartProps
  }) as ChartHandle;
  observer = new ResizeObserver(() => {
    // an explicit width override (the no-size demo) must not be clobbered
    if (props.chartProps?.width === undefined) {
      chart?.update({ width: el.clientWidth });
    }
  });
  observer.observe(el);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  chart?.destroy();
  chart = null;
});

function applyEasing() {
  if (chart === null) {
    return;
  }
  const animation = { ...(props.config.animation as Record<string, unknown> | undefined ?? {}), easing: selectedEasing.value };
  chart.update({ config: { ...props.config, animation } });
}

function toggleData() {
  if (chart === null || props.altData === undefined) {
    return;
  }
  showingAlt.value = !showingAlt.value;
  chart.update({ data: showingAlt.value ? props.altData : props.data });
}

// The chart-states guide's live loading/error switch. Starts from whatever
// the chartProps passthrough set; toggling off an error clears it with null.
const stateActive = ref(props.toggle === 'loading'
  ? props.chartProps?.loading === true
  : props.toggle === 'error' && props.chartProps?.error != null);

const stateLabel = computed(() => props.toggle === 'loading'
  ? (stateActive.value ? 'Finish loading' : 'Start loading')
  : (stateActive.value ? 'Clear error' : 'Trigger error'));

function toggleState() {
  if (chart === null || props.toggle === undefined) {
    return;
  }
  stateActive.value = !stateActive.value;
  if (props.toggle === 'loading') {
    chart.update({ loading: stateActive.value });
  }
  else {
    chart.update({ error: stateActive.value ? props.chartProps?.error ?? 'Something went wrong' : null });
  }
}

// Imported on click for the same SSR-safety reason as the chart module; the
// background color follows the site theme so dark-mode text stays readable.
async function download(format: 'svg' | 'png') {
  const el = host.value;
  if (el === null) {
    return;
  }
  const { exportSVG, exportPNG } = await import('@mochart/export');
  if (format === 'svg') {
    exportSVG(el, getChartExportOptions());
  } else {
    await exportPNG(el, getChartExportOptions());
  }
}
</script>

<template>
  <div class="live-chart">
    <!-- The card carries the padding/border; the chart measures the unpadded
         host, so clientWidth is the true content width. -->
    <div class="live-chart-card">
      <div ref="host" class="live-chart-host" :style="{ height: height + 'px', color: color }" />
    </div>
    <div v-if="events" class="live-chart-events">
      <template v-if="eventLog.length > 0">
        <button type="button" class="live-chart-events-clear" @click="eventLog = []">
          Clear
        </button>
        <div ref="eventList" class="live-chart-events-list">
          <div v-for="entry in eventLog" :key="entry.key" class="live-chart-event">
            <span class="live-chart-event-name">{{ entry.name }}</span>
            <span v-if="entry.payload !== null" class="live-chart-event-payload">{{ entry.payload }}</span>
          </div>
        </div>
      </template>
      <div v-else class="live-chart-events-hint">
        Interact with the chart — its events appear here.
      </div>
    </div>
    <div v-if="altData || exportButtons || demoUrl || toggle || easingPicker" class="live-chart-controls">
      <label v-if="easingPicker" class="live-chart-easing">
        easing
        <select v-model="selectedEasing" @change="applyEasing">
          <option v-for="easingName in easings" :key="easingName" :value="easingName">{{ easingName }}</option>
        </select>
      </label>
      <button v-if="toggle" type="button" @click="toggleState">
        {{ stateLabel }}
      </button>
      <button v-if="altData" type="button" @click="toggleData">
        {{ showingAlt ? 'Animate back' : 'Animate to new data' }}
      </button>
      <button v-if="exportButtons" type="button" @click="download('svg')">
        Download SVG
      </button>
      <button v-if="exportButtons" type="button" @click="download('png')">
        Download PNG
      </button>
      <!-- target=_self keeps VitePress's SPA router from intercepting the
           navigation into the (non-VitePress) demo gallery. -->
      <a v-if="demoUrl" class="live-chart-demo-link" :href="demoUrl" target="_self" :title="demoLinkTitle">
        Open in demo ↗
      </a>
    </div>
  </div>
</template>
