
import { demoText } from '@mochart/demo-common';

import MultiMochartChartsTab from './ChartsTab';
import { StaticDemoTabs } from '../misc/DemoTabs';
import ErrorTab from '../misc/ErrorTab';
import TopBar from '../misc/TopBar';

import type { DemoTabProps } from '../../types';

export default function MochartDemoMulti({ demoData, initialDemoId, siteRootUrl, onModeChanged, onBackToDemos }: DemoTabProps) {
  return (
    <div className="mochart-demo-container multi">
      {/* One pane, so the strip is a caption rather than a tablist. */}
      <TopBar siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos}
        notes={demoData.demoObjectMap[initialDemoId]}
        modes={{ demoMode: 'multi', onModeChanged }}
        tabs={<StaticDemoTabs label={demoText.tabs.chart} />} />
      <div className="mochart-demo-content-pane">
        <div className="mochart-demo-content">
          <ErrorTab active>
            <MultiMochartChartsTab demoObject={demoData.demoObjectMap[initialDemoId]} />
          </ErrorTab>
        </div>
      </div>
    </div>
  );
}
