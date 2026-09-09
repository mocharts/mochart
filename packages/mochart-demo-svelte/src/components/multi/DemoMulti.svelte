<script lang="ts">
  import { demoText } from '@mochart/demo-common';
  import type { SwitchableDemoMode } from '@mochart/demo-common';

  import ChartsTab from './ChartsTab.svelte';
  import ErrorTab from '../misc/ErrorTab.svelte';
  import StaticDemoTabs from '../misc/StaticDemoTabs.svelte';
  import TopBar from '../misc/TopBar.svelte';

  import type { DemoData } from '../../types';

  interface Props {
    demoData: DemoData;
    initialDemoId: string;
    siteRootUrl?: string;
    onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
    onBackToDemos: () => void;
  }

  let { demoData, initialDemoId, siteRootUrl = undefined, onModeChanged, onBackToDemos }: Props = $props();

  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs everything when the routed demo changes.
  // svelte-ignore state_referenced_locally
  let demoId = $state(initialDemoId);

  // svelte-ignore state_referenced_locally
  let previousInitialDemoId = initialDemoId;
  $effect.pre(() => {
    if (initialDemoId !== previousInitialDemoId) {
      previousInitialDemoId = initialDemoId;
      demoId = initialDemoId;
    }
  });
</script>

<div class="mochart-demo-container multi">
  <TopBar {siteRootUrl} {onBackToDemos}
          notes={demoData.demoObjectMap[demoId]}
          modes={{ demoMode: 'multi', onModeChanged }}>
    <!-- One pane, so the strip is a caption rather than a tablist. -->
    {#snippet tabs()}
      <StaticDemoTabs label={demoText.tabs.chart} />
    {/snippet}
  </TopBar>
  <div class="mochart-demo-content-pane">
    <div class="mochart-demo-content">
      <ErrorTab active={true}>
        <ChartsTab active={true} demoObject={demoData.demoObjectMap[demoId]} />
      </ErrorTab>
    </div>
  </div>
</div>
