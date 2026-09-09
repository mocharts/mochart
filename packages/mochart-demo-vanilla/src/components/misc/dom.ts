// Tiny DOM helpers shared by every component in this demo. This package is
// the no-framework peer of the framework galleries, so components are plain
// factory functions returning DOM elements plus targeted update methods —
// there is deliberately no vdom, reactivity, or template layer here.

import { demoText, getDemoTabPanelAttrs } from '@mochart/demo-common';
import type { DemoTabName } from '@mochart/demo-common';

export type Child = Node | string | null | undefined;

export interface ElOptions {
  className?: string;
  id?: string;
  style?: string;
  attrs?: Record<string, string | undefined>;
  text?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: Child[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className !== undefined) {
    element.className = options.className;
  }
  if (options.id !== undefined) {
    element.id = options.id;
  }
  if (options.style !== undefined) {
    element.setAttribute('style', options.style);
  }
  if (options.attrs !== undefined) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined) {
        element.setAttribute(name, value);
      }
    }
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  for (const child of children) {
    if (child !== null && child !== undefined) {
      element.append(child);
    }
  }
  return element;
}

/**
 * Show or hide a mounted tab pane.
 *
 * Two things, because the demo shell hides a pane by MOVING it rather than by
 * taking it out of the layout. `.mochart-demo-tab-container` stacks every pane
 * with `margin-left: -100%` and orders the `.active` one last, so an inactive
 * pane is still rendered, still laid out, and still focusable — one screen's
 * width to the left. Tabbing out of the top bar used to walk straight into the
 * Config pane's textarea and buttons while the Chart pane was on screen.
 *
 * `inert` is what closes that: it makes the whole subtree unfocusable,
 * unclickable and invisible to assistive tech in one attribute, without a
 * `display: none` that would throw away the pane's layout (and with it the
 * measured widths its charts are built from) every time a tab is switched.
 *
 * It also matters more since the phone fold: each strip now carries its own `…`
 * trigger, so an offscreen pane contributed a focusable button whose measured
 * rect is a full viewport-width to the left — opening it positioned a panel off
 * the screen entirely.
 *
 * Do NOT add `aria-hidden` alongside it: `inert` already implies it, and the
 * pair is redundant at best and contradictory at worst.
 */
export function setActiveClass(element: HTMLElement, active: boolean): void {
  element.classList.toggle('active', active);
  // `toggleAttribute` rather than the `inert` IDL property: the attribute is
  // what the CSS/DOM contract is written in, and it needs no lib.dom version
  // that happens to declare the property.
  element.toggleAttribute('inert', !active);
}

/**
 * A tab pane, with its active/inert state applied from the start.
 *
 * Every pane used to build its own `class="… active"` string, which set the
 * class but never the `inert` attribute that has to travel with it — the two
 * would then only agree once something called `setActiveClass`. Going through
 * one constructor keeps them inseparable.
 */
export function tabContainer(
  className: string,
  // `undefined` reads as inactive, which is what the `props.active ? …` strings
  // this replaced already did for the panes whose prop is optional.
  active: boolean | undefined,
  children: Child[] = [],
  // Omitted by the one pane its view does not tab between (multi's charts).
  tabName?: DemoTabName
): HTMLDivElement {
  const panelAttrs = tabName === undefined ? undefined : getDemoTabPanelAttrs(tabName);
  const element = el('div', {
    className: 'mochart-demo-tab-container ' + className,
    id: panelAttrs?.id,
    attrs: panelAttrs === undefined
      ? undefined
      : { role: panelAttrs.role, 'aria-labelledby': panelAttrs['aria-labelledby'] }
  }, children);
  setActiveClass(element, active === true);
  return element;
}

/**
 * Run a DOM edit, then hand focus back if the edit dropped it on the floor.
 *
 * `append` and `replaceChildren` MOVE nodes, and a move is a detach followed by
 * an insert — so if the focused element is anywhere in what moved, the browser
 * resets focus to `<body>` on the way past and never puts it back, even though
 * the element is still there a microsecond later.
 *
 * That is a live case here rather than a theoretical one: the phone fold works
 * by moving controls between a strip and a menu panel, and pressing one of those
 * controls can be exactly what triggers the next move. Pressing Edit Series from
 * inside the chart panel re-homes the whole menu onto the series strip, taking
 * the button that was just pressed with it — and losing focus there also defeats
 * the menu controller's own restoration, which only fires while the panel still
 * holds focus, so the press ended with focus at the top of the document.
 *
 * Only restores when the edit left focus nowhere: an edit that deliberately
 * moved focus somewhere else must be allowed to keep it. And only to an element
 * that is still in the document — a control that genuinely went away should not
 * drag focus after it.
 */
export function withPreservedFocus(mutate: () => void): void {
  const focused = document.activeElement;
  mutate();
  if (focused instanceof HTMLElement && focused.isConnected
      && (document.activeElement === null || document.activeElement === document.body)) {
    focused.focus();
  }
}

/**
 * `replaceChildren` guarded by identity.
 *
 * The phone fold's placeControls implementations run from their component's
 * `sync()`, which runs on every keystroke — and an unguarded `replaceChildren`
 * with an identical list is not a no-op: it detaches and re-inserts every
 * node, which blurs any focused descendant (several folded controls live in an
 * overflow panel) and forces a layout. The lists involved are 1-8 nodes, so
 * the comparison is far cheaper than the write.
 */
export function setChildren(parent: HTMLElement, children: readonly Node[]): void {
  const current = parent.childNodes;
  if (current.length === children.length) {
    let same = true;
    for (let i = 0; i < children.length; i++) {
      if (current[i] !== children[i]) {
        same = false;
        break;
      }
    }
    if (same) {
      return;
    }
  }
  parent.replaceChildren(...children);
}

// ---------------------------------------------------------------------------
// Icon — Font Awesome 6 solid icon (css classes only); relies on the
// `@fortawesome/fontawesome-free` css being imported.
// ---------------------------------------------------------------------------

export interface IconOptions {
  size?: string;
  fixedWidth?: boolean;
  flip?: string;
}

export function icon(name: string, options: IconOptions = {}): HTMLSpanElement {
  const list = ['fa-solid', `fa-${name}`];
  if (options.size) {
    list.push(`fa-${options.size}`);
  }
  if (options.fixedWidth) {
    list.push('fa-fw');
  }
  if (options.flip) {
    list.push(`fa-flip-${options.flip}`);
  }
  return el('span', { className: list.join(' '), attrs: { 'aria-hidden': 'true' } });
}

// ---------------------------------------------------------------------------
// ButtonWithTooltip — the native title attribute covers the hint, `label`
// renders visible text beside the icon, `pressed` marks a toggle button
// (aria-pressed + active styling).
// ---------------------------------------------------------------------------

export interface ButtonOptions {
  id?: string;
  tooltipText?: string;
  disabled?: boolean;
  onClick: () => void;
  color?: string;
  label?: string;
  /**
   * Text shown ONLY when the button is hosted inside a menu — the phone fold
   * reparents icon-only transport buttons (play/stop, prev/next) into an
   * overflow panel, where a column of bare glyphs has nothing to read.
   *
   * Deliberately a second span rather than `label`: a real `label` renders
   * visible text in the strips above 900px, where these buttons are icon-only
   * by design. `.btn-menu-label` is `display: none` everywhere except inside a
   * `.demo-menu`.
   */
  menuLabel?: string;
  pressed?: boolean;
  ariaLabel?: string;
  content: Child[];
}

export interface ButtonHandle {
  el: HTMLElement;
  setDisabled(disabled: boolean): void;
  setPressed(pressed: boolean): void;
  setLabel(label: string): void;
  setTooltip(tooltipText: string): void;
  setContent(content: Child[]): void;
}

export function buttonWithTooltip(options: ButtonOptions): ButtonHandle {
  const color = options.color ?? 'secondary';
  const button = el('button', {
    id: options.id,
    className: `demo-btn demo-btn-${color}` + (options.pressed ? ' active' : ''),
    attrs: {
      type: 'button',
      title: options.tooltipText,
      'aria-label': options.ariaLabel,
      'aria-pressed': options.pressed === undefined ? undefined : String(options.pressed)
    }
  });
  button.disabled = options.disabled ?? false;
  button.addEventListener('click', options.onClick);

  const labelSpan = el('span', { className: 'btn-label' });
  let hasLabel = false;

  // Only minted when asked for: `.demo-btn` is `inline-flex` with `gap: 6px`, so
  // an always-present empty span would add a stray gap after every icon.
  const menuLabelSpan = options.menuLabel === undefined
    ? null
    : el('span', { className: 'btn-menu-label', text: options.menuLabel });

  // Equivalent content bails out (compare setChildren): sync passes call this
  // unconditionally with freshly minted icons, and replacing equal children
  // detaches the pressed node mid-press — the browser then never fires `click`.
  function contentMatches(desired: readonly (Node | string)[]): boolean {
    const current = button.childNodes;
    if (current.length !== desired.length) {
      return false;
    }
    for (let i = 0; i < desired.length; i++) {
      const want = desired[i];
      const have = current[i];
      if (typeof want === 'string') {
        if (have.nodeType !== Node.TEXT_NODE || have.textContent !== want) {
          return false;
        }
      }
      else if (want !== have && !have.isEqualNode(want)) {
        return false;
      }
    }
    return true;
  }

  function setContent(content: Child[]): void {
    const desired: (Node | string)[] = [];
    for (const child of content) {
      if (child !== null && child !== undefined) {
        desired.push(child);
      }
    }
    if (menuLabelSpan !== null) {
      desired.push(menuLabelSpan);
    }
    if (hasLabel) {
      desired.push(labelSpan);
    }
    if (contentMatches(desired)) {
      return;
    }
    button.replaceChildren(...desired);
  }

  function setLabel(label: string): void {
    labelSpan.textContent = label;
    if (!hasLabel) {
      hasLabel = true;
      button.append(labelSpan);
    }
  }

  setContent(options.content);
  if (options.label !== undefined) {
    setLabel(options.label);
  }

  return {
    // Unstyled wrapper: it keeps the button one flex item wherever it is folded.
    el: el('span', {}, [button]),
    setDisabled(disabled: boolean) {
      button.disabled = disabled;
    },
    setPressed(pressed: boolean) {
      button.classList.toggle('active', pressed);
      button.setAttribute('aria-pressed', String(pressed));
    },
    setLabel,
    setTooltip(tooltipText: string) {
      button.title = tooltipText;
    },
    setContent
  };
}

// ---------------------------------------------------------------------------
// ErrorTab — error-boundary equivalent of the framework demos' ErrorTab. The
// child is created (and updated) inside a try/catch; on a throw, the pane is
// replaced with the same error alert the other demos render.
// ---------------------------------------------------------------------------

export interface ErrorTabHandle {
  el: HTMLElement;
  /** Run a child update guarded by the boundary. */
  guard(fn: () => void): void;
  setActive(active: boolean): void;
}

export function errorTab(create: () => HTMLElement, active: boolean): ErrorTabHandle {
  const container = el('div', { style: 'display: contents;' });
  let failed = false;
  let failedPane: HTMLElement | null = null;

  function fail(error: unknown): void {
    console.error(error);
    failed = true;
    failedPane = tabContainer('error', isActive, [
      el('div', {
        className: 'demo-alert demo-alert-error demo-text-center mochart-demo-error-message',
        attrs: { role: 'alert' },
        text: demoText.errors.errorOccurred
      })
    ]);
    container.replaceChildren(failedPane);
  }

  let isActive = active;
  try {
    container.append(create());
  }
  catch (error) {
    fail(error);
  }

  return {
    el: container,
    guard(fn: () => void) {
      if (failed) {
        return;
      }
      try {
        fn();
      }
      catch (error) {
        fail(error);
      }
    },
    setActive(active: boolean) {
      isActive = active;
      if (failedPane) {
        setActiveClass(failedPane, active);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Size observation — the vanilla stand-in for the framework demos' measured
// containers (bind:clientWidth / ResizeController).
// ---------------------------------------------------------------------------

export function observeSize(
  element: HTMLElement,
  onSize: (width: number, height: number) => void
): () => void {
  let lastWidth = -1;
  let lastHeight = -1;
  const report = () => {
    const width = Math.floor(element.clientWidth);
    const height = Math.floor(element.clientHeight);
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      onSize(width, height);
    }
  };
  const observer = new ResizeObserver(report);
  observer.observe(element);
  // ResizeObserver fires its first callback asynchronously; report once the
  // element is connected so mount-time layout doesn't wait a frame.
  queueMicrotask(report);
  return () => observer.disconnect();
}
