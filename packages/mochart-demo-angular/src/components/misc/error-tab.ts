import { AfterViewInit, Component, ContentChild, Input, OnDestroy, TemplateRef, ViewChild, ViewContainerRef, inject, signal } from '@angular/core';

import { demoText } from '@mochart/demo-common';

import { DemoErrorService } from './demo-error-handler';

/**
 * Fallback-UI stand-in for the react demo's ErrorTab error boundary. Angular
 * has no subtree error capture, so this catches mount-time errors itself —
 * the content `ng-template` (see the call sites) is instantiated manually and
 * its first change detection runs inside a try/catch, so a crashing tab can't
 * abort the surrounding creation pass. Later errors surface through the
 * global DemoErrorHandler, which notifies every error tab and the active one
 * claims the failure — the closest attribution the global handler allows.
 * Flipping to the fallback destroys the @else view and the crashed subtree
 * with it, like the react boundary unmounting its children. The :host
 * display keeps the rendered pane a direct flex child of the surrounding
 * content.
 */
@Component({
  selector: 'app-error-tab',
  styles: [':host { display: contents; }'],
  template: `
    @if (failed()) {
      <div [class]="'mochart-demo-tab-container error' + (active ? ' active' : '')" [attr.inert]="active ? null : ''">
        <div class="demo-alert demo-alert-error demo-text-center mochart-demo-error-message" role="alert">
          {{ errorOccurred }}
        </div>
      </div>
    } @else {
      <ng-container #outlet></ng-container>
    }
  `
})
export class ErrorTab implements AfterViewInit, OnDestroy {
  @Input() active = false;
  @ContentChild(TemplateRef, { static: true }) content: TemplateRef<unknown> | null = null;
  @ViewChild('outlet', { read: ViewContainerRef }) outlet: ViewContainerRef | undefined;

  readonly failed = signal(false);
  readonly errorOccurred = demoText.errors.errorOccurred;

  private readonly errors = inject(DemoErrorService);
  private unregister: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.unregister = this.errors.register(() => {
      if (this.active) {
        this.failed.set(true);
      }
    });
    if (this.content !== null && this.outlet !== undefined) {
      try {
        this.outlet.createEmbeddedView(this.content).detectChanges();
      }
      catch (error) {
        console.error(error);
        this.outlet.clear();
        this.failed.set(true);
      }
    }
  }

  ngOnDestroy(): void {
    this.unregister?.();
    this.unregister = null;
  }
}
