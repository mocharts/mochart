import { getDataErrors } from '@mochart/core';

import { el, errorTab } from '../misc/dom';
import type { ErrorTabHandle } from '../misc/dom';
import { randomChartTab } from './RandomChartTab';
import type { RandomChartTabHandle } from './RandomChartTab';
import { randomConfigTab } from './RandomConfigTab';
import type { RandomConfigTabHandle } from './RandomConfigTab';
import { randomDataTab } from './RandomDataTab';
import type { RandomDataTabHandle } from './RandomDataTab';

import { consumeShareState, createErrorDataProvider, demoText, generateDemoDataProvider, getRandomDataObjects, neutralizeRandomReuse, restoreSharedRandomConfig } from '@mochart/demo-common';

import type { MochartDemoConfig, RandomConfigWithValid, DemoDataProvider } from '../../types';

interface EventKeys {
  eventKeyChart: number;
  eventKeyConfig: number;
  eventKeyData: number;
}

export interface RandomContentProps {
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

export interface RandomContentHandle {
  el: HTMLElement;
  setActiveKey(activeKey: number): void;
  update(next: {
    mochartDemoConfig: MochartDemoConfig;
    initialRandomConfig: RandomConfigWithValid;
    generator?: string;
    randomId: number;
  }): void;
  destroy(): void;
}

export function randomContent(props: RandomContentProps): RandomContentHandle {
  const { eventKeys, incrementRandomId, decrementRandomId } = props;
  const { eventKeyChart, eventKeyConfig, eventKeyData } = eventKeys;

  let mochartDemoConfig = props.mochartDemoConfig;
  let initialRandomConfig = props.initialRandomConfig;
  let generator = props.generator;
  let randomId = props.randomId;
  let activeKey = props.activeKey;

  // A share link restores the generator config, reuse toggle and interval (the
  // step comes from the randomId in the URL path). Consume it once at mount.
  const shared = consumeShareState('random');
  const sharedRandom = shared && shared.mode === 'random' ? shared : null;

  let randomConfig: RandomConfigWithValid = sharedRandom
    ? restoreSharedRandomConfig(sharedRandom.randomConfig, generator)
    : initialRandomConfig;
  let dataProvider: DemoDataProvider | null = null;
  let data: unknown = null;
  // Reuse defaults on to match the generator's historical behavior (the
  // config's reuse settings were always applied before the toggle worked).
  let applyReuse = sharedRandom ? sharedRandom.applyReuse : true;
  const initialRate = sharedRandom ? sharedRandom.interval : undefined;

  function updateDataProvider(forcedRandomConfig?: RandomConfigWithValid): void {
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
    syncChildren();
  }

  function toggleApplyReuse(): void {
    applyReuse = !applyReuse;
    updateDataProvider();
  }

  // Regenerate immediately so Apply/Reset on the Random Config tab visibly
  // take effect instead of waiting for the next randomize.
  function onUpdateConfig(nextRandomConfig: RandomConfigWithValid): void {
    updateDataProvider(nextRandomConfig);
  }

  function onResetConfig(): void {
    updateDataProvider(initialRandomConfig);
  }

  // ---------------------------------------------------------------------
  // children
  // ---------------------------------------------------------------------

  const chart: RandomChartTabHandle = randomChartTab({
    active: activeKey === eventKeyChart,
    mochartConfig: mochartDemoConfig.mochartConfig,
    dataProvider,
    randomConfig,
    initialRate,
    onRandomizeBack: decrementRandomId,
    onRandomizeNext: incrementRandomId,
    applyReuse,
    toggleApplyReuse
  });
  const config: RandomConfigTabHandle = randomConfigTab({
    active: activeKey === eventKeyConfig,
    randomConfig,
    getGenerator: () => generator,
    onUpdate: onUpdateConfig,
    onReset: onResetConfig
  });
  const dataView: RandomDataTabHandle = randomDataTab({
    active: activeKey === eventKeyData,
    data
  });

  const chartBoundary: ErrorTabHandle = errorTab(() => chart.el, activeKey === eventKeyChart);
  const configBoundary: ErrorTabHandle = errorTab(() => config.el, activeKey === eventKeyConfig);
  const dataBoundary: ErrorTabHandle = errorTab(() => dataView.el, activeKey === eventKeyData);

  const container = el('div', { className: 'mochart-demo-content' }, [
    chartBoundary.el, configBoundary.el, dataBoundary.el
  ]);

  function syncChildren(): void {
    chartBoundary.guard(() => chart.update({
      mochartConfig: mochartDemoConfig.mochartConfig,
      dataProvider,
      applyReuse,
      randomConfig
    }));
    configBoundary.guard(() => config.setRandomConfig(randomConfig));
    dataBoundary.guard(() => dataView.setData(data));
  }

  // Seed from the (possibly share-restored) config rather than the demo default.
  updateDataProvider(randomConfig);

  return {
    el: container,
    setActiveKey(nextActiveKey: number) {
      activeKey = nextActiveKey;
      chartBoundary.setActive(activeKey === eventKeyChart);
      configBoundary.setActive(activeKey === eventKeyConfig);
      dataBoundary.setActive(activeKey === eventKeyData);
      chartBoundary.guard(() => chart.setActive(activeKey === eventKeyChart));
      configBoundary.guard(() => config.setActive(activeKey === eventKeyConfig));
      dataBoundary.guard(() => dataView.setActive(activeKey === eventKeyData));
    },
    update(next) {
      const demoChanged = next.initialRandomConfig !== initialRandomConfig ||
        next.mochartDemoConfig !== mochartDemoConfig;
      const randomIdChanged = next.randomId !== randomId;
      mochartDemoConfig = next.mochartDemoConfig;
      initialRandomConfig = next.initialRandomConfig;
      generator = next.generator;
      randomId = next.randomId;
      if (demoChanged) {
        updateDataProvider(next.initialRandomConfig);
      }
      else if (randomIdChanged) {
        updateDataProvider();
      }
    },
    destroy() {
      chart.destroy();
      config.destroy();
      dataView.destroy();
    }
  };
}
