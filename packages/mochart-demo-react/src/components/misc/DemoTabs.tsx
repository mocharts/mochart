import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { demoTabId, demoTabPanelId, demoTabPendingId, demoText, nextDemoTabIndex } from '@mochart/demo-common';
import type { DemoTab } from '@mochart/demo-common';

// The Chart / Config / Data strip as an ARIA tablist: roving tabindex, arrow/Home/End keys via the shared nextDemoTabIndex, and automatic selection (arrowing shows the pane).

interface DemoTabsProps {
  tabs: readonly DemoTab[];
  activeKey: number;
  onSelect: (key: number) => void;
}

export default function DemoTabs({ tabs, activeKey, onSelect }: DemoTabsProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const activeIndex = tabs.findIndex(tab => tab.key === activeKey);
    const nextIndex = nextDemoTabIndex(event.key, activeIndex < 0 ? 0 : activeIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }
    // Home/End would scroll the pane, and the arrows are ours once focus is on a tab.
    event.preventDefault();
    onSelect(tabs[nextIndex].key);
    // Every tab is already rendered, so focus lands before the roving-tabindex re-render.
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <ul ref={listRef} className="demo-tabs" role="tablist" aria-label={demoText.tabs.listAria}
      onKeyDown={onKeyDown}>
      {tabs.map(tab => {
        const selected = tab.key === activeKey;
        const pending = tab.pending === true && !selected;
        return (
          // `presentation`, not `listitem`: a tablist's children are its tabs.
          <li key={tab.key} className="demo-tab-item" role="presentation">
            <button type="button" id={demoTabId(tab.name)} role="tab"
              className={"demo-tab" + (selected ? " active" : "")}
              aria-selected={selected} aria-controls={demoTabPanelId(tab.name)}
              // Roving tabindex: Tab reaches the strip once, the arrows move inside it.
              tabIndex={selected ? 0 : -1}
              title={pending ? demoText.tabs.chartPendingTitle : undefined}
              aria-describedby={pending ? demoTabPendingId : undefined}
              onClick={() => { onSelect(tab.key); }}>
              {tab.label}
              {pending ? <span className="mochart-pending-badge" aria-hidden="true" /> : null}
            </button>
            {/* Hidden text is still exposed through the tab's `aria-describedby` while the badge shows. */}
            {tab.name === 'chart'
              ? <span id={demoTabPendingId} hidden>{demoText.tabs.chartPendingTitle}</span>
              : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The strip for a view with only one pane (Multi) — a caption with no tab roles, since there is nothing to switch to. */
export function StaticDemoTabs({ label }: { label: string }) {
  return (
    <ul className="demo-tabs">
      <li className="demo-tab-item"><span className="demo-tab active">{label}</span></li>
    </ul>
  );
}
