// The Chart / Config / Data strip in the top bar, as an ARIA tablist; the keyboard contract lives with `nextDemoTabIndex` in @mochart/demo-common.

import { demoTabId, demoTabPanelId, demoTabPendingId, demoText, nextDemoTabIndex } from '@mochart/demo-common';
import type { DemoTab } from '@mochart/demo-common';

import { el } from './dom';

export interface DemoTabsProps {
  tabs: readonly DemoTab[];
  activeKey: number;
  onSelect: (key: number) => void;
}

export interface DemoTabsHandle {
  el: HTMLElement;
  /** Re-mark the selected tab, and the Chart tab's pending badge. */
  sync(activeKey: number, pending?: boolean): void;
}

export function demoTabs(props: DemoTabsProps): DemoTabsHandle {
  const { tabs, onSelect } = props;
  let activeKey = props.activeKey;

  const badge = el('span', { className: 'mochart-pending-badge', attrs: { 'aria-hidden': 'true' } });
  // The badge is a decorative dot, so the Chart tab points `aria-describedby`
  // here while it shows. Hidden, and read anyway: a referenced element's text is
  // exposed whether or not the element itself is.
  const pendingNote = el('span', {
    id: demoTabPendingId,
    attrs: { hidden: '' },
    text: demoText.tabs.chartPendingTitle
  });

  const buttons = tabs.map(tab => {
    const button = el('button', {
      id: demoTabId(tab.name),
      className: 'demo-tab',
      attrs: { type: 'button', role: 'tab', 'aria-controls': demoTabPanelId(tab.name) },
      text: tab.label
    });
    button.addEventListener('click', () => onSelect(tab.key));
    return button;
  });

  const items = tabs.map((tab, index) => el(
    'li',
    // `presentation`, not `listitem`: a tablist's children are its tabs, and the
    // `<li>`s are only here because the strip is styled as a list.
    { className: 'demo-tab-item', attrs: { role: 'presentation' } },
    tab.name === 'chart' ? [buttons[index], pendingNote] : [buttons[index]]
  ));

  const list = el(
    'ul',
    { className: 'demo-tabs', attrs: { role: 'tablist', 'aria-label': demoText.tabs.listAria } },
    items
  );

  list.addEventListener('keydown', event => {
    const activeIndex = tabs.findIndex(tab => tab.key === activeKey);
    const nextIndex = nextDemoTabIndex(event.key, activeIndex < 0 ? 0 : activeIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }
    // Home/End would scroll the pane, and the arrows are ours once focus is on a
    // tab — the tabs are the only focusable things in the strip.
    event.preventDefault();
    onSelect(tabs[nextIndex].key);
    buttons[nextIndex].focus();
  });

  function sync(nextActiveKey: number, pending = false): void {
    activeKey = nextActiveKey;
    tabs.forEach((tab, index) => {
      const button = buttons[index];
      const selected = tab.key === activeKey;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      // Roving tabindex: Tab reaches the strip once, the arrows move inside it.
      button.tabIndex = selected ? 0 : -1;
      if (tab.name !== 'chart') {
        return;
      }
      const showPending = pending && !selected;
      if (showPending) {
        button.title = demoText.tabs.chartPendingTitle;
        button.setAttribute('aria-describedby', demoTabPendingId);
        if (badge.parentElement === null) {
          button.append(badge);
        }
      }
      else {
        button.removeAttribute('title');
        button.removeAttribute('aria-describedby');
        badge.remove();
      }
    });
  }

  sync(activeKey);

  return { el: list, sync };
}

/** The strip for a view with only one pane (Multi): a plain caption, not a one-tab tablist. */
export function staticDemoTabs(label: string): HTMLElement {
  return el('ul', { className: 'demo-tabs' }, [
    el('li', { className: 'demo-tab-item' }, [
      el('span', { className: 'demo-tab active', text: label })
    ])
  ]);
}
