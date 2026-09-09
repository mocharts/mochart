// Tiny DOM helpers, same no-framework idiom as demo-vanilla: components are
// factory functions returning elements plus targeted update methods.

import { svgIcon } from './icons';

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

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export interface ButtonOptions {
  /** Icon name from ui/icons.ts; omit for a text-only button. */
  icon?: string;
  /** Visible text label (hidden on the tightest phone tier via CSS). */
  label?: string;
  title?: string;
  ariaLabel?: string;
  pressed?: boolean;
  disabled?: boolean;
  /** Extra class, e.g. 'sc-btn-primary' or 'sc-btn-quiet'. */
  variant?: string;
  onClick: () => void;
}

export interface ButtonHandle {
  el: HTMLButtonElement;
  setPressed(pressed: boolean): void;
  setDisabled(disabled: boolean): void;
  setIcon(icon: string): void;
  setLabel(label: string): void;
  setTitle(title: string): void;
}

export function button(options: ButtonOptions): ButtonHandle {
  const element = el('button', {
    className: 'sc-btn' + (options.variant !== undefined ? ' ' + options.variant : '') + (options.pressed === true ? ' active' : ''),
    attrs: {
      type: 'button',
      title: options.title,
      'aria-label': options.ariaLabel,
      'aria-pressed': options.pressed === undefined ? undefined : String(options.pressed)
    }
  });
  element.disabled = options.disabled ?? false;
  element.addEventListener('click', options.onClick);

  let iconEl: SVGSVGElement | null = null;
  if (options.icon !== undefined) {
    iconEl = svgIcon(options.icon);
    element.append(iconEl);
  }
  const labelEl = options.label !== undefined ? el('span', { className: 'sc-btn-label', text: options.label }) : null;
  if (labelEl !== null) {
    element.append(labelEl);
  }

  return {
    el: element,
    setPressed(pressed: boolean) {
      element.classList.toggle('active', pressed);
      element.setAttribute('aria-pressed', String(pressed));
    },
    setDisabled(disabled: boolean) {
      element.disabled = disabled;
    },
    setIcon(name: string) {
      const next = svgIcon(name);
      if (iconEl !== null) {
        iconEl.replaceWith(next);
      }
      else {
        element.prepend(next);
      }
      iconEl = next;
    },
    setLabel(label: string) {
      if (labelEl !== null) {
        labelEl.textContent = label;
      }
    },
    setTitle(title: string) {
      element.title = title;
    }
  };
}

// ---------------------------------------------------------------------------
// Segmented control — used for tabs and the specials' mode switchers.
// ---------------------------------------------------------------------------

export interface SegmentedOptions<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  ariaLabel: string;
  onChange: (value: T) => void;
}

export interface SegmentedHandle<T extends string> {
  el: HTMLElement;
  set(value: T): void;
  get(): T;
}

export function segmented<T extends string>(options: SegmentedOptions<T>): SegmentedHandle<T> {
  let current = options.value;
  const buttons = new Map<T, HTMLButtonElement>();

  function apply(): void {
    for (const [value, btn] of buttons) {
      const active = value === current;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    }
  }

  const container = el('div', { className: 'sc-segmented', attrs: { role: 'tablist', 'aria-label': options.ariaLabel } });
  for (const option of options.options) {
    const btn = el('button', {
      className: 'sc-segment',
      attrs: { type: 'button', role: 'tab' },
      text: option.label
    });
    btn.addEventListener('click', () => {
      if (current !== option.value) {
        current = option.value;
        apply();
        options.onChange(option.value);
      }
    });
    buttons.set(option.value, btn);
    container.append(btn);
  }
  // Arrow keys move between segments, per the tabs pattern.
  container.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const values = options.options.map(option => option.value);
    const index = values.indexOf(current);
    const nextIndex = event.key === 'ArrowLeft'
      ? (index - 1 + values.length) % values.length
      : (index + 1) % values.length;
    const next = values[nextIndex];
    current = next;
    apply();
    buttons.get(next)?.focus();
    options.onChange(next);
    event.preventDefault();
  });
  apply();

  return {
    el: container,
    set(value: T) {
      current = value;
      apply();
    },
    get() {
      return current;
    }
  };
}

// ---------------------------------------------------------------------------
// Toast — transient confirmation ("Link copied").
// ---------------------------------------------------------------------------

let toastEl: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(message: string): void {
  if (toastEl === null) {
    toastEl = el('div', { className: 'sc-toast', attrs: { role: 'status' } });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toastEl?.classList.remove('visible');
    toastTimer = null;
  }, 2200);
}
