import { ApplicationRef, Directive, ElementRef, EnvironmentInjector, EventEmitter, Input, Output, PLATFORM_ID, inject } from '@angular/core';
import type { AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import type { Bounds, ChartEventPayload, ChartFocus, ChartSeriesClickPayload, ChartSeriesFilter, ChartSliceClickPayload } from '@mochart/core';
import { mountChartHost } from './host.js';
import type { CreateChartFn, HostHandle } from './host.js';
import { createPlaceholderAdapter } from './placeholders.js';
import type { PlaceholderComponent } from './types.js';

/** An EventEmitter that pings after subscribe/unsubscribe, so the chart can re-sync its callback props. */
class ResyncingEventEmitter<T> extends EventEmitter<T> {
  onObservedChange?: () => void;
  override subscribe(next?: any, error?: any, complete?: any): ReturnType<EventEmitter<T>['subscribe']> {
    const subscription = super.subscribe(next, error, complete);
    this.onObservedChange?.();
    const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
    subscription.unsubscribe = () => {
      originalUnsubscribe();
      this.onObservedChange?.();
    };
    return subscription;
  }
}

/**
 * Shared input/output surface and chart lifecycle for `Chart` and
 * `DefaultChart`. The component's own host element is the container the chart
 * mounts into: explicit `width`/`height` inputs are set on it as pixel styles,
 * and whichever dimension is omitted tracks the host element's size.
 */
@Directive({
  host: {
    '[style.width.px]': 'width ?? null',
    '[style.height.px]': 'height ?? null'
  }
})
export abstract class BaseChart implements AfterViewInit, OnChanges, OnDestroy {
  /** Explicit pixel width; omit to track the host element's width. */
  @Input() width?: number;
  /** Explicit pixel height; omit to track the host element's height. */
  @Input() height?: number;
  @Input() loading?: boolean;
  @Input() error?: unknown;
  /** `data-testid` attribute applied to the host element, for test selectors. */
  @Input() dataTestId?: string;
  @Input() loadingComponent?: PlaceholderComponent;
  @Input() errorComponent?: PlaceholderComponent;
  @Input() noDataComponent?: PlaceholderComponent;
  @Input() noSizeComponent?: PlaceholderComponent;
  @Input() noSeriesComponent?: PlaceholderComponent;
  @Input() configErrorComponent?: PlaceholderComponent;
  /**
   * Controlled focused category index (-1 = none). When set it overrides the
   * chart's internal focus on every update; pass back the value reported by
   * `focusChange` to keep several charts in sync. Omit to leave focus chart-managed.
   */
  @Input() focusedCategoryIndex?: number;
  /** Controlled focused value-axis id (null = none). See `focusedCategoryIndex`. */
  @Input() focusedValueAxisId?: string | null;
  /** Controlled focused series id (null = none); use the id of a series that does not set `followSeries`. See `focusedCategoryIndex`. */
  @Input() focusedSeriesId?: string | null;
  /**
   * Controlled filter map (series id → true = filtered out); pass back the
   * map reported by `seriesFilter` to sync legend filtering across charts.
   * Key it by series that do not set `followSeries`: a series that follows another filters with it.
   */
  @Input() filteredSeriesIds?: Record<string, boolean>;

  @Output() chartClick = this.chartOutput<ChartEventPayload>();
  @Output() sliceClick = this.chartOutput<ChartSliceClickPayload>();
  @Output() seriesClick = this.chartOutput<ChartSeriesClickPayload>();
  @Output() chartMouseEnter = this.chartOutput<ChartEventPayload>();
  @Output() chartMouseMove = this.chartOutput<ChartEventPayload>();
  @Output() chartMouseLeave = this.chartOutput<ChartEventPayload>();
  @Output() titleClick = this.chartOutput<void>();
  @Output() focusChange = this.chartOutput<ChartFocus>();
  @Output() seriesFilter = this.chartOutput<ChartSeriesFilter>();
  @Output() seriesLayoutBoundsChange = this.chartOutput<Bounds>();

  private readonly elementRef = inject(ElementRef) as ElementRef<HTMLElement>;
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly applicationRef = inject(ApplicationRef);
  // same comparison isPlatformBrowser makes, without a @angular/common peer
  private readonly isBrowser = inject(PLATFORM_ID) === 'browser';
  private host: HostHandle | null = null;

  /** createChart or createDefaultChart from the mochart core. */
  protected abstract readonly create: CreateChartFn;
  /** The subclass-specific chart props (config and data). */
  protected abstract collectChartProps(): Record<string, any>;

  private callbackSyncScheduled = false;
  /** True while a lifecycle hook drives the chart, i.e. inside Angular's own change detection pass. */
  private inLifecycleHook = false;

  /** Outputs re-sync the callback props when (un)subscribed after mount, e.g. via @ViewChild. */
  private chartOutput<T = any>(): EventEmitter<T> {
    const emitter = new ResyncingEventEmitter<T>();
    emitter.onObservedChange = () => this.scheduleCallbackSync();
    return emitter;
  }

  private scheduleCallbackSync(): void {
    // before the mount there is nothing to re-sync: the mount reads the current subscriptions itself
    if (this.callbackSyncScheduled || this.host === null) {
      return;
    }
    this.callbackSyncScheduled = true;
    queueMicrotask(() => {
      this.callbackSyncScheduled = false;
      this.host?.update(this.buildProps());
    });
  }

  private buildProps(): Record<string, any> {
    const props: Record<string, any> = {
      ...this.collectChartProps(),
      width: this.width,
      height: this.height,
      loading: this.loading,
      error: this.error,
      loadingComponent: this.loadingComponent,
      errorComponent: this.errorComponent,
      noDataComponent: this.noDataComponent,
      noSizeComponent: this.noSizeComponent,
      noSeriesComponent: this.noSeriesComponent,
      configErrorComponent: this.configErrorComponent,
      focusedCategoryIndex: this.focusedCategoryIndex,
      focusedValueAxisId: this.focusedValueAxisId,
      focusedSeriesId: this.focusedSeriesId,
      filteredSeriesIds: this.filteredSeriesIds
    };
    // Only subscribed outputs are forwarded to the core: some core behaviors
    // (e.g. clickable-title styling) switch on the presence of a callback.
    // Subscription changes after mount re-run this via scheduleCallbackSync.
    const callbacks: [EventEmitter<any>, string][] = [
      [this.chartClick, 'onChartClick'],
      [this.sliceClick, 'onSliceClick'],
      [this.seriesClick, 'onSeriesClick'],
      [this.chartMouseEnter, 'onChartMouseEnter'],
      [this.chartMouseMove, 'onChartMouseMove'],
      [this.chartMouseLeave, 'onChartMouseLeave'],
      [this.titleClick, 'onTitleClick'],
      [this.focusChange, 'onFocus'],
      [this.seriesFilter, 'onSeriesFilter'],
      [this.seriesLayoutBoundsChange, 'onSeriesLayoutBoundsChange']
    ];
    for (const [emitter, coreName] of callbacks) {
      if (emitter.observed) {
        props[coreName] = (payload: any) => this.emitOutput(emitter, payload);
      }
    }
    return props;
  }

  // Emitting while Angular refreshes views only marks the host dirty (never refresh-scheduled), so a
  // plain-field OnPush host never re-renders and an Eager host trips NG0100: defer those to a microtask.
  private emitOutput(emitter: EventEmitter<any>, payload: any): void {
    if (this.inLifecycleHook) {
      queueMicrotask(() => {
        if (this.host !== null) {
          emitter.emit(payload);
        }
      });
    }
    else {
      emitter.emit(payload);
    }
  }

  private runInLifecycleHook(work: () => void): void {
    this.inLifecycleHook = true;
    try {
      work();
    }
    finally {
      this.inLifecycleHook = false;
    }
  }

  /**
   * Re-read the current config/data (rebuilding or re-indexing the data
   * provider) without needing new references — the escape hatch for hosts
   * that mutate data in place. Reach it through a template reference
   * variable or `@ViewChild`.
   */
  refresh(): void {
    this.host?.refresh();
  }

  ngAfterViewInit(): void {
    // Under SSR this runs on the server too; the chart only mounts in a browser.
    if (!this.isBrowser) {
      return;
    }
    const placeholders = createPlaceholderAdapter(this.environmentInjector, this.applicationRef);
    this.runInLifecycleHook(() => {
      this.host = mountChartHost(this.create, this.elementRef.nativeElement, this.buildProps(), placeholders);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // set imperatively, not host-bound: a static data-testid attribute must
    // survive when the input is never used
    if ('dataTestId' in changes) {
      if (this.dataTestId !== undefined) {
        this.elementRef.nativeElement.setAttribute('data-testid', this.dataTestId);
      }
      else {
        this.elementRef.nativeElement.removeAttribute('data-testid');
      }
    }
    // Before the first render `host` is null and the mount picks up the
    // current input values itself.
    this.runInLifecycleHook(() => {
      this.host?.update(this.buildProps());
    });
  }

  ngOnDestroy(): void {
    const current = this.host;
    this.host = null;
    current?.destroy();
  }
}
