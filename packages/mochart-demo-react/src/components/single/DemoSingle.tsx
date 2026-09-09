import { useState, useEffect, useMemo, useRef } from 'react';

import { consumeSingleShareState, demoText, getConfigDataError } from '@mochart/demo-common';

import MochartChartTab from './ChartTab';
import MochartDataTab from './DataTab';
import MochartConfigTab from './ConfigTab';
import DemoTabs from '../misc/DemoTabs';
import ErrorTab from '../misc/ErrorTab';
import TopBar from '../misc/TopBar';

import type { DemoTabProps, DemoConfig, DataObject } from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

type DataError = string | boolean | null;

export default function MochartDemoSingle({ demoData, initialDemoId, siteRootUrl, onModeChanged, onBackToDemos }: DemoTabProps) {
  const [activeKey, setActiveKey] = useState(eventKeyChart);
  // Applied config/data edits are held until the Chart tab is shown; badge the
  // Chart tab so it's visible that something is waiting there.
  const [hasPending, setHasPending] = useState(false);

  // Reset the active tab whenever the routed demo changes (matches the old
  // UNSAFE_componentWillReceiveProps behavior via the render-phase reset pattern).
  const prevInitialDemoId = useRef(initialDemoId);
  if (prevInitialDemoId.current !== initialDemoId) {
    prevInitialDemoId.current = initialDemoId;
    setActiveKey(eventKeyChart);
  }

  const handleSelect = (nextActiveKey: number) => setActiveKey(nextActiveKey);

  return (
    <div className="mochart-demo-container">
      <TopBar siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos}
        notes={demoData.demoObjectMap[initialDemoId]}
        modes={{ demoMode: 'single', onModeChanged }}
        tabs={
          <DemoTabs activeKey={activeKey} onSelect={handleSelect}
            tabs={[
              { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart, pending: hasPending },
              { name: 'config', key: eventKeyConfig, label: demoText.tabs.config },
              { name: 'data', key: eventKeyData, label: demoText.tabs.data }
            ]} />
        } />
      <MochartDemoContent activeKey={activeKey} demoData={demoData} initialDemoId={initialDemoId}
        onPendingChanged={setHasPending} />
    </div>
  );
}

interface ContentProps {
  demoData: DemoTabProps['demoData'];
  initialDemoId: string;
  activeKey: number;
  onPendingChanged: (hasPending: boolean) => void;
}

interface ContentState {
  demoId: string;
  pendingConfig: DemoConfig | null;
  pendingData: DataObject[] | null;
  pendingDataError: DataError;
  config: DemoConfig;
  data: DataObject[];
  dataError: DataError;
  viewingConfig: DemoConfig;
  viewingData: DataObject[];
  viewingDataError: DataError;
}

function MochartDemoContent(props: ContentProps) {
  const { initialDemoId, activeKey, demoData, onPendingChanged } = props;

  const [state, setState] = useState<ContentState>(() => {
    // A share link carries edited config/data in the URL hash; it overrides
    // the demo's own config/data for the initial mount only.
    const shared = consumeSingleShareState();
    const initialConfig = shared?.config ?? demoData.demoObjectMap[initialDemoId].config;
    const initialData = shared?.data ?? demoData.demoObjectMap[initialDemoId].data;
    return {
      demoId: initialDemoId,
      pendingConfig: null,
      pendingData: null,
      pendingDataError: false,
      config: initialConfig,
      data: initialData,
      dataError: false,
      viewingConfig: initialConfig,
      viewingData: initialData,
      viewingDataError: false
    };
  });

  // Reload the demo's config/data when the routed demo changes; the pending
  // config/data are promoted straight to the chart by the effect below (the
  // parent resets the active tab back to Chart at the same time).
  const prevInitialDemoId = useRef(initialDemoId);
  if (prevInitialDemoId.current !== initialDemoId) {
    prevInitialDemoId.current = initialDemoId;
    const config = demoData.demoObjectMap[initialDemoId].config;
    const data = demoData.demoObjectMap[initialDemoId].data;
    setState(prev => ({ ...prev, demoId: initialDemoId, config, data, dataError: null, pendingConfig: config, pendingData: data }));
  }

  // Promote pending config/data edits to the visible chart when the Chart tab
  // is (re)shown, so a single combined change animates.
  useEffect(() => {
    if (activeKey === eventKeyChart) {
      setState(prev => {
        const { pendingConfig, pendingData, pendingDataError } = prev;
        if (pendingConfig !== null || pendingData !== null || pendingDataError !== null) {
          const next = { ...prev };
          if (pendingConfig !== null) {
            next.viewingConfig = pendingConfig;
            next.pendingConfig = null;
          }
          if (pendingData !== null) {
            next.viewingData = pendingData;
            next.pendingData = null;
          }
          if (pendingDataError !== null) {
            next.viewingDataError = pendingDataError;
            next.pendingDataError = null;
          }
          return next;
        }
        return prev;
      });
    }
  }, [activeKey, initialDemoId]);

  // Report whether config/data edits are queued so the parent can badge the
  // Chart tab.
  const { pendingConfig: reportPendingConfig, pendingData: reportPendingData } = state;
  useEffect(() => {
    onPendingChanged(reportPendingConfig !== null || reportPendingData !== null);
  }, [onPendingChanged, reportPendingConfig, reportPendingData]);

  const onConfigChange = (pendingConfig: DemoConfig) => setState(prev => ({ ...prev, pendingConfig }));

  const onConfigReset = () => {
    const resetConfig = { ...demoData.demoObjectMap[state.demoId].config };
    setState(prev => ({ ...prev, pendingConfig: resetConfig, config: resetConfig }));
  };

  const onDataChange = (pendingData: DataObject[]) => setState(prev => ({ ...prev, pendingData, pendingDataError: false }));

  const onDataError = (errorMessage: string) => setState(prev => ({ ...prev, pendingDataError: errorMessage }));

  const onDataReset = () => {
    // give it a new array reference so children know to update
    const resetData = demoData.demoObjectMap[state.demoId].data.slice();
    setState(prev => ({ ...prev, pendingData: resetData, pendingDataError: false }));
  };

  const { viewingConfig, viewingData, viewingDataError, config, data } = state;

  // editor-reported error, or the viewing config/data pair failing validation
  const derivedDataError = useMemo(() => getConfigDataError(viewingConfig, viewingData), [viewingConfig, viewingData]);

  return (
    <div className="mochart-demo-content-pane">
      <div className="mochart-demo-content">
        <ErrorTab active={activeKey === eventKeyChart}>
          <MochartChartTab config={viewingConfig} data={viewingData} dataError={viewingDataError || derivedDataError} />
        </ErrorTab>
        <ErrorTab active={activeKey === eventKeyConfig}>
          <MochartConfigTab config={config} onConfigChange={onConfigChange} onConfigReset={onConfigReset} />
        </ErrorTab>
        <ErrorTab active={activeKey === eventKeyData}>
          <MochartDataTab config={viewingConfig} data={data} onDataChange={onDataChange}
            onDataError={onDataError} onDataReset={onDataReset} />
        </ErrorTab>
      </div>
    </div>
  );
}
