<script lang="ts">
  import { untrack } from 'svelte';

  import { getDataErrors } from '@mochart/core';

  import RandomChartTab from './RandomChartTab.svelte';
  import RandomConfigTab from './RandomConfigTab.svelte';
  import RandomDataTab from './RandomDataTab.svelte';
  import ErrorTab from '../misc/ErrorTab.svelte';

  import { consumeShareState, createErrorDataProvider, demoText, generateDemoDataProvider, getRandomDataObjects, neutralizeRandomReuse, restoreSharedRandomConfig } from '@mochart/demo-common';

  import type { MochartDemoConfig, RandomConfigWithValid, DemoDataProvider } from '../../types';

  interface EventKeys {
    eventKeyChart: number;
    eventKeyConfig: number;
    eventKeyData: number;
  }

  interface Props {
    mochartDemoConfig: MochartDemoConfig;
    initialRandomConfig: RandomConfigWithValid;
    /** The demo's chart-type generator id, if it has one (demos.json). */
    generator?: string;
    activeKey: number;
    eventKeys: EventKeys;
    randomId: number;
    incrementRandomId: () => void;
    decrementRandomId: () => void;
  }

  let {
    mochartDemoConfig,
    initialRandomConfig,
    generator = undefined,
    activeKey,
    eventKeys,
    randomId,
    incrementRandomId,
    decrementRandomId
  }: Props = $props();

  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs everything when the inputs change.
  // svelte-ignore state_referenced_locally
  const { eventKeyChart, eventKeyConfig, eventKeyData } = eventKeys;

  // A share link restores the generator config, reuse toggle and interval (the
  // step comes from the randomId in the URL path). Consume it once at mount.
  const sharedState = consumeShareState('random');
  const shared = sharedState && sharedState.mode === 'random' ? sharedState : null;
  // svelte-ignore state_referenced_locally
  const initialResolvedRandomConfig: RandomConfigWithValid = shared ? restoreSharedRandomConfig(shared.randomConfig, generator) : initialRandomConfig;
  const initialRate = shared ? shared.interval : undefined;

  // svelte-ignore state_referenced_locally
  let randomConfig = $state.raw<RandomConfigWithValid>(initialResolvedRandomConfig);
  let dataProvider = $state.raw<DemoDataProvider | null>(null);
  let data = $state.raw<unknown>(null);
  // Reuse defaults on to match the generator's historical behavior (the
  // config's reuse settings were always applied before the toggle worked).
  let applyReuse = $state(shared ? shared.applyReuse : true);

  function toggleApplyReuse() {
    applyReuse = !applyReuse;
    updateDataProvider();
  }

  function updateDataProvider(forcedRandomConfig?: RandomConfigWithValid) {
    const { mochartConfig } = mochartDemoConfig;
    const nextRandomConfig = forcedRandomConfig !== undefined ? forcedRandomConfig : randomConfig;

    if (nextRandomConfig.valid) {
      // with reuse off the generator gets a config whose reuse settings are
      // neutralized, so every dataset is generated independently
      const generatorConfig = applyReuse ? nextRandomConfig : neutralizeRandomReuse(nextRandomConfig);
      const nextDataProvider = generateDemoDataProvider(generator, mochartConfig, generatorConfig, randomId);
      const { categoryValues = [], seriesValues = {} } = nextDataProvider;
      const nextData = getRandomDataObjects(mochartConfig, categoryValues, seriesValues);
      const dataErrors = getDataErrors(mochartConfig, nextDataProvider);
      if (dataErrors.length > 0) {
        console.error('data errors: ', dataErrors);
        console.warn('category values: ', categoryValues);
        console.warn('series values: ', seriesValues);
        dataProvider = createErrorDataProvider(demoText.errors.creatingDataProvider);
        data = { error: demoText.errors.creatingDataProvider };
        randomConfig = nextRandomConfig;
      }
      else {
        dataProvider = nextDataProvider;
        data = nextData;
        randomConfig = nextRandomConfig;
      }
    }
    else {
      dataProvider = createErrorDataProvider(demoText.errors.invalidRandomConfig);
      data = {
        error: demoText.errors.invalidRandomConfig
      };
      randomConfig = nextRandomConfig;
    }
  }

  // svelte-ignore state_referenced_locally
  updateDataProvider(initialResolvedRandomConfig);

  // The routed demo changing swaps both config references at once; a
  // randomize step only changes randomId — regenerate accordingly.
  // svelte-ignore state_referenced_locally
  let previousInitialRandomConfig = initialRandomConfig;
  // svelte-ignore state_referenced_locally
  let previousMochartDemoConfig = mochartDemoConfig;
  // svelte-ignore state_referenced_locally
  let previousRandomId = randomId;
  $effect.pre(() => {
    const nextInitialRandomConfig = initialRandomConfig;
    const nextMochartDemoConfig = mochartDemoConfig;
    const nextRandomId = randomId;
    untrack(() => {
      if (nextInitialRandomConfig !== previousInitialRandomConfig ||
          nextMochartDemoConfig !== previousMochartDemoConfig) {
        previousInitialRandomConfig = nextInitialRandomConfig;
        previousMochartDemoConfig = nextMochartDemoConfig;
        previousRandomId = nextRandomId;
        updateDataProvider(nextInitialRandomConfig);
      }
      else if (nextRandomId !== previousRandomId) {
        previousRandomId = nextRandomId;
        updateDataProvider();
      }
    });
  });

  function onRandomizeBack() {
    decrementRandomId();
  }

  function onRandomizeNext() {
    incrementRandomId();
  }

  // Regenerate immediately so Apply/Reset on the Random Config tab visibly
  // take effect instead of waiting for the next randomize.
  function onUpdateConfig(nextRandomConfig: RandomConfigWithValid) {
    updateDataProvider(nextRandomConfig);
  }

  function onResetConfig() {
    updateDataProvider(initialRandomConfig);
  }
</script>

<div class="mochart-demo-content">
  <ErrorTab active={activeKey === eventKeyChart}>
    <RandomChartTab active={activeKey === eventKeyChart} mochartConfig={mochartDemoConfig.mochartConfig} {dataProvider}
                    {randomConfig} {initialRate}
                    {onRandomizeBack} {onRandomizeNext}
                    {applyReuse} {toggleApplyReuse} />
  </ErrorTab>
  <ErrorTab active={activeKey === eventKeyConfig}>
    <RandomConfigTab active={activeKey === eventKeyConfig} {randomConfig} {generator} onUpdate={onUpdateConfig} onReset={onResetConfig} />
  </ErrorTab>
  <ErrorTab active={activeKey === eventKeyData}>
    <RandomDataTab active={activeKey === eventKeyData} {data} />
  </ErrorTab>
</div>
