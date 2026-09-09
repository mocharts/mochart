<script lang="ts">

  import { defaultTransitionConfig, demoText, getTransitionDataProviders, getTransitionMochartConfig } from '@mochart/demo-common';

  import TransitionChartTab from './TransitionChartTab.svelte';
  import TransitionConfigTab from './TransitionConfigTab.svelte';
  import DemoTabs from '../misc/DemoTabs.svelte';
  import TopBar from '../misc/TopBar.svelte';

  import type { TransitionConfig } from '../../types';

  interface Props {
    siteRootUrl?: string;
    onBackToDemos: () => void;
  }

  let { siteRootUrl = undefined, onBackToDemos }: Props = $props();

  const eventKeyChart = 1;
  const eventKeyConfig = 2;

  let activeKey = $state(eventKeyChart);

  let transitionConfig = $state.raw<TransitionConfig>(defaultTransitionConfig);
  let mochartConfig = $state.raw(getTransitionMochartConfig(defaultTransitionConfig));
  let dataProviders = $state.raw(getTransitionDataProviders(defaultTransitionConfig));

  function handleSelect(nextActiveKey: number) {
    activeKey = nextActiveKey;
  }

  function onUpdateConfig(nextTransitionConfig: TransitionConfig) {
    transitionConfig = nextTransitionConfig;
    mochartConfig = getTransitionMochartConfig(nextTransitionConfig);
    dataProviders = getTransitionDataProviders(nextTransitionConfig);
  }

  function onResetConfig() {
    transitionConfig = defaultTransitionConfig;
    mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
    dataProviders = getTransitionDataProviders(defaultTransitionConfig);
  }
</script>

<div class="mochart-demo-container multi">
  <TopBar {siteRootUrl} {onBackToDemos}>
    {#snippet tabs()}
      <DemoTabs {activeKey} onSelect={handleSelect}
                tabs={[
                  { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
                  { name: 'config', key: eventKeyConfig, label: demoText.tabs.transitionConfig }
                ]} />
    {/snippet}
  </TopBar>
  <div class="mochart-demo-content-pane">
    <div class="mochart-demo-content">
      <TransitionChartTab {mochartConfig} {dataProviders} active={activeKey === eventKeyChart} />
      <TransitionConfigTab {transitionConfig} onUpdate={onUpdateConfig} onReset={onResetConfig}
                           active={activeKey === eventKeyConfig} />
    </div>
  </div>
</div>
