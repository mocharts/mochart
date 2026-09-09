
import { defaultTransitionConfig, demoText, getTransitionDataProviders, getTransitionMochartConfig } from '@mochart/demo-common';

import { demoTabs } from '../misc/DemoTabs';
import { el } from '../misc/dom';
import { topBar } from '../misc/TopBar';
import { transitionChartTab } from './TransitionChartTab';
import { transitionConfigTab } from './TransitionConfigTab';

import type { TransitionConfig } from '../../types';

export interface DemoTransitionProps {
  siteRootUrl?: string;
  onBackToDemos: () => void;
}

export interface DemoTransitionHandle {
  el: HTMLElement;
  destroy(): void;
}

const eventKeyChart = 1;
const eventKeyConfig = 2;

export function demoTransition(props: DemoTransitionProps): DemoTransitionHandle {
  let activeKey = eventKeyChart;

  let transitionConfig = defaultTransitionConfig;
  let mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
  let dataProviders = getTransitionDataProviders(defaultTransitionConfig);

  const chart = transitionChartTab({
    active: activeKey === eventKeyChart,
    mochartConfig,
    dataProviders
  });
  const config = transitionConfigTab({
    active: activeKey === eventKeyConfig,
    transitionConfig,
    onUpdate(nextTransitionConfig: TransitionConfig) {
      transitionConfig = nextTransitionConfig;
      mochartConfig = getTransitionMochartConfig(nextTransitionConfig);
      dataProviders = getTransitionDataProviders(nextTransitionConfig);
      chart.update({ mochartConfig, dataProviders });
      config.setTransitionConfig(nextTransitionConfig);
    },
    onReset() {
      transitionConfig = defaultTransitionConfig;
      mochartConfig = getTransitionMochartConfig(defaultTransitionConfig);
      dataProviders = getTransitionDataProviders(defaultTransitionConfig);
      chart.update({ mochartConfig, dataProviders });
      config.setTransitionConfig(defaultTransitionConfig);
    }
  });

  const tabs = demoTabs({
    tabs: [
      { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
      { name: 'config', key: eventKeyConfig, label: demoText.tabs.transitionConfig }
    ],
    activeKey,
    onSelect: handleSelect
  });

  const bar = topBar({
    siteRootUrl: props.siteRootUrl,
    onBackToDemos: props.onBackToDemos,
    tabs: tabs.el
  });

  const container = el('div', { className: 'mochart-demo-container multi' }, [
    bar.el,
    el('div', { className: 'mochart-demo-content-pane' }, [
      el('div', { className: 'mochart-demo-content' }, [chart.el, config.el])
    ])
  ]);

  function handleSelect(nextActiveKey: number): void {
    activeKey = nextActiveKey;
    tabs.sync(activeKey);
    chart.setActive(activeKey === eventKeyChart);
    config.setActive(activeKey === eventKeyConfig);
  }

  return {
    el: container,
    destroy() {
      bar.destroy();
      chart.destroy();
      config.destroy();
    }
  };
}
