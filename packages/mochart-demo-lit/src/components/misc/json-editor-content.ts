import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { createJsonEditorContent } from '@mochart/demo-common';

import type { JsonEditorContentHandle, JsonEditorContentOptions } from '@mochart/demo-common';

import { LightElement } from './LightElement';

// CodeMirror-backed replacement for the old textAreaContent template: same
// controlled value/onChange contract. Programmatic values flow through
// setValue; user edits report up and their echo is skipped, so typing is
// never re-set.
@customElement('json-editor-content')
export class JsonEditorContent extends LightElement {
  @property({ attribute: false }) value = '';
  /** Not `ariaLabel` — that name is the element's own ARIAMixin property. */
  @property({ attribute: false }) ariaLabelText = '';
  @property({ attribute: false }) readOnly = false;
  @property({ attribute: false }) formatOnSet = false;
  /** Attach the Mochart config completions/validation/hover support. */
  @property({ attribute: false }) mochartSupport = false;
  @property({ attribute: false }) onChange?: (value: string) => void;

  private handle: JsonEditorContentHandle | null = null;
  private lastUserValue: string | null = null;

  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  format(): boolean {
    return this.handle?.format() ?? false;
  }

  override firstUpdated(): void {
    const options: JsonEditorContentOptions = {
      value: this.value,
      ariaLabel: this.ariaLabelText,
      readOnly: this.readOnly,
      formatOnSet: this.formatOnSet,
      onChange: text => {
        this.lastUserValue = text;
        this.onChange?.(text);
      }
    };
    if (this.mochartSupport) {
      options.support = editor => editor.createMochartConfigSupport();
    }
    this.handle = createJsonEditorContent(options);
    this.querySelector('.mochart-demo-text-area-container')!.appendChild(this.handle.el);
  }

  override updated(changed: PropertyValues<this>): void {
    // Skip the echo of the user's own edit; everything else is programmatic.
    if (changed.has('value') && this.value !== this.lastUserValue) {
      this.lastUserValue = null;
      this.handle?.setValue(this.value);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.handle !== null) {
      this.handle.destroy();
      this.handle.el.remove();
      this.handle = null;
    }
  }

  override render(): unknown {
    return html`<div class="mochart-demo-text-area-container"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'json-editor-content': JsonEditorContent;
  }
}
