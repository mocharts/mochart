import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import { demoText, getReferenceSectionIds, getReferenceSectionUrl } from '@mochart/demo-common';

// Stateless building blocks kept as plain lit-html template functions rather
// than custom elements — the natural Lit altitude for the Vue demo's Icon /
// ButtonWithTooltip components.

interface IconProps {
  name: string;
  size?: string;
  fixedWidth?: boolean;
  flip?: string;
  /** For the rare icon that carries its own layout (`margin-left: auto`). */
  style?: string;
}

/**
 * Font Awesome 6 solid icon (css classes only), same as the Vue demo's Icon
 * component. Relies on the `@fortawesome/fontawesome-free` css being imported.
 */
export function icon({ name, size, fixedWidth, flip, style }: IconProps): TemplateResult {
  const list = ['fa-solid', `fa-${name}`];
  if (size) {
    list.push(`fa-${size}`);
  }
  if (fixedWidth) {
    list.push('fa-fw');
  }
  if (flip) {
    list.push(`fa-flip-${flip}`);
  }
  return html`<span aria-hidden="true" class=${list.join(' ')} style=${style ?? nothing}></span>`;
}

interface ButtonWithTooltipProps {
  // Optional: only buttons that exist once per page carry one (a per-chart
  // control would mint duplicate ids on the second chart).
  id?: string;
  tooltipText?: string;
  tooltipPlacement?: string;
  disabled?: boolean;
  onClick: () => void;
  color?: string;
  ariaLabel?: string;
  // `label` renders visible text beside the icon; `pressed` marks the button
  // as a toggle (aria-pressed + active styling).
  label?: string;
  // Text shown ONLY once the button has been folded into a phone overflow
  // menu, where an icon-only button would be a bare glyph in a column of bare
  // glyphs. Deliberately not `label`: a real label renders visible text in the
  // strips above 900px, where these buttons are icon-only by design.
  // `.btn-menu-label` is `display: none` everywhere except inside a menu.
  menuLabel?: string;
  pressed?: boolean;
}

/**
 * The native title attribute covers the hover hint without a popper-style
 * positioning library. tooltipPlacement is accepted for call-site parity
 * but unused.
 */
export function buttonWithTooltip(
  { id, tooltipText, disabled = false, onClick, color = 'secondary', ariaLabel, label, menuLabel, pressed }: ButtonWithTooltipProps,
  children: unknown
): TemplateResult {
  // Unstyled wrapper: it keeps the button one flex item wherever it is folded.
  return html`<span>
    <button id=${id ?? nothing} type="button" class=${`demo-btn demo-btn-${color}` + (pressed ? ' active' : '')} ?disabled=${disabled}
            title=${tooltipText ?? nothing} aria-label=${ariaLabel ?? nothing}
            aria-pressed=${pressed === undefined ? nothing : String(pressed)} @click=${() => onClick()}>
      ${children}${menuLabel ? html`<span class="btn-menu-label">${menuLabel}</span>` : nothing}${label ? html`<span class="btn-label">${label}</span>` : nothing}
    </button>
  </span>`;
}

/**
 * Links into the documentation site's config reference for the sections the
 * edited config actually uses (see demo-common docsLinks).
 */
export function docsLinks(config: Record<string, unknown> | null | undefined): unknown {
  const sectionIds = getReferenceSectionIds(config);
  if (sectionIds.length === 0) {
    return nothing;
  }
  return html`<div class="mochart-demo-docs-links">
    <span>${demoText.docsLinks.label} </span>
    ${sectionIds.map((sectionId, index) => html`${index > 0 ? ' · ' : nothing}<a href=${getReferenceSectionUrl(sectionId)} title=${demoText.docsLinks.tooltipPrefix + sectionId}>${sectionId}</a>`)}
  </div>`;
}
