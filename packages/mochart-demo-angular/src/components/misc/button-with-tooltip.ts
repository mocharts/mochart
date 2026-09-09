import { Component, Input } from '@angular/core';

/**
 * The native title attribute covers the hover hint without a popper-style
 * positioning library. tooltipPlacement is accepted for call-site parity
 * but unused. `label`
 * renders visible text beside the icon; `pressed` marks the button as a
 * toggle (aria-pressed + active styling). The aria-label lands on the
 * button element via the `aria-label` input alias.
 *
 * `menuLabel` is text shown ONLY once the button has been folded into a phone
 * overflow menu, where an icon-only button would be a bare glyph in a column
 * of bare glyphs. Deliberately not `label`: a real label renders visible text
 * in the strips above 900px, where these buttons are icon-only by design.
 * `.btn-menu-label` is `display: none` everywhere except inside a `.demo-menu`.
 */
@Component({
  selector: 'app-button-with-tooltip',
  styles: [':host { display: contents; }'],
  // A static `id` attribute binds to the input below AND lands on the host, so null the host copy and leave the id on the real button.
  host: { '[attr.id]': 'null' },
  template: `
    <!-- Unstyled wrapper: it keeps the button one flex item wherever it is folded. -->
    <span>
      <button [attr.id]="id ?? null" type="button" [class]="'demo-btn demo-btn-' + color + (pressed ? ' active' : '')"
              [disabled]="disabled" [attr.title]="tooltipText ?? null"
              [attr.aria-pressed]="pressed === undefined ? null : pressed"
              [attr.aria-label]="ariaLabel ?? null" (click)="onClick()">
        <ng-content />@if (menuLabel) {<span class="btn-menu-label">{{ menuLabel }}</span>}@if (label) {<span class="btn-label">{{ label }}</span>}
      </button>
    </span>
  `
})
export class ButtonWithTooltip {
  // Optional: the single-chart controls are rendered twice, so their buttons carry no id.
  @Input() id?: string;
  @Input() tooltipText?: string;
  @Input() tooltipPlacement?: string;
  @Input() disabled = false;
  @Input({ required: true }) onClick!: () => void;
  @Input() color = 'secondary';
  @Input() label?: string;
  @Input() menuLabel?: string;
  @Input() pressed?: boolean;
  @Input('aria-label') ariaLabel?: string;
}
