<script lang="ts">
  import { untrack } from 'svelte';

  import { Chart } from '@mochart/svelte';
  import type { MochartConfig } from '@mochart/core';

  import { demoText, getDemoTabPanelAttrs } from '@mochart/demo-common';

  import ButtonWithTooltip from '../misc/ButtonWithTooltip.svelte';
  import Icon from '../misc/Icon.svelte';

  import type { ChartDataProviderLike } from '../../types';

  interface Props {
    active?: boolean;
    mochartConfig: MochartConfig;
    dataProviders: ChartDataProviderLike[];
  }

  let { active = false, mochartConfig, dataProviders }: Props = $props();

  let dataProviderIndex = $state(0);

  // Props intentionally seed the previous-value snapshots with their initial
  // value only; the $effect.pre below re-syncs on later prop changes.
  // svelte-ignore state_referenced_locally
  let previousMochartConfig = mochartConfig;
  // svelte-ignore state_referenced_locally
  let previousDataProviders = dataProviders;
  $effect.pre(() => {
    const nextMochartConfig = mochartConfig;
    const nextDataProviders = dataProviders;
    untrack(() => {
      if (nextMochartConfig !== previousMochartConfig || nextDataProviders !== previousDataProviders) {
        previousMochartConfig = nextMochartConfig;
        previousDataProviders = nextDataProviders;
        dataProviderIndex = 0;
      }
    });
  });

  function onStepBack() {
    if (dataProviders.length > 1) {
      if (dataProviderIndex === 0) {
        dataProviderIndex = dataProviders.length - 1;
      }
      else {
        dataProviderIndex--;
      }
    }
  }

  function onStepForward() {
    if (dataProviders.length > 1) {
      if (dataProviderIndex === dataProviders.length - 1) {
        dataProviderIndex = 0;
      }
      else {
        dataProviderIndex++;
      }
    }
  }
</script>

<div {...getDemoTabPanelAttrs('chart')} class={"mochart-demo-tab-container demo-layout-col chart" + (active ? " active" : "")} inert={!active}>
  <div class="transition-chart-sizer">
    <Chart style="flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;"
           {mochartConfig} dataProvider={dataProviders[dataProviderIndex]} />
  </div>
  <div class="transition-controls">
    <form>
      <div class="demo-field">
        <div class="demo-toolbar">
          <div class="demo-btn-group">
            <ButtonWithTooltip id="transition-back" label={demoText.transitionChartTab.back.label} tooltipText={demoText.transitionChartTab.back.tooltip} tooltipPlacement="top-start"
                               onClick={onStepBack} aria-label={demoText.transitionChartTab.back.aria}>
              <Icon size="lg" fixedWidth={true} name="backward-step" />
            </ButtonWithTooltip>
            <ButtonWithTooltip id="transition-forward" label={demoText.transitionChartTab.next.label} tooltipText={demoText.transitionChartTab.next.tooltip} tooltipPlacement="top-start"
                               onClick={onStepForward} aria-label={demoText.transitionChartTab.next.aria}>
              <Icon size="lg" fixedWidth={true} name="forward-step" />
            </ButtonWithTooltip>
          </div>
        </div>
      </div>
    </form>
  </div>
</div>
