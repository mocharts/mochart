import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import { demoTabId, demoTabPanelId, demoTabPendingId, demoText, nextDemoTabIndex } from '@mochart/demo-common';
import type { DemoTab } from '@mochart/demo-common';

// The Chart / Config / Data strip in the top bar, as an ARIA tablist; the keyboard contract lives with `nextDemoTabIndex` in @mochart/demo-common.
// A plain template function, not a custom element — the strip holds no state (see `misc/templates.ts` for the same altitude choice).

interface DemoTabsProps {
  tabs: readonly DemoTab[];
  activeKey: number;
  onSelect: (key: number) => void;
}

export function demoTabs({ tabs, activeKey, onSelect }: DemoTabsProps): TemplateResult {
  const onKeyDown = (event: KeyboardEvent): void => {
    const activeIndex = tabs.findIndex(tab => tab.key === activeKey);
    const nextIndex = nextDemoTabIndex(event.key, activeIndex < 0 ? 0 : activeIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }
    // Home/End would scroll the pane, and the arrows are ours once focus is on a
    // tab — the tabs are the only focusable things in the strip.
    event.preventDefault();
    const list = event.currentTarget as HTMLElement;
    onSelect(tabs[nextIndex].key);
    // Every tab is already rendered, so this lands before the (async) re-render
    // that moves the roving tabindex onto it.
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return html`<ul class="demo-tabs" role="tablist" aria-label=${demoText.tabs.listAria}
                  @keydown=${onKeyDown}>
    ${tabs.map(tab => {
      const selected = tab.key === activeKey;
      const pending = tab.pending === true && !selected;
      // `presentation`, not `listitem`: a tablist's children are its tabs, and
      // the `<li>`s are only here because the strip is styled as a list.
      return html`<li class="demo-tab-item" role="presentation">
        <button type="button" id=${demoTabId(tab.name)} role="tab"
                class=${'demo-tab' + (selected ? ' active' : '')}
                aria-selected=${String(selected)} aria-controls=${demoTabPanelId(tab.name)}
                tabindex=${selected ? 0 : -1}
                title=${pending ? demoText.tabs.chartPendingTitle : nothing}
                aria-describedby=${pending ? demoTabPendingId : nothing}
                @click=${() => onSelect(tab.key)}
        >${tab.label}${pending ? html`<span class="mochart-pending-badge" aria-hidden="true"></span>` : nothing}</button>
        <!-- The badge is a decorative dot, so the tab points \`aria-describedby\`
             here while it shows. Hidden, and read anyway: a referenced element's
             text is exposed whether or not the element itself is. -->
        ${tab.name === 'chart'
          ? html`<span id=${demoTabPendingId} hidden>${demoText.tabs.chartPendingTitle}</span>`
          : nothing}
      </li>`;
    })}
  </ul>`;
}

/** The strip for a view with only one pane (Multi) — a caption with no tab roles, since there is nothing to switch to. */
export function staticDemoTabs(label: string): TemplateResult {
  return html`<ul class="demo-tabs">
    <li class="demo-tab-item"><span class="demo-tab active">${label}</span></li>
  </ul>`;
}
