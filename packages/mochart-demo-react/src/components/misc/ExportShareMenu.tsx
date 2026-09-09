import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

import { controlsMenuPlacement, createShareLinkCopier, demoText } from '@mochart/demo-common';
import type { ShareLinkCopier, ShareState } from '@mochart/demo-common';

import { useMenu } from './useMenu';

// A collapsed export/share menu placed at the end of each mode's controls row.
// The trigger uses a share icon; the menu holds PNG / SVG downloads and (when a
// share state is provided) a copy-share-link item. The parent supplies the
// export actions so this component stays agnostic about single vs. tiled charts.
//
// Positioning, dismissal, focus return and the disclosure ARIA come from
// `useMenu` (demo-common's menu geometry + dismissal under react state) —
// including the reason any of it is hand-rolled: the controls strips clip an
// absolutely-positioned dropdown, and the chart's interaction rect eats clicks
// through anything stacked below it. What stays here is what the hook does not
// know about: the items, their copied label, and `disabled`.
interface Props {
  exportPng: () => void;
  exportSvg: () => void;
  /** Omit to hide the Share item (e.g. a chart whose state isn't shareable). */
  getShareState?: () => ShareState;
  disabled?: boolean;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert,
   * and an open panel is `position: fixed` — it would keep painting over the
   * pane that replaced this one. False closes the menu.
   */
  active?: boolean;
}

export default function ExportShareMenu({ exportPng, exportSvg, getShareState, disabled = false, active = true }: Props) {
  const [copied, setCopied] = useState(false);
  // `setCopied` is stable, so one lazily created copier lasts the component's life.
  const shareLinkCopier = useRef<ShareLinkCopier | null>(null);
  if (shareLinkCopier.current === null) {
    shareLinkCopier.current = createShareLinkCopier(setCopied);
  }

  const menu = useMenu({ placement: controlsMenuPlacement });
  const { close } = menu;

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  useEffect(() => {
    if (disabled || !active) {
      close();
    }
  }, [disabled, active, close]);

  useEffect(() => {
    const copier = shareLinkCopier.current;
    return () => copier?.dispose();
  }, []);

  const runAndClose = (action: () => void) => {
    action();
    close();
  };

  const onShare = () => {
    if (!getShareState) {
      return;
    }
    shareLinkCopier.current?.copy(getShareState());
    close();
  };

  return (
    <div className="demo-btn-group mochart-export-share-menu">
      <button type="button" ref={menu.triggerRef} {...menu.triggerProps}
        className={'demo-btn demo-btn-secondary demo-menu-trigger' + (menu.open ? ' active' : '')}
        disabled={disabled}
        title={demoText.exportShareMenu.trigger.tooltip} aria-label={demoText.exportShareMenu.trigger.aria}>
        <Icon size="lg" fixedWidth={true} name="share-nodes" />
      </button>
      <div ref={menu.panelRef} {...menu.panelProps}
        className={'demo-menu' + (menu.isPositioned ? ' open' : '')}>
        <button type="button" className="demo-menu-item" onClick={() => runAndClose(exportPng)}
          aria-label={demoText.exportButtons.png.aria}>
          <Icon fixedWidth={true} name="file-image" /> <span>{demoText.exportButtons.png.label}</span>
        </button>
        <button type="button" className="demo-menu-item" onClick={() => runAndClose(exportSvg)}
          aria-label={demoText.exportButtons.svg.aria}>
          <Icon fixedWidth={true} name="file-code" /> <span>{demoText.exportButtons.svg.label}</span>
        </button>
        {getShareState ? (
          <React.Fragment>
            <div className="demo-menu-divider" />
            <button type="button" className="demo-menu-item" onClick={onShare}
              aria-label={demoText.shareButton.aria}>
              <Icon fixedWidth={true} name={copied ? 'check' : 'link'} /> <span>{copied ? demoText.shareButton.tooltipCopied : demoText.shareButton.label}</span>
            </button>
          </React.Fragment>
        ) : null}
      </div>
    </div>
  );
}
