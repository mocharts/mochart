import type { DemoData, SwitchableDemoMode } from '@mochart/demo-common';

export type {
  DataObject, Demo, DemoConfig, DemoData,
  FilteredSeriesIds, FocusData, TransitionConfig,
  ChartDataProviderLike, DemoDataProvider, SwitchableDemoMode,
  RandomConfigWithValid, MochartDemoConfig
} from '@mochart/demo-common';

/** Switch the current demo to another of the single/multi/random modes. */
export type OnModeChanged = (nextDemoMode: SwitchableDemoMode) => void;

/** Navigate back to the demo gallery landing page. */
export type OnBackToDemos = () => void;

/** Props shared by the top-level demo-mode components (single/multi/random). */
export interface DemoTabProps {
  demoData: DemoData;
  initialDemoId: string;
  siteRootUrl?: string;
  onModeChanged: OnModeChanged;
  onBackToDemos: OnBackToDemos;
}
