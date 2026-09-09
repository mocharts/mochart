import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import type { AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { createJsonEditorContent } from '@mochart/demo-common';

import type { JsonEditorContentHandle, JsonEditorContentOptions } from '@mochart/demo-common';

// CodeMirror-backed replacement for the old TextAreaContent: same controlled
// value/onChange contract. Programmatic values flow through setValue; user
// edits report up and their echo is skipped, so typing is never re-set.
@Component({
  selector: 'app-json-editor-content',
  styles: [':host { display: contents; }'],
  template: '<div class="mochart-demo-text-area-container" #host></div>'
})
export class JsonEditorContent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) value!: string;
  @Input({ required: true }) ariaLabel!: string;
  @Input() readOnly = false;
  @Input() formatOnSet = false;
  /** Attach the Mochart config completions/validation/hover support. */
  @Input() mochartSupport = false;
  @Input() onChange?: (value: string) => void;

  @ViewChild('host', { static: true }) hostElement!: ElementRef<HTMLDivElement>;

  private handle: JsonEditorContentHandle | null = null;
  private lastUserValue: string | null = null;

  ngAfterViewInit(): void {
    const options: JsonEditorContentOptions = {
      value: this.value,
      ariaLabel: this.ariaLabel,
      readOnly: this.readOnly,
      formatOnSet: this.formatOnSet,
      // The parent's handler writes signals, which schedules the zoneless
      // change detection (the phone-viewport pattern for DOM callbacks).
      onChange: text => {
        this.lastUserValue = text;
        this.onChange?.(text);
      }
    };
    if (this.mochartSupport) {
      options.support = editor => editor.createMochartConfigSupport();
    }
    this.handle = createJsonEditorContent(options);
    this.hostElement.nativeElement.appendChild(this.handle.el);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const valueChange = changes['value'];
    if (valueChange && !valueChange.firstChange) {
      // Skip the echo of the user's own edit; everything else is programmatic.
      if (this.value !== this.lastUserValue) {
        this.lastUserValue = null;
        this.handle?.setValue(this.value);
      }
    }
  }

  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  format(): boolean {
    return this.handle?.format() ?? false;
  }

  ngOnDestroy(): void {
    if (this.handle !== null) {
      this.handle.destroy();
      this.handle.el.remove();
      this.handle = null;
    }
  }
}
