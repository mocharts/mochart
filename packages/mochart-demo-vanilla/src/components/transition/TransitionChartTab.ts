import type { MochartConfig } from '@mochart/core';

import { demoText } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon, setActiveClass, tabContainer } from '../misc/dom';
import { mountChart } from '../misc/chartHost';

import type { ChartDataProviderLike } from '../../types';

export interface TransitionChartTabProps {
  active?: boolean;
  mochartConfig: MochartConfig;
  dataProviders: ChartDataProviderLike[];
}

export interface TransitionChartTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  update(next: { mochartConfig: MochartConfig; dataProviders: ChartDataProviderLike[] }): void;
  destroy(): void;
}

export function transitionChartTab(props: TransitionChartTabProps): TransitionChartTabHandle {
  let mochartConfig = props.mochartConfig;
  let dataProviders = props.dataProviders;
  let dataProviderIndex = 0;

  const chartHost = mountChart(
    { mochartConfig, dataProvider: dataProviders[dataProviderIndex] },
    { style: 'flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden;' }
  );
  const chartSizer = el('div', { className: 'transition-chart-sizer' }, [chartHost.el]);

  function syncChart(): void {
    chartHost.update({ mochartConfig, dataProvider: dataProviders[dataProviderIndex] });
  }

  function onStepBack(): void {
    if (dataProviders.length > 1) {
      dataProviderIndex = dataProviderIndex === 0 ? dataProviders.length - 1 : dataProviderIndex - 1;
      syncChart();
    }
  }

  function onStepForward(): void {
    if (dataProviders.length > 1) {
      dataProviderIndex = dataProviderIndex === dataProviders.length - 1 ? 0 : dataProviderIndex + 1;
      syncChart();
    }
  }

  const backButton = buttonWithTooltip({
    id: 'transition-back', label: demoText.transitionChartTab.back.label, ariaLabel: demoText.transitionChartTab.back.aria,
    tooltipText: demoText.transitionChartTab.back.tooltip,
    onClick: onStepBack,
    content: [icon('backward-step', { size: 'lg', fixedWidth: true })]
  });
  const forwardButton = buttonWithTooltip({
    id: 'transition-forward', label: demoText.transitionChartTab.next.label, ariaLabel: demoText.transitionChartTab.next.aria,
    tooltipText: demoText.transitionChartTab.next.tooltip,
    onClick: onStepForward,
    content: [icon('forward-step', { size: 'lg', fixedWidth: true })]
  });

  const container = tabContainer('demo-layout-col chart', props.active, [
    chartSizer,
    el('div', { className: 'transition-controls' }, [
      el('form', {}, [
        el('div', { className: 'demo-field' }, [
          el('div', { className: 'demo-toolbar' }, [
            el('div', { className: 'demo-btn-group' }, [backButton.el, forwardButton.el])
          ])
        ])
      ])
    ])
  ], 'chart');

  return {
    el: container,
    setActive(active: boolean) {
      setActiveClass(container, active);
    },
    update(next: { mochartConfig: MochartConfig; dataProviders: ChartDataProviderLike[] }) {
      if (next.mochartConfig !== mochartConfig || next.dataProviders !== dataProviders) {
        mochartConfig = next.mochartConfig;
        dataProviders = next.dataProviders;
        dataProviderIndex = 0;
        syncChart();
      }
    },
    destroy() {
      chartHost.destroy();
    }
  };
}
