import { demoText, formatData, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { Component, Input, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { JsonEditorContent } from '../misc/json-editor-content';

@Component({
  selector: 'app-random-data-tab',
  imports: [JsonEditorContent],
  styles: [':host { display: contents; }'],
  template: `
    <div [id]="panelAttrs.id" [attr.role]="panelAttrs.role" [attr.aria-labelledby]="panelAttrs['aria-labelledby']"
         [class]="'mochart-demo-tab-container demo-layout-col data' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
      <div class="mochart-demo-tab-content">
        <app-json-editor-content [value]="dataText()" [ariaLabel]="text.editorAria" [readOnly]="true" />
      </div>
    </div>
  `
})
export class RandomDataTab implements OnInit, OnChanges {
  readonly panelAttrs = getDemoTabPanelAttrs('data');

  @Input() active = false;
  @Input({ required: true }) data: unknown;

  readonly text = demoText.randomDataTab;

  dataText = signal('');

  ngOnInit(): void {
    this.dataText.set(formatData(this.data));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const dataChange = changes['data'];
    if (dataChange && !dataChange.firstChange) {
      this.dataText.set(formatData(this.data));
    }
  }
}
