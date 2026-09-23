import { Component, Input } from '@angular/core';

/**
 * Font Awesome 6 solid icon (css classes only). Relies on the
 * `@fortawesome/fontawesome-free` css being imported.
 */
@Component({
  selector: 'app-icon',
  styles: [':host { display: contents; }'],
  template: '<span aria-hidden="true" [class]="classes" [style]="iconStyle ?? null"></span>'
})
export class Icon {
  @Input({ required: true }) name!: string;
  @Input() size?: string;
  @Input() fixedWidth = false;
  @Input() flip?: string;
  /**
   * Inline style for the glyph span, for the rare icon that carries its own
   * layout (`margin-left: auto` on the notes disclosure's chevron).
   *
   * Not spelled `style`: a plain `style` on `<app-icon>` lands on the host,
   * and this component's host is `display: contents`, which generates no box
   * for a margin to act on. The other ports have no such indirection: their
   * icon component's root element *is* the glyph span.
   */
  @Input() iconStyle?: string;

  get classes(): string {
    const list = ['fa-solid', `fa-${this.name}`];
    if (this.size) {
      list.push(`fa-${this.size}`);
    }
    if (this.fixedWidth) {
      list.push('fa-fw');
    }
    if (this.flip) {
      list.push(`fa-flip-${this.flip}`);
    }
    return list.join(' ');
  }
}
