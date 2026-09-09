import { demoText } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { staticDemoTabs } from '../misc/DemoTabs';
import { el, errorTab } from '../misc/dom';
import type { ErrorTabHandle } from '../misc/dom';
import { topBar } from '../misc/TopBar';
import { chartsTab } from './ChartsTab';
import type { ChartsTabHandle } from './ChartsTab';

import type { DemoData } from '../../types';

export interface DemoMultiProps {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  onBackToDemos: () => void;
}

export interface DemoMultiHandle {
  el: HTMLElement;
  update(initialDemoId: string): void;
  destroy(): void;
}

export function demoMulti(props: DemoMultiProps): DemoMultiHandle {
  const { demoData, onModeChanged, onBackToDemos } = props;

  let initialDemoId = props.initialDemoId;

  const charts: ChartsTabHandle = chartsTab({
    active: true,
    demoObject: demoData.demoObjectMap[initialDemoId]
  });
  const chartsBoundary: ErrorTabHandle = errorTab(() => charts.el, true);

  const bar = topBar({
    siteRootUrl: props.siteRootUrl,
    onBackToDemos,
    // One pane, so the strip is a caption rather than a tablist.
    tabs: staticDemoTabs(demoText.tabs.chart),
    notes: demoData.demoObjectMap[initialDemoId],
    modes: { demoMode: 'multi', onModeChanged }
  });

  const container = el('div', { className: 'mochart-demo-container multi' }, [
    bar.el,
    el('div', { className: 'mochart-demo-content-pane' }, [
      el('div', { className: 'mochart-demo-content' }, [chartsBoundary.el])
    ])
  ]);

  return {
    el: container,
    update(nextInitialDemoId: string) {
      if (nextInitialDemoId === initialDemoId) {
        return;
      }
      initialDemoId = nextInitialDemoId;
      const nextDemo = demoData.demoObjectMap[nextInitialDemoId];
      bar.setDemo(nextDemo.title, nextDemo.notes);
      chartsBoundary.guard(() => charts.setDemoObject(nextDemo));
    },
    destroy() {
      bar.destroy();
      charts.destroy();
    }
  };
}
