// The in-demo navigation strip pieces: a back link to the gallery and the
// Single/Multi/Random mode switcher. Transition/rotation are standalone
// gallery pages, not modes, so they don't appear here.

import { demoModeIcons, demoText, getAvailableDemoModes, initTheme, isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { el, icon } from './dom';

// One controller for the whole app; every view's toggle button shares it.
const theme = initTheme();

export interface ModeSwitcherProps {
  demoMode: SwitchableDemoMode;
  onModeChanged: (nextDemoMode: SwitchableDemoMode) => void;
}

export interface ModeSwitcherHandle {
  el: HTMLElement;
  destroy(): void;
}

export function modeSwitcher(props: ModeSwitcherProps): ModeSwitcherHandle {
  // A named group, not a toolbar: the segments are three independently tabbable
  // buttons with no arrow-key handling, and the name is what makes "Single" read
  // as a mode rather than a verb.
  const group = el('div', {
    className: 'demo-toolbar',
    attrs: { role: 'group', 'aria-label': demoText.modeSwitcher.groupAria }
  });

  // Rebuilt when the viewport crosses the breakpoint; the current mode is a filled disabled segment in the strip, but gets the `.active` tint (inert, not disabled-grey) in the phone overflow menu.
  function render(isPhone: boolean): void {
    group.replaceChildren(...getAvailableDemoModes(isPhone).map(mode => {
      const current = mode === props.demoMode;
      const { label, title } = demoText.modeSwitcher.modes[mode];
      const button = el('button', {
        className: 'demo-btn demo-btn-' + (current ? 'primary' : 'secondary')
          + (current && isPhone ? ' active' : ''),
        attrs: { type: 'button', title, 'aria-current': current ? 'page' : undefined }
      }, [
        icon(demoModeIcons[mode], { size: 'lg', fixedWidth: true }),
        el('span', { className: 'btn-label', text: label })
      ]);
      button.disabled = current && !isPhone;
      button.addEventListener('click', () => {
        if (!current) {
          props.onModeChanged(mode);
        }
      });
      return button;
    }));
  }

  render(isPhoneViewport());
  const unwatchViewport = watchPhoneViewport(render);

  return {
    el: el('div', { className: 'mochart-demo-mode-switcher' }, [
      el('span', { className: 'demo-label', text: demoText.modeSwitcher.label }),
      group
    ]),
    destroy() {
      unwatchViewport();
    }
  };
}

/**
 * Link back to the docs site root (a real anchor so middle-click works).
 * Returns null when no site root is configured (standalone dev/build).
 */
export function siteRootButton(siteRootUrl: string | undefined): HTMLElement | null {
  if (siteRootUrl === undefined) {
    return null;
  }
  return el('a', {
    className: 'demo-btn demo-btn-secondary mochart-demo-site-root-button',
    attrs: {
      href: siteRootUrl,
      title: demoText.siteRootLink.tooltip,
      'aria-label': demoText.siteRootLink.aria
    }
  }, [
    icon('house', { size: 'lg', fixedWidth: true }),
    el('span', { className: 'btn-label', text: demoText.siteRootLink.shortLabel })
  ]);
}

export interface ThemeToggleHandle {
  el: HTMLElement;
  /** Drops the theme subscription the button holds. */
  destroy(): void;
}

/**
 * Icon-only light/dark toggle; shares the docs site's theme choice.
 *
 * The subscription is handed back rather than dropped on the floor: `theme` is
 * an app-lifetime singleton, so a toggle that never unsubscribes keeps its
 * button (and the whole view it was mounted in) alive for as long as the tab
 * lives — one leaked view per navigation between demo modes.
 */
export function themeToggle(): ThemeToggleHandle {
  const button = el('button', {
    className: 'demo-btn demo-btn-secondary mochart-demo-theme-toggle',
    attrs: { type: 'button', 'aria-label': demoText.themeToggle.aria }
  });
  // The button is icon-only in every bar it appears in, so folded into the
  // navigation row's overflow menu it would be the one row with nothing to read.
  // `.btn-menu-label` is `display: none` everywhere except inside a `.demo-menu`
  // — and a `display: none` child is not a flex item, so it costs the bars
  // neither a box nor one of `.demo-btn`'s gaps. It names the theme the button
  // switches TO, exactly as the tooltip beside it does.
  const menuLabel = el('span', { className: 'btn-menu-label' });
  button.append(menuLabel);

  let iconEl: HTMLElement | null = null;
  function render(dark: boolean): void {
    const nextIcon = icon(dark ? 'sun' : 'moon', { size: 'lg', fixedWidth: true });
    if (iconEl === null) {
      // Before the label, not after it.
      button.prepend(nextIcon);
    }
    else {
      button.replaceChild(nextIcon, iconEl);
    }
    iconEl = nextIcon;
    button.title = dark ? demoText.themeToggle.tooltipToLight : demoText.themeToggle.tooltipToDark;
    menuLabel.textContent = dark ? demoText.themeToggle.menuLabelToLight : demoText.themeToggle.menuLabelToDark;
  }
  render(theme.isDark());
  button.addEventListener('click', () => theme.toggle());
  const unsubscribe = theme.onChange(render);
  return { el: button, destroy: unsubscribe };
}

export function backToDemosButton(onBackToDemos: () => void): HTMLElement {
  const button = el('button', {
    className: 'demo-btn demo-btn-secondary mochart-demo-back-button',
    attrs: {
      type: 'button',
      title: demoText.backToDemos.tooltip,
      'aria-label': demoText.backToDemos.aria
    }
  }, [
    icon('chevron-left', { size: 'lg', fixedWidth: true }),
    el('span', { className: 'btn-label', text: demoText.backToDemos.label })
  ]);
  button.addEventListener('click', onBackToDemos);
  return button;
}
