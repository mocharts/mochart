<script lang="ts">
  import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';
  import type { SwitchableDemoMode } from '@mochart/demo-common';

  import ChartTab from './ChartTab.svelte';
  import ConfigTab from './ConfigTab.svelte';
  import DataTab from './DataTab.svelte';
  import DemoTabs from '../misc/DemoTabs.svelte';
  import ErrorTab from '../misc/ErrorTab.svelte';
  import TopBar from '../misc/TopBar.svelte';

  import type { DemoData, DemoConfig, DataObject } from '../../types';

  interface Props {
    demoData: DemoData;
    initialDemoId: string;
    siteRootUrl?: string;
    onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
    onBackToDemos: () => void;
  }

  type DataError = string | boolean | null;

  const eventKeyChart = 1;
  const eventKeyConfig = 2;
  const eventKeyData = 3;

  let { demoData, initialDemoId, siteRootUrl = undefined, onModeChanged, onBackToDemos }: Props = $props();

  let activeKey = $state(eventKeyChart);

  // A share link carries edited config/data in the URL hash; it overrides
  // the demo's own config/data for the initial mount only.
  const sharedState = consumeSingleShareState();

  // Config/data edits made on the Config/Data tabs stay "pending" until the
  // Chart tab is shown again (so the chart animates one combined change).
  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs everything when the routed demo changes.
  // svelte-ignore state_referenced_locally
  let demoId = $state(initialDemoId);
  let pendingConfig = $state.raw<DemoConfig | null>(null);
  let pendingData = $state.raw<DataObject[] | null>(null);
  let pendingDataError = $state.raw<DataError>(false);
  // svelte-ignore state_referenced_locally
  let config = $state.raw<DemoConfig>(sharedState?.config ?? demoData.demoObjectMap[initialDemoId].config);
  // svelte-ignore state_referenced_locally
  let data = $state.raw<DataObject[]>(sharedState?.data ?? demoData.demoObjectMap[initialDemoId].data);
  // svelte-ignore state_referenced_locally
  let viewingConfig = $state.raw<DemoConfig>(sharedState?.config ?? demoData.demoObjectMap[initialDemoId].config);
  // svelte-ignore state_referenced_locally
  let viewingData = $state.raw<DataObject[]>(sharedState?.data ?? demoData.demoObjectMap[initialDemoId].data);
  let viewingDataError = $state.raw<DataError>(false);

  function chartShown() {
    if (pendingConfig !== null || pendingData !== null || pendingDataError !== null) {
      if (pendingConfig !== null) {
        viewingConfig = pendingConfig;
        pendingConfig = null;
      }
      if (pendingData !== null) {
        viewingData = pendingData;
        pendingData = null;
      }
      if (pendingDataError !== null) {
        viewingDataError = pendingDataError;
        pendingDataError = null;
      }
    }
  }

  function handleSelect(nextActiveKey: number) {
    const previousActiveKey = activeKey;
    activeKey = nextActiveKey;
    if (nextActiveKey === eventKeyChart && previousActiveKey !== eventKeyChart) {
      chartShown();
    }
  }

  // When the routed demo changes, reload its config/data (and promote them
  // straight to the visible chart, matching the react demo's lifecycle).
  // svelte-ignore state_referenced_locally
  let previousInitialDemoId = initialDemoId;
  $effect.pre(() => {
    if (initialDemoId !== previousInitialDemoId) {
      previousInitialDemoId = initialDemoId;
      activeKey = eventKeyChart;
      demoId = initialDemoId;
      config = demoData.demoObjectMap[initialDemoId].config;
      data = demoData.demoObjectMap[initialDemoId].data;
      pendingConfig = config;
      pendingData = data;
      chartShown();
    }
  });

  function onConfigChange(nextPendingConfig: DemoConfig) {
    pendingConfig = nextPendingConfig;
  }

  function onConfigReset() {
    const resetConfig = { ...demoData.demoObjectMap[demoId].config };
    pendingConfig = resetConfig;
    config = resetConfig;
  }

  function onDataChange(nextPendingData: DataObject[]) {
    pendingData = nextPendingData;
    pendingDataError = false;
  }

  function onDataError(errorMessage: string) {
    pendingDataError = errorMessage;
  }

  function onDataReset() {
    // give it a new array reference so children know to update
    pendingData = demoData.demoObjectMap[demoId].data.slice();
    pendingDataError = false;
  }

  // Applied config/data edits are held until the Chart tab is shown; badge the
  // Chart tab so it's visible that something is waiting there.
  const hasPendingChanges = $derived(activeKey !== eventKeyChart && (pendingConfig !== null || pendingData !== null));

  // editor-reported error, or the viewing config/data pair failing validation
  const chartDataError = $derived(viewingDataError || getConfigDataError(viewingConfig, viewingData));
</script>

<div class="mochart-demo-container">
  <TopBar {siteRootUrl} {onBackToDemos}
          notes={demoData.demoObjectMap[initialDemoId]}
          modes={{ demoMode: 'single', onModeChanged }}>
    {#snippet tabs()}
      <DemoTabs {activeKey} onSelect={handleSelect}
                tabs={[
                  { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart, pending: hasPendingChanges },
                  { name: 'config', key: eventKeyConfig, label: demoText.tabs.config },
                  { name: 'data', key: eventKeyData, label: demoText.tabs.data }
                ]} />
    {/snippet}
  </TopBar>
  <div class="mochart-demo-content-pane">
    <div class="mochart-demo-content">
      <ErrorTab active={activeKey === eventKeyChart}>
        <ChartTab active={activeKey === eventKeyChart} config={viewingConfig} data={viewingData} dataError={chartDataError} />
      </ErrorTab>
      <ErrorTab active={activeKey === eventKeyConfig}>
        <ConfigTab active={activeKey === eventKeyConfig} {config} {onConfigChange} {onConfigReset} />
      </ErrorTab>
      <ErrorTab active={activeKey === eventKeyData}>
        <DataTab active={activeKey === eventKeyData} config={viewingConfig} {data}
                 {onDataChange} {onDataError} {onDataReset} />
      </ErrorTab>
    </div>
  </div>
</div>
