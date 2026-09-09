// The in-demo navigation strip pieces: a back link to the gallery and the
// Single/Multi/Random mode switcher. Transition/rotation are standalone
// gallery pages, not modes, so they don't appear here.
import { Component, Input, computed, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';

import { demoModeIcons, demoText, getAvailableDemoModes, initTheme } from '@mochart/demo-common';

import { Icon } from './icon';
import { phoneViewport } from './phone-viewport';

import type { SwitchableDemoMode } from '../../types';

// One controller for the whole app; every view's toggle button shares it.
const theme = initTheme();

@Component({
  selector: 'app-mode-switcher',
  imports: [Icon],
  styles: [':host { display: contents; }'],
  // A named group, not a toolbar: independently tabbable buttons, no arrow-key handling.
  // In the strip the current mode is a filled disabled segment; in the phone overflow menu disabled reads as unavailable, so it gets the `.active` tint and is inert instead.
  template: `
    <div class="mochart-demo-mode-switcher">
      <span class="demo-label">{{ text.label }}</span>
      <div class="demo-toolbar" role="group" [attr.aria-label]="text.groupAria">
        @for (mode of modes(); track mode) {
          <button type="button"
                  [class]="'demo-btn demo-btn-' + (mode === demoMode ? 'primary' : 'secondary') + (mode === demoMode && phone() ? ' active' : '')"
                  [disabled]="mode === demoMode && !phone()" [title]="text.modes[mode].title"
                  [attr.aria-current]="mode === demoMode ? 'page' : null"
                  (click)="onSelect(mode)">
            <app-icon size="lg" [fixedWidth]="true" [name]="modeIcons[mode]" /><span class="btn-label">{{ text.modes[mode].label }}</span>
          </button>
        }
      </div>
    </div>
  `
})
export class ModeSwitcher {
  @Input({ required: true }) demoMode!: SwitchableDemoMode;
  @Input({ required: true }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;

  readonly text = demoText.modeSwitcher;
  readonly modeIcons = demoModeIcons;

  readonly phone = phoneViewport();

  // Multi drops out below the phone breakpoint, so the offered modes have to
  // follow a rotation as well as the initial width.
  readonly modes = computed(() => getAvailableDemoModes(this.phone()));

  onSelect(mode: SwitchableDemoMode): void {
    if (mode !== this.demoMode) {
      this.onModeChanged(mode);
    }
  }
}

/**
 * Link back to the docs site root (a real anchor so middle-click works).
 * Attribute selector so the anchor itself is the nav-group child; the caller
 * binds [href] and only renders it when a site root is configured.
 */
@Component({
  selector: 'a[appSiteRootButton]',
  imports: [Icon],
  host: {
    class: 'demo-btn demo-btn-secondary mochart-demo-site-root-button',
    '[title]': 'text.tooltip',
    '[attr.aria-label]': 'text.aria'
  },
  template: '<app-icon size="lg" [fixedWidth]="true" name="house" /><span class="btn-label">{{ text.shortLabel }}</span>'
})
export class SiteRootButton {
  readonly text = demoText.siteRootLink;
}

/** Back link to the demo gallery; the caller binds (click). */
@Component({
  selector: 'button[appBackToDemosButton]',
  imports: [Icon],
  host: {
    class: 'demo-btn demo-btn-secondary mochart-demo-back-button',
    type: 'button',
    '[title]': 'text.tooltip',
    '[attr.aria-label]': 'text.aria'
  },
  template: '<app-icon size="lg" [fixedWidth]="true" name="chevron-left" /><span class="btn-label">{{ text.label }}</span>'
})
export class BackToDemosButton {
  readonly text = demoText.backToDemos;
}

/**
 * Icon-only light/dark toggle; shares the docs site's theme choice.
 *
 * The `.btn-menu-label` span is text for the phone fold only: folded into the
 * nav overflow menu this would be the one row with nothing to read, and the
 * class is `display: none` everywhere except inside a `.demo-menu`.
 */
@Component({
  selector: 'button[appThemeToggleButton]',
  imports: [Icon],
  host: {
    class: 'demo-btn demo-btn-secondary mochart-demo-theme-toggle',
    type: 'button',
    '[title]': 'dark() ? text.tooltipToLight : text.tooltipToDark',
    '[attr.aria-label]': 'text.aria',
    '(click)': 'toggle()'
  },
  template: `<app-icon size="lg" [name]="dark() ? 'sun' : 'moon'" [fixedWidth]="true" /><span class="btn-menu-label">{{ dark() ? text.menuLabelToLight : text.menuLabelToDark }}</span>`
})
export class ThemeToggleButton implements OnDestroy {
  readonly text = demoText.themeToggle;
  readonly dark = signal(theme.isDark());

  private readonly unsubscribe = theme.onChange(dark => this.dark.set(dark));

  toggle(): void {
    theme.toggle();
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
