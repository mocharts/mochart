import { html, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';

import { controlsMenuPlacement, createMenuController, createShareLinkCopier, demoText } from '@mochart/demo-common';
import type { MenuController, ShareLinkCopier, ShareState } from '@mochart/demo-common';

import { LightElement } from './LightElement';
import { icon } from './templates';

/**
 * A collapsed export/share menu placed at the end of each mode's controls row.
 * The trigger uses a share icon; the menu holds PNG / SVG downloads and (when a
 * share state is provided) a copy-share-link item. The parent supplies the
 * export actions so this element stays agnostic about single vs. tiled charts.
 *
 * Open/close, positioning, dismissal, focus return and the disclosure ARIA all
 * come from demo-common's `createMenuController` — including the reason any of
 * it is hand-rolled (the controls strips clip an absolutely-positioned
 * dropdown, and the chart's interaction rect eats clicks through anything
 * stacked below it). What stays here is what the controller does not know
 * about: the items, their copied label, and `disabled`.
 *
 * The trigger and panel carry STATIC classes and no `aria-expanded` or `style`
 * binding, because the controller writes those itself; an interpolated
 * attribute would clobber them on the next render. The controller is built in
 * `firstUpdated` because `@query` cannot see the elements before then.
 */
@customElement('export-share-menu')
export class ExportShareMenu extends LightElement {
  @property({ attribute: false }) exportPng: () => void = () => { /* no-op */ };
  @property({ attribute: false }) exportSvg: () => void = () => { /* no-op */ };
  /** Omit to hide the Share item (e.g. a chart whose state isn't shareable). */
  @property({ attribute: false }) getShareState?: () => ShareState;
  @property({ attribute: false }) disabled = false;
  /**
   * The hosting pane's active state. A deactivated pane is only marked inert,
   * and an open panel is `position: fixed` — it would keep painting over the
   * pane that replaced this one. False closes the menu.
   */
  @property({ attribute: false }) active = true;

  @state() private copied = false;

  @query('.demo-menu-trigger') private triggerElement?: HTMLButtonElement;
  @query('.demo-menu') private panelElement?: HTMLElement;

  private controller: MenuController | null = null;
  private shareLinkCopier: ShareLinkCopier = createShareLinkCopier(copied => { this.copied = copied; });

  override firstUpdated(): void {
    const trigger = this.triggerElement;
    const panel = this.panelElement;
    if (trigger === undefined || panel === undefined) {
      return;
    }
    this.controller = createMenuController({
      trigger,
      panel,
      placement: controlsMenuPlacement,
      bindTrigger: false
    });
  }

  // A disabled trigger fires no click, so the menu cannot be opened — but one
  // already open when its trigger is disabled would be stranded.
  override willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has('disabled') || changed.has('active')) && (this.disabled || !this.active)) {
      this.controller?.close();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.shareLinkCopier.dispose();
    this.controller?.destroy();
    this.controller = null;
  }

  private runAndClose(action: () => void): void {
    action();
    this.controller?.close();
  }

  private onShare = (): void => {
    if (!this.getShareState) {
      return;
    }
    this.shareLinkCopier.copy(this.getShareState());
    this.controller?.close();
  };

  override render(): unknown {
    // The trigger carries no id: the controller mints a unique one, so two charts stay distinct.
    return html`<div class="demo-btn-group mochart-export-share-menu">
      <button type="button"
              class="demo-btn demo-btn-secondary demo-menu-trigger"
              ?disabled=${this.disabled}
              title=${demoText.exportShareMenu.trigger.tooltip} aria-label=${demoText.exportShareMenu.trigger.aria}
              @click=${() => this.controller?.toggle()}>
        ${icon({ size: 'lg', fixedWidth: true, name: 'share-nodes' })}
      </button>
      <div class="demo-menu">
        <button type="button" class="demo-menu-item" @click=${() => this.runAndClose(this.exportPng)}
                aria-label=${demoText.exportButtons.png.aria}>
          ${icon({ fixedWidth: true, name: 'file-image' })} <span>${demoText.exportButtons.png.label}</span>
        </button>
        <button type="button" class="demo-menu-item" @click=${() => this.runAndClose(this.exportSvg)}
                aria-label=${demoText.exportButtons.svg.aria}>
          ${icon({ fixedWidth: true, name: 'file-code' })} <span>${demoText.exportButtons.svg.label}</span>
        </button>
        ${this.getShareState ? html`
          <div class="demo-menu-divider"></div>
          <button type="button" class="demo-menu-item" @click=${this.onShare}
                  aria-label=${demoText.shareButton.aria}>
            ${icon({ fixedWidth: true, name: this.copied ? 'check' : 'link' })} <span>${this.copied ? demoText.shareButton.tooltipCopied : demoText.shareButton.label}</span>
          </button>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-share-menu': ExportShareMenu;
  }
}
