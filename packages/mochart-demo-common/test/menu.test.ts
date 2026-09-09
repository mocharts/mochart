// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getMenuPosition, watchMenuDismiss, createMenuController, isMenuDismissingClick,
  navMenuPlacement, controlsMenuPlacement, notesMenuPlacement, menuKeepOpenClassName
} from '../src/menu';
import type { MenuAnchorRect } from '../src/menu';

const viewport = { width: 1000, height: 800 };

/** A trigger somewhere in the middle of the viewport, so no clamp is in play. */
const anchor: MenuAnchorRect = { top: 300, bottom: 330, left: 400, right: 460 };

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

describe('getMenuPosition', () => {
  it('opens downward and left-aligned by default', () => {
    const position = getMenuPosition(anchor, viewport);
    expect(position.top).toBe(334);
    expect(position.left).toBe(400);
    // Only the anchored edges are set, so CSS keeps `auto` for the others.
    expect(position.bottom).toBeUndefined();
    expect(position.right).toBeUndefined();
  });

  it('opens downward and right-aligned for align: end', () => {
    const position = getMenuPosition(anchor, viewport, { side: 'bottom', align: 'end' });
    expect(position.top).toBe(334);
    expect(position.right).toBe(540);
    expect(position.left).toBeUndefined();
    expect(position.bottom).toBeUndefined();
  });

  it('opens upward and left-aligned for side: top', () => {
    const position = getMenuPosition(anchor, viewport, { side: 'top', align: 'start' });
    expect(position.bottom).toBe(504);
    expect(position.left).toBe(400);
    expect(position.top).toBeUndefined();
    expect(position.right).toBeUndefined();
  });

  it('opens upward and right-aligned for side: top, align: end', () => {
    const position = getMenuPosition(anchor, viewport, { side: 'top', align: 'end' });
    expect(position.bottom).toBe(504);
    expect(position.right).toBe(540);
    expect(position.top).toBeUndefined();
    expect(position.left).toBeUndefined();
  });

  it('applies the gap to the trigger on both axes of the placement', () => {
    const wide = getMenuPosition(anchor, viewport, { side: 'bottom', gap: 20 });
    expect(wide.top).toBe(350);
    const up = getMenuPosition(anchor, viewport, { side: 'top', gap: 20 });
    expect(up.bottom).toBe(520);
  });

  it('spends the room below the trigger on maxHeight', () => {
    const position = getMenuPosition(anchor, viewport, { side: 'bottom' });
    // 800 - (330 + 4) - 4
    expect(position.maxHeight).toBe(462);
  });

  it('spends the room above the trigger on maxHeight', () => {
    const position = getMenuPosition(anchor, viewport, { side: 'top' });
    // 300 - 4 (trigger gap) - 4 (viewport gap)
    expect(position.maxHeight).toBe(292);
  });

  it('never reports a negative or sliver maxHeight', () => {
    // A trigger flush against the bottom edge leaves nothing to open into.
    const bottom = getMenuPosition({ top: 780, bottom: 800, left: 10, right: 70 }, viewport, { side: 'bottom' });
    expect(bottom.maxHeight).toBe(96);
    // Same at the top: the raw arithmetic would be -8.
    const top = getMenuPosition({ top: 0, bottom: 20, left: 10, right: 70 }, viewport, { side: 'top' });
    expect(top.maxHeight).toBe(96);
  });

  it('keeps an end-aligned panel off the right edge', () => {
    // Trigger flush right: the raw offset is 0, which would touch the edge.
    const flush = getMenuPosition({ top: 10, bottom: 40, left: 940, right: 1000 }, viewport, { align: 'end' });
    expect(flush.right).toBe(4);
    // Trigger scrolled past the right edge: still clamped to the gap.
    const past = getMenuPosition({ top: 10, bottom: 40, left: 1000, right: 1060 }, viewport, { align: 'end' });
    expect(past.right).toBe(4);
  });

  it('clamps a start-aligned panel by its declared width', () => {
    // 340 wide, trigger at 900: left-aligning would put its right edge at 1240.
    const clamped = getMenuPosition({ top: 10, bottom: 40, left: 900, right: 960 }, viewport, { width: 340 });
    // 1000 - 340 - 4
    expect(clamped.left).toBe(656);
    // The same trigger with no declared width cannot clamp, and says so.
    const unclamped = getMenuPosition({ top: 10, bottom: 40, left: 900, right: 960 }, viewport);
    expect(unclamped.left).toBe(900);
  });

  it('clamps the assumed width to the viewport before clamping the panel', () => {
    // A 340 panel on a 320 viewport: the width is capped at 320 - 32 = 288,
    // leaving the panel at the left gap rather than off to the left of it.
    const narrow = getMenuPosition({ top: 10, bottom: 40, left: 100, right: 160 }, { width: 320, height: 600 }, { width: 340 });
    expect(narrow.left).toBe(28);
    expect(narrow.left).toBeGreaterThanOrEqual(4);
  });

  it('honours a custom viewportMargin', () => {
    const position = getMenuPosition({ top: 10, bottom: 40, left: 100, right: 160 }, { width: 320, height: 600 }, { width: 340, viewportMargin: 0 });
    // Width capped at 320 now, so the panel is pinned to the left gap.
    expect(position.left).toBe(4);
  });
});

describe('watchMenuDismiss', () => {
  let panel: HTMLDivElement;
  let outside: HTMLButtonElement;
  let onDismiss: () => void;
  let stop: () => void;

  beforeEach(() => {
    panel = document.createElement('div');
    outside = document.createElement('button');
    document.body.append(panel, outside);
    onDismiss = vi.fn();
    stop = watchMenuDismiss({
      isInside: target => target !== null && panel.contains(target),
      onDismiss,
      getScrollableEl: () => panel
    });
  });

  afterEach(() => {
    stop();
    panel.remove();
    outside.remove();
  });

  it('dismisses on a pointerdown outside the menu', () => {
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores a pointerdown inside the menu', () => {
    panel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not rely on mousedown, which touch handlers can filter', () => {
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on Escape but not on other keys', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on a scroll elsewhere, including a nested non-bubbling one', () => {
    // `scroll` does not bubble; only the capture-phase window listener hears this.
    outside.dispatchEvent(new Event('scroll'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores scrolling inside the menu panel itself', () => {
    panel.dispatchEvent(new Event('scroll'));
    const inner = document.createElement('div');
    panel.append(inner);
    inner.dispatchEvent(new Event('scroll'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on a window resize', () => {
    window.dispatchEvent(new Event('resize'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('removes every listener on unsubscribe', () => {
    stop();
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    outside.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('watchMenuDismiss visual viewport', () => {
  // jsdom has no visual viewport, and neither do older browsers, so the module
  // has to cope with it being absent as well as present.
  const fakeVisualViewport = new EventTarget();

  beforeEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: fakeVisualViewport, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it('dismisses when only the visual viewport resizes (iOS keyboard)', () => {
    const onDismiss = vi.fn();
    const stop = watchMenuDismiss({ isInside: () => false, onDismiss });
    fakeVisualViewport.dispatchEvent(new Event('resize'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    stop();
    fakeVisualViewport.dispatchEvent(new Event('resize'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('createMenuController', () => {
  let trigger: HTMLButtonElement;
  let panel: HTMLDivElement;
  let item: HTMLButtonElement;
  let outside: HTMLButtonElement;

  beforeEach(() => {
    setWindowSize(1000, 800);
    trigger = document.createElement('button');
    panel = document.createElement('div');
    item = document.createElement('button');
    outside = document.createElement('button');
    panel.append(item);
    document.body.append(trigger, panel, outside);
    trigger.getBoundingClientRect = () => new DOMRect(400, 300, 60, 30);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('wires disclosure ARIA, not menu ARIA', () => {
    trigger.setAttribute('aria-haspopup', 'true');
    const controller = createMenuController({ trigger, panel });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id).not.toBe('');
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(trigger.id).not.toBe('');
    // The old markup's unkept promises are actively removed / never added.
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(panel.getAttribute('role')).toBeNull();
    controller.destroy();
  });

  it('keeps ids the markup already supplied', () => {
    trigger.id = 'my-trigger';
    panel.id = 'my-panel';
    const controller = createMenuController({ trigger, panel });
    expect(trigger.getAttribute('aria-controls')).toBe('my-panel');
    expect(panel.getAttribute('aria-labelledby')).toBe('my-trigger');
    controller.destroy();
  });

  it('positions the panel before it is shown', () => {
    let openWhenMeasured: boolean | null = null;
    trigger.getBoundingClientRect = () => {
      openWhenMeasured = panel.classList.contains('open');
      return new DOMRect(400, 300, 60, 30);
    };
    const controller = createMenuController({ trigger, panel, placement: { side: 'top', align: 'end' } });
    controller.open();
    // Measuring after the class had landed would mean a frame at stale coordinates.
    expect(openWhenMeasured).toBe(false);
    expect(panel.classList.contains('open')).toBe(true);
    controller.destroy();
  });

  it('applies the computed edges as inline fixed styles', () => {
    const controller = createMenuController({ trigger, panel, placement: { side: 'top', align: 'end' }, zIndex: 42 });
    controller.open();
    expect(panel.style.position).toBe('fixed');
    // side: top → 800 - 300 + 4; align: end → 1000 - 460
    expect(panel.style.bottom).toBe('504px');
    expect(panel.style.right).toBe('540px');
    expect(panel.style.top).toBe('');
    expect(panel.style.left).toBe('');
    expect(panel.style.maxHeight).toBe('292px');
    expect(panel.style.margin).toBe('0px');
    expect(panel.style.zIndex).toBe('42');
    controller.destroy();
  });

  it('toggles classes and clears the inline style on close', () => {
    const opened: boolean[] = [];
    const controller = createMenuController({ trigger, panel, onOpenChange: open => opened.push(open) });
    controller.toggle();
    expect(controller.isOpen()).toBe(true);
    expect(trigger.classList.contains('active')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    controller.toggle();
    expect(controller.isOpen()).toBe(false);
    expect(panel.classList.contains('open')).toBe(false);
    expect(trigger.classList.contains('active')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hasAttribute('style')).toBe(false);
    expect(opened).toEqual([true, false]);
    controller.destroy();
  });

  it('opens and closes from the trigger button', () => {
    const controller = createMenuController({ trigger, panel });
    trigger.click();
    expect(controller.isOpen()).toBe(true);
    trigger.click();
    expect(controller.isOpen()).toBe(false);
    controller.destroy();
  });

  it('leaves the trigger unbound when the port binds it itself', () => {
    const controller = createMenuController({ trigger, panel, bindTrigger: false });
    trigger.click();
    expect(controller.isOpen()).toBe(false);
    controller.destroy();
  });

  it('closes on a press outside but not on one inside, including satellites', () => {
    const satellite = document.createElement('div');
    document.body.append(satellite);
    const controller = createMenuController({ trigger, panel, getExtraInside: () => [satellite, null, undefined] });
    controller.open();
    item.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(controller.isOpen()).toBe(true);
    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(controller.isOpen()).toBe(true);
    satellite.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(controller.isOpen()).toBe(true);
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(controller.isOpen()).toBe(false);
    controller.destroy();
  });

  it('survives scrolling its own panel but closes on a scroll outside', () => {
    const controller = createMenuController({ trigger, panel });
    controller.open();
    panel.dispatchEvent(new Event('scroll'));
    expect(controller.isOpen()).toBe(true);
    outside.dispatchEvent(new Event('scroll'));
    expect(controller.isOpen()).toBe(false);
    controller.destroy();
  });

  it('returns focus to the trigger when the menu closes with focus inside', () => {
    const controller = createMenuController({ trigger, panel });
    controller.open();
    item.focus();
    expect(document.activeElement).toBe(item);
    controller.close();
    expect(document.activeElement).toBe(trigger);
    controller.destroy();
  });

  it('leaves focus alone when it is already elsewhere', () => {
    const controller = createMenuController({ trigger, panel });
    controller.open();
    outside.focus();
    controller.close();
    expect(document.activeElement).toBe(outside);
    controller.destroy();
  });

  it('does not restore focus when the caller opts out', () => {
    const controller = createMenuController({ trigger, panel, restoreFocus: false });
    controller.open();
    item.focus();
    controller.close();
    expect(document.activeElement).toBe(item);
    controller.destroy();
  });

  it('measures from getAnchor when one is supplied', () => {
    const row = document.createElement('div');
    document.body.append(row);
    row.getBoundingClientRect = () => new DOMRect(0, 100, 1000, 40);
    const controller = createMenuController({ trigger, panel, getAnchor: () => row });
    controller.open();
    expect(panel.style.top).toBe('144px');
    expect(panel.style.left).toBe('4px');
    controller.destroy();
  });

  it('closes, unbinds and unwires ARIA on destroy', () => {
    const controller = createMenuController({ trigger, panel });
    controller.open();
    controller.destroy();
    expect(controller.isOpen()).toBe(false);
    expect(trigger.hasAttribute('aria-expanded')).toBe(false);
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
    trigger.click();
    expect(controller.isOpen()).toBe(false);
    // The dismissal listeners went with it: nothing left to fire.
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(controller.isOpen()).toBe(false);
  });
});

describe('isMenuDismissingClick', () => {
  let panel: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="panel">
        <button id="action"><span id="glyph"></span></button>
        <a id="link">docs</a>
        <div class="${menuKeepOpenClassName}"><button id="stepper"></button></div>
        <label id="label">rate</label>
      </div>
      <button id="outside"></button>`;
    panel = document.getElementById('panel')!;
    outside = document.getElementById('outside')!;
  });

  it('dismisses on a button or link, even when the press lands on a child', () => {
    expect(isMenuDismissingClick(document.getElementById('glyph'), panel)).toBe(true);
    expect(isMenuDismissingClick(document.getElementById('link'), panel)).toBe(true);
  });

  it('leaves the menu open for a keep-open subtree and for non-actionable targets', () => {
    expect(isMenuDismissingClick(document.getElementById('stepper'), panel)).toBe(false);
    expect(isMenuDismissingClick(document.getElementById('label'), panel)).toBe(false);
    expect(isMenuDismissingClick(null, panel)).toBe(false);
  });

  it('rejects an actionable found outside the panel when one is given', () => {
    expect(isMenuDismissingClick(outside, panel)).toBe(false);
    // Without a panel the rule is target-only, which is what the reactive ports pass.
    expect(isMenuDismissingClick(outside)).toBe(true);
  });
});

describe('the shared placements', () => {
  it('open away from the edge their trigger sits on', () => {
    expect(navMenuPlacement.side).toBe('bottom');
    expect(controlsMenuPlacement.side).toBe('top');
    expect(notesMenuPlacement.side).toBe('bottom');
  });

  it('give the notes panel the width demo.css will render it at', () => {
    // A closed panel measures 0, so the left-edge clamp is told the stylesheet's number.
    const position = getMenuPosition({ top: 40, bottom: 70, left: 900, right: 960 }, viewport, notesMenuPlacement);
    expect(position.left).toBe(1000 - 340 - 6);
  });
});
