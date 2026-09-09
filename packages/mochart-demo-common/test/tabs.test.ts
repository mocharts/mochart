import { describe, it, expect } from 'vitest';

import { demoTabId, demoTabPanelId, getDemoTabPanelAttrs, nextDemoTabIndex } from '../src/tabs';

describe('tab/panel ids', () => {
  it('pairs a pane with the tab that selects it', () => {
    const panelAttrs = getDemoTabPanelAttrs('config');
    expect(panelAttrs.id).toBe(demoTabPanelId('config'));
    expect(panelAttrs.role).toBe('tabpanel');
    expect(panelAttrs['aria-labelledby']).toBe(demoTabId('config'));
  });

  it('gives every pane its own ids', () => {
    const ids = ['chart', 'config', 'data'].flatMap(
      name => [demoTabId(name as 'chart'), demoTabPanelId(name as 'chart')]
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('nextDemoTabIndex', () => {
  it('walks right and wraps', () => {
    expect(nextDemoTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextDemoTabIndex('ArrowRight', 2, 3)).toBe(0);
  });

  it('walks left and wraps', () => {
    expect(nextDemoTabIndex('ArrowLeft', 2, 3)).toBe(1);
    expect(nextDemoTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends', () => {
    expect(nextDemoTabIndex('Home', 2, 3)).toBe(0);
    expect(nextDemoTabIndex('End', 0, 3)).toBe(2);
  });

  it('leaves keys it does not own alone', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', ' ', 'PageUp', 'a']) {
      expect(nextDemoTabIndex(key, 1, 3)).toBeNull();
    }
  });

  it('owns no key with no tabs to move between', () => {
    expect(nextDemoTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
