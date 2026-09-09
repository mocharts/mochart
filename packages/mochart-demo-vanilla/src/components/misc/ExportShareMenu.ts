import { controlsMenuPlacement, createMenuController, createShareLinkCopier, demoText } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import { el, icon } from './dom';

// A collapsed export/share menu placed at the end of each mode's controls row.
// The trigger uses a share icon; the menu holds PNG / SVG downloads and (when a
// share state is provided) a copy-share-link item. The caller supplies the
// export actions so this component stays agnostic about single vs. tiled charts.
//
// Open/close, the fixed-position arithmetic, dismissal, focus and the
// disclosure ARIA all live in demo-common's `createMenuController` — including
// the reason any of it is hand-rolled (the controls strips clip an
// absolutely-positioned dropdown, and the chart's interaction rect eats clicks
// through anything stacked below it). What stays here is what the controller
// does not know about: the items, their copied label, and `disabled`.
export interface ExportShareMenuProps {
  exportPng: () => void;
  exportSvg: () => void;
  /** Omit to hide the Share item (e.g. a chart whose state isn't shareable). */
  getShareState?: () => ShareState;
  disabled?: boolean;
}

export interface ExportShareMenuHandle {
  el: HTMLElement;
  setDisabled(disabled: boolean): void;
  /**
   * Dismiss without waiting for a press. Needed because the pane a menu hangs
   * off can be taken off screen without anything being pressed — switching tabs
   * only marks the old pane `inert`, and an open panel is `position: fixed`, so
   * it would go on floating over the pane that replaced it.
   */
  close(): void;
  destroy(): void;
}

export function exportShareMenu(props: ExportShareMenuProps): ExportShareMenuHandle {
  const { exportPng, exportSvg, getShareState } = props;

  let copied = false;
  const shareLinkCopier = createShareLinkCopier(nextCopied => {
    copied = nextCopied;
    renderShare();
  });

  // No `aria-haspopup`/`aria-expanded` here: the controller wires the
  // disclosure ARIA itself (and strips `aria-haspopup`, which promised a
  // keyboard menu this markup never implemented).
  const trigger = el('button', {
    className: 'demo-btn demo-btn-secondary demo-menu-trigger',
    attrs: {
      type: 'button',
      title: demoText.exportShareMenu.trigger.tooltip,
      'aria-label': demoText.exportShareMenu.trigger.aria
    }
  }, [icon('share-nodes', { size: 'lg', fixedWidth: true })]);
  trigger.disabled = props.disabled ?? false;

  const pngItem = el('button', {
    className: 'demo-menu-item',
    attrs: { type: 'button', 'aria-label': demoText.exportButtons.png.aria }
  }, [
    icon('file-image', { fixedWidth: true }), ' ',
    el('span', { text: demoText.exportButtons.png.label })
  ]);
  pngItem.addEventListener('click', () => runAndClose(exportPng));

  const svgItem = el('button', {
    className: 'demo-menu-item',
    attrs: { type: 'button', 'aria-label': demoText.exportButtons.svg.aria }
  }, [
    icon('file-code', { fixedWidth: true }), ' ',
    el('span', { text: demoText.exportButtons.svg.label })
  ]);
  svgItem.addEventListener('click', () => runAndClose(exportSvg));

  const menu = el('div', { className: 'demo-menu' }, [pngItem, svgItem]);

  // Share item is only mounted when the caller offers a share state.
  let shareItem: HTMLButtonElement | null = null;
  let shareIconEl: HTMLSpanElement | null = null;
  let shareLabelSpan: HTMLSpanElement | null = null;
  if (getShareState) {
    shareIconEl = icon('link', { fixedWidth: true });
    shareLabelSpan = el('span', { text: demoText.shareButton.label });
    shareItem = el('button', {
      className: 'demo-menu-item',
      attrs: { type: 'button', 'aria-label': demoText.shareButton.aria }
    }, [shareIconEl, ' ', shareLabelSpan]);
    shareItem.addEventListener('click', onShare);
    menu.append(el('div', { className: 'demo-menu-divider' }), shareItem);
  }

  const root = el('div', { className: 'demo-btn-group mochart-export-share-menu' }, [trigger, menu]);

  // The controller binds the trigger's click to `toggle()` itself.
  const controller = createMenuController({
    trigger,
    panel: menu,
    placement: controlsMenuPlacement
  });

  function renderShare(): void {
    if (shareItem === null || shareIconEl === null || shareLabelSpan === null) {
      return;
    }
    const nextIcon = icon(copied ? 'check' : 'link', { fixedWidth: true });
    shareItem.replaceChild(nextIcon, shareIconEl);
    shareIconEl = nextIcon;
    shareLabelSpan.textContent = copied ? demoText.shareButton.tooltipCopied : demoText.shareButton.label;
  }

  function runAndClose(action: () => void): void {
    action();
    controller.close();
  }

  function onShare(): void {
    if (!getShareState) {
      return;
    }
    shareLinkCopier.copy(getShareState());
    controller.close();
  }

  return {
    el: root,
    setDisabled(disabled: boolean) {
      trigger.disabled = disabled;
      // The controller knows nothing about `disabled`. A disabled button fires
      // no `click`, so it cannot be opened — but a menu that is already open
      // when its trigger is disabled would otherwise stay open with no way back
      // to it.
      if (disabled) {
        controller.close();
      }
    },
    close() {
      controller.close();
    },
    destroy() {
      controller.destroy();
      shareLinkCopier.dispose();
    }
  };
}
