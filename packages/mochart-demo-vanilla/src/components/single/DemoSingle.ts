import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { demoTabs } from '../misc/DemoTabs';
import { el, errorTab } from '../misc/dom';
import type { ErrorTabHandle } from '../misc/dom';
import { topBar } from '../misc/TopBar';
import { chartTab } from './ChartTab';
import type { ChartTabHandle } from './ChartTab';
import { configTab } from './ConfigTab';
import type { ConfigTabHandle } from './ConfigTab';
import { dataTab } from './DataTab';
import type { DataTabHandle } from './DataTab';

import type { DemoData, DemoConfig, DataObject } from '../../types';

export interface DemoSingleProps {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
  onBackToDemos: () => void;
}

export interface DemoSingleHandle {
  el: HTMLElement;
  update(initialDemoId: string): void;
  destroy(): void;
}

type DataError = string | boolean | null;

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

export function demoSingle(props: DemoSingleProps): DemoSingleHandle {
  const { demoData, onModeChanged, onBackToDemos } = props;

  let initialDemoId = props.initialDemoId;
  let activeKey = eventKeyChart;

  // A share link carries edited config/data in the URL hash; it overrides
  // the demo's own config/data for the initial mount only.
  const sharedState = consumeSingleShareState();

  // Config/data edits made on the Config/Data tabs stay "pending" until the
  // Chart tab is shown again (so the chart animates one combined change).
  let demoId = initialDemoId;
  let pendingConfig: DemoConfig | null = null;
  let pendingData: DataObject[] | null = null;
  let pendingDataError: DataError = false;
  let config: DemoConfig = sharedState?.config ?? demoData.demoObjectMap[initialDemoId].config;
  let data: DataObject[] = sharedState?.data ?? demoData.demoObjectMap[initialDemoId].data;
  let viewingConfig: DemoConfig = config;
  let viewingData: DataObject[] = data;
  let viewingDataError: DataError = false;
  // editor-reported error, or the viewing config/data pair failing validation
  let chartDataError: DataError = viewingDataError || getConfigDataError(viewingConfig, viewingData);

  // ---------------------------------------------------------------------
  // children
  // ---------------------------------------------------------------------

  const chart: ChartTabHandle = chartTab({
    active: activeKey === eventKeyChart,
    config: viewingConfig,
    data: viewingData,
    dataError: chartDataError
  });
  const configEditor: ConfigTabHandle = configTab({
    active: activeKey === eventKeyConfig,
    config,
    onConfigChange(nextPendingConfig: DemoConfig) {
      pendingConfig = nextPendingConfig;
      sync();
    },
    onConfigReset() {
      const resetConfig = { ...demoData.demoObjectMap[demoId].config };
      pendingConfig = resetConfig;
      config = resetConfig;
      configBoundary.guard(() => configEditor.setConfig(resetConfig));
      sync();
    }
  });
  const dataEditor: DataTabHandle = dataTab({
    active: activeKey === eventKeyData,
    config: viewingConfig,
    data,
    onDataChange(nextPendingData: DataObject[]) {
      pendingData = nextPendingData;
      pendingDataError = false;
      sync();
    },
    onDataError(errorMessage: string) {
      pendingDataError = errorMessage;
      sync();
    },
    onDataReset() {
      // give it a new array reference so children know to update
      pendingData = demoData.demoObjectMap[demoId].data.slice();
      pendingDataError = false;
      sync();
    }
  });
  const chartBoundary: ErrorTabHandle = errorTab(() => chart.el, activeKey === eventKeyChart);
  const configBoundary: ErrorTabHandle = errorTab(() => configEditor.el, activeKey === eventKeyConfig);
  const dataBoundary: ErrorTabHandle = errorTab(() => dataEditor.el, activeKey === eventKeyData);

  // ---------------------------------------------------------------------
  // tabs header
  // ---------------------------------------------------------------------

  const tabs = demoTabs({
    tabs: [
      { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
      { name: 'config', key: eventKeyConfig, label: demoText.tabs.config },
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
    modes: { demoMode: 'single', onModeChanged }
  });

  const contentPane = el('div', { className: 'mochart-demo-content-pane' }, [
    el('div', { className: 'mochart-demo-content' }, [
      chartBoundary.el, configBoundary.el, dataBoundary.el
    ])
  ]);
  const container = el('div', { className: 'mochart-demo-container' }, [bar.el, contentPane]);

  function chartShown(): void {
    if (pendingConfig !== null || pendingData !== null || pendingDataError !== null) {
      if (pendingConfig !== null) {
        viewingConfig = pendingConfig;
        pendingConfig = null;
      }
      if (pendingData !== null) {
        viewingData = pendingData;
        pendingData = null;
      }
      if (pendingDataError !== null) {
        viewingDataError = pendingDataError;
        pendingDataError = null;
      }
      chartDataError = viewingDataError || getConfigDataError(viewingConfig, viewingData);
      chartBoundary.guard(() => chart.update({ config: viewingConfig, data: viewingData, dataError: chartDataError }));
      dataBoundary.guard(() => dataEditor.setConfig(viewingConfig));
    }
  }

  function handleSelect(nextActiveKey: number): void {
    const previousActiveKey = activeKey;
    activeKey = nextActiveKey;
    if (nextActiveKey === eventKeyChart && previousActiveKey !== eventKeyChart) {
      chartShown();
    }
    sync();
  }

  // Applied config/data edits are held until the Chart tab is shown; badge the
  // Chart tab so it's visible that something is waiting there.
  function sync(): void {
    tabs.sync(activeKey, pendingConfig !== null || pendingData !== null);

    chartBoundary.setActive(activeKey === eventKeyChart);
    configBoundary.setActive(activeKey === eventKeyConfig);
    dataBoundary.setActive(activeKey === eventKeyData);
    chartBoundary.guard(() => chart.setActive(activeKey === eventKeyChart));
    configBoundary.guard(() => configEditor.setActive(activeKey === eventKeyConfig));
    dataBoundary.guard(() => dataEditor.setActive(activeKey === eventKeyData));
  }

  sync();

  return {
    el: container,
    // When the routed demo changes (history navigation between two demos),
    // reload its config/data and promote them straight to the visible chart.
    update(nextInitialDemoId: string) {
      if (nextInitialDemoId === initialDemoId) {
        return;
      }
      initialDemoId = nextInitialDemoId;
      activeKey = eventKeyChart;
      demoId = nextInitialDemoId;
      const nextDemo = demoData.demoObjectMap[nextInitialDemoId];
      bar.setDemo(nextDemo.title, nextDemo.notes);
      config = nextDemo.config;
      data = nextDemo.data;
      pendingConfig = config;
      pendingData = data;
      chartShown();
      configBoundary.guard(() => configEditor.setConfig(config));
      dataBoundary.guard(() => dataEditor.setData(data));
      sync();
    },
    destroy() {
      bar.destroy();
      chart.destroy();
      // Both editors now hold a viewport subscription and an overflow menu (the
      // phone fold of their footers), so they have teardown to do.
      configEditor.destroy();
      dataEditor.destroy();
    }
  };
}
