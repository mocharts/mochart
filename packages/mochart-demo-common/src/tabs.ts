// The demo views' Chart/Config/Data strip as ARIA tabs: the tab/pane id pairing and arrow-key contract the six ports must agree on.

/** A pane a demo view can show. One view mounts at a time, so the ids below stay unique. */
export type DemoTabName = 'chart' | 'config' | 'data';

/** One entry of a view's tab strip. `key` is the view's own event key for the pane. */
export interface DemoTab {
  name: DemoTabName;
  key: number;
  label: string;
  /** Chart tab only: applied config/data edits are waiting on that pane. */
  pending?: boolean;
}

/** Id of a tab button — the pane's `aria-labelledby` target. */
export function demoTabId(name: DemoTabName): string {
  return 'demo-tab-' + name;
}

/** Id of a pane — the tab button's `aria-controls` target. */
export function demoTabPanelId(name: DemoTabName): string {
  return 'demo-tabpanel-' + name;
}

/** Id of the `hidden` span describing the pending badge; the Chart tab points `aria-describedby` at it while the badge shows (referenced text is exposed even when hidden). */
export const demoTabPendingId = 'demo-tab-pending-note';

export interface DemoTabPanelAttrs {
  id: string;
  role: 'tabpanel';
  'aria-labelledby': string;
}

/** Attributes tying a pane to its tab, spread onto the pane's root; no `tabindex="0"` because every pane has focusable controls of its own. */
export function getDemoTabPanelAttrs(name: DemoTabName): DemoTabPanelAttrs {
  return { id: demoTabPanelId(name), role: 'tabpanel', 'aria-labelledby': demoTabId(name) };
}

/** The tab a keypress moves to: Left/Right wrap, Home/End jump, and null for keys the strip does not own (Up/Down stay with the browser so scrolling works). */
export function nextDemoTabIndex(key: string, activeIndex: number, tabCount: number): number | null {
  if (tabCount < 1) {
    return null;
  }
  if (key === 'ArrowRight') {
    return (activeIndex + 1) % tabCount;
  }
  if (key === 'ArrowLeft') {
    return (activeIndex - 1 + tabCount) % tabCount;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return tabCount - 1;
  }
  return null;
}
