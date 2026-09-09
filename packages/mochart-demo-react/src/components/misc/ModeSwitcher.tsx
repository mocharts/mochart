// The in-demo navigation strip pieces: gallery back link and Single/Multi/Random mode switcher (transition/rotation are gallery pages, not modes).

import React from 'react';
import Icon from './Icon';

import { demoModeIcons, demoText, getAvailableDemoModes, initTheme } from '@mochart/demo-common';
import type { SwitchableDemoMode } from '@mochart/demo-common';

import { usePhoneViewport } from './usePhoneViewport';

import type { OnModeChanged, OnBackToDemos } from '../../types';

// One controller for the whole app; every view's toggle button shares it.
const theme = initTheme();

interface ModeSwitcherProps {
  demoMode: SwitchableDemoMode;
  onModeChanged: OnModeChanged;
}

export function ModeSwitcher({ demoMode, onModeChanged }: ModeSwitcherProps) {
  const isPhone = usePhoneViewport();
  return (
    <div className="mochart-demo-mode-switcher">
      <span className="demo-label">{demoText.modeSwitcher.label}</span>
      {/* A named group, not a toolbar: independently tabbable buttons, no arrow-key handling. */}
      <div className="demo-toolbar" role="group" aria-label={demoText.modeSwitcher.groupAria}>
        {getAvailableDemoModes(isPhone).map(mode => {
          const current = mode === demoMode;
          const { label, title } = demoText.modeSwitcher.modes[mode];
          // In the strip the current mode is a filled disabled segment; in the phone overflow menu disabled reads as unavailable, so it gets the `.active` tint and is inert instead.
          return (
            <button key={mode} type="button"
              className={"demo-btn demo-btn-" + (current ? 'primary' : 'secondary') + (current && isPhone ? ' active' : '')}
              disabled={current && !isPhone} title={title}
              aria-current={current ? 'page' : undefined}
              onClick={() => { if (!current) { onModeChanged(mode); } }}>
              <Icon size="lg" fixedWidth={true} name={demoModeIcons[mode]} /><span className="btn-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Link back to the docs site root (a real anchor so middle-click works); renders nothing when no site root is configured. */
export function SiteRootButton({ siteRootUrl }: { siteRootUrl?: string }) {
  if (siteRootUrl === undefined) {
    return null;
  }
  return (
    <a className="demo-btn demo-btn-secondary mochart-demo-site-root-button" href={siteRootUrl}
      title={demoText.siteRootLink.tooltip} aria-label={demoText.siteRootLink.aria}>
      <Icon size="lg" fixedWidth={true} name="house" /><span className="btn-label">{demoText.siteRootLink.shortLabel}</span>
    </a>
  );
}

/** Icon-only light/dark toggle sharing the docs site's theme choice; the `.btn-menu-label` text shows only inside the phone overflow menu. */
export function ThemeToggleButton() {
  const [dark, setDark] = React.useState(theme.isDark());
  React.useEffect(() => theme.onChange(setDark), []);
  return (
    <button type="button" className="demo-btn demo-btn-secondary mochart-demo-theme-toggle"
      title={dark ? demoText.themeToggle.tooltipToLight : demoText.themeToggle.tooltipToDark}
      aria-label={demoText.themeToggle.aria} onClick={() => { theme.toggle(); }}>
      <Icon size="lg" name={dark ? 'sun' : 'moon'} fixedWidth />
      <span className="btn-menu-label">{dark ? demoText.themeToggle.menuLabelToLight : demoText.themeToggle.menuLabelToDark}</span>
    </button>
  );
}

export function BackToDemosButton({ onBackToDemos }: { onBackToDemos: OnBackToDemos }) {
  return (
    <button type="button" className="demo-btn demo-btn-secondary mochart-demo-back-button" title={demoText.backToDemos.tooltip}
      aria-label={demoText.backToDemos.aria} onClick={() => { onBackToDemos(); }}>
      <Icon size="lg" fixedWidth={true} name="chevron-left" /><span className="btn-label">{demoText.backToDemos.label}</span>
    </button>
  );
}
