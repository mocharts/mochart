import { buildMochartDemoConfig, demoText } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { demoTabs } from '../misc/DemoTabs';
import { el } from '../misc/dom';
import { topBar } from '../misc/TopBar';
import { randomContent } from './RandomContent';
import type { RandomContentHandle } from './RandomContent';

import type { DemoData, MochartDemoConfig, RandomConfigWithValid } from '../../types';

export interface DemoRandomProps {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  onBackToDemos: () => void;
  randomId: number;
  incrementRandomId: () => void;
  decrementRandomId: () => void;
}

export interface DemoRandomHandle {
  el: HTMLElement;
  update(initialDemoId: string, randomId: number): void;
  destroy(): void;
}

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

export function demoRandom(props: DemoRandomProps): DemoRandomHandle {
  const { demoData, onModeChanged, onBackToDemos, incrementRandomId, decrementRandomId } = props;

  let initialDemoId = props.initialDemoId;
  let randomId = props.randomId;
  let activeKey = eventKeyChart;

  function buildStateForDemo(currentDemoId: string): { mochartDemoConfig: MochartDemoConfig; randomConfig: RandomConfigWithValid; generator?: string } {
    const demo = demoData.demoObjectMap[currentDemoId];
    return {
      mochartDemoConfig: buildMochartDemoConfig(demo.config),
      randomConfig: Object.assign({}, demo.random, { valid: true }),
      generator: demo.generator
    };
  }

  let demoState = buildStateForDemo(initialDemoId);

  const content: RandomContentHandle = randomContent({
    mochartDemoConfig: demoState.mochartDemoConfig,
    initialRandomConfig: demoState.randomConfig,
    generator: demoState.generator,
    activeKey,
    eventKeys: { eventKeyChart, eventKeyConfig, eventKeyData },
    randomId,
    incrementRandomId,
    decrementRandomId
  });

  const tabs = demoTabs({
    tabs: [
      { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
      { name: 'config', key: eventKeyConfig, label: demoText.tabs.randomConfig },
      { name: 'data', key: eventKeyData, label: demoText.tabs.data }
    ],
    activeKey,
    onSelect: handleSelect
  });

  const bar = topBar({
    siteRootUrl: props.siteRootUrl,
    onBackToDemos,
    tabs: tabs.el,
    notes: demoData.demoObjectMap[initialDemoId],
    modes: { demoMode: 'random', onModeChanged }
  });

  const container = el('div', { className: 'mochart-demo-container multi' }, [
    bar.el,
    el('div', { className: 'mochart-demo-content-pane' }, [content.el])
  ]);

  function handleSelect(nextActiveKey: number): void {
    activeKey = nextActiveKey;
    sync();
  }

  function sync(): void {
    tabs.sync(activeKey);
    content.setActiveKey(activeKey);
  }

  sync();

  return {
    el: container,
    update(nextInitialDemoId: string, nextRandomId: number) {
      const demoIdChanged = nextInitialDemoId !== initialDemoId;
      const randomIdChanged = nextRandomId !== randomId;
      if (!demoIdChanged && !randomIdChanged) {
        return;
      }
      if (demoIdChanged) {
        initialDemoId = nextInitialDemoId;
        activeKey = eventKeyChart;
        const nextDemo = demoData.demoObjectMap[nextInitialDemoId];
        bar.setDemo(nextDemo.title, nextDemo.notes);
        demoState = buildStateForDemo(nextInitialDemoId);
      }
      randomId = nextRandomId;
      content.update({
        mochartDemoConfig: demoState.mochartDemoConfig,
        initialRandomConfig: demoState.randomConfig,
        generator: demoState.generator,
        randomId
      });
      sync();
    },
    destroy() {
      bar.destroy();
      content.destroy();
    }
  };
}
