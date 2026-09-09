import { useState } from 'react';

import type { MochartConfig } from '@mochart/core';

import { defaultTransitionConfig, demoText, getTransitionDataProviders, getTransitionMochartConfig } from '@mochart/demo-common';

import TransitionMochartChartTab from './TransitionChartTab';
import TransitionMochartConfigTab from './TransitionConfigTab';
import DemoTabs from '../misc/DemoTabs';
import TopBar from '../misc/TopBar';

import type { TransitionConfig, ChartDataProviderLike, OnBackToDemos } from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;

interface DemoTransitionProps {
  siteRootUrl?: string;
  onBackToDemos: OnBackToDemos;
}

export default function MochartDemoTransition({ siteRootUrl, onBackToDemos }: DemoTransitionProps) {
  const [activeKey, setActiveKey] = useState(eventKeyChart);

  const handleSelect = (nextActiveKey: number) => setActiveKey(nextActiveKey);

  return (
    <div className="mochart-demo-container multi">
      <TopBar siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos}
        tabs={
          <DemoTabs activeKey={activeKey} onSelect={handleSelect}
            tabs={[
              { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
              { name: 'config', key: eventKeyConfig, label: demoText.tabs.transitionConfig }
            ]} />
        } />
      <div className="mochart-demo-content-pane">
        <TransitionMochartDemoContent activeKey={activeKey} />
      </div>
    </div>
  );
}

interface ContentState {
  transitionConfig: TransitionConfig;
  mochartConfig: MochartConfig;
  dataProviders: ChartDataProviderLike[];
}

function TransitionMochartDemoContent({ activeKey }: { activeKey: number }) {
  const [state, setState] = useState<ContentState>(() => ({
    transitionConfig: defaultTransitionConfig,
    mochartConfig: getTransitionMochartConfig(defaultTransitionConfig),
    dataProviders: getTransitionDataProviders(defaultTransitionConfig)
  }));

  const onUpdateConfig = (transitionConfig: TransitionConfig) => {
    setState({
      transitionConfig,
      mochartConfig: getTransitionMochartConfig(transitionConfig),
      dataProviders: getTransitionDataProviders(transitionConfig)
    });
  };

  const onResetConfig = () => {
    setState({
      transitionConfig: defaultTransitionConfig,
      mochartConfig: getTransitionMochartConfig(defaultTransitionConfig),
      dataProviders: getTransitionDataProviders(defaultTransitionConfig)
    });
  };

  const { transitionConfig, mochartConfig, dataProviders } = state;

  return (
    <div className="mochart-demo-content">
      <TransitionMochartChartTab mochartConfig={mochartConfig} dataProviders={dataProviders}
        active={activeKey === eventKeyChart} />
      <TransitionMochartConfigTab transitionConfig={transitionConfig} onUpdate={onUpdateConfig}
        onReset={onResetConfig} active={activeKey === eventKeyConfig} />
    </div>
  );
}
