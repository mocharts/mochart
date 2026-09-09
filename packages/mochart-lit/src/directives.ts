import { noChange } from 'lit-html';
import { AsyncDirective, directive, PartType } from 'lit-html/async-directive.js';
import type { ChildPart, PartInfo } from 'lit-html/async-directive.js';
import { createChart, createDefaultChart } from '@mochart/core';
import { mountChartHost } from './host.js';
import type { CreateChartFn, HostHandle } from './host.js';
import type { ChartProps, ChartRef, DefaultChartProps } from './types.js';

/**
 * Child-part directive that renders a container div and mounts a chart into
 * it. The chart itself is mounted in a microtask after the render pass, once
 * the container is connected to the document, so the initial size measurement
 * sees real layout. Explicit `width`/`height` props always win; whichever
 * dimension is omitted tracks the container div's size.
 */
abstract class ChartHostDirective extends AsyncDirective {
  protected abstract readonly create: CreateChartFn;
  private container: HTMLDivElement | null = null;
  private host: HostHandle | null = null;
  private props: Record<string, any> = {};
  private mountQueued = false;
  private chartRefCallback: ((ref: ChartRef | null) => void) | null = null;
  // stable across renders, so callback consumers can hold onto it
  private readonly chartRef: ChartRef = { refresh: () => { this.host?.refresh(); } };

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD) {
      throw new Error('mochart-lit chart directives can only be used in child position');
    }
  }

  // All work happens in update(); render() only satisfies the directive
  // contract (it is what would run where there is no DOM, e.g. SSR).
  render(_props: Record<string, any>): unknown {
    return noChange;
  }

  override update(_part: ChildPart, [props]: [Record<string, any>]): unknown {
    // `className`/`style`/`dataTestId` belong to the container div and
    // `chartRef` to the directive, not the chart.
    const { className, style, dataTestId, chartRef, ...chartProps } = props;
    this.props = chartProps;
    if (this.container === null) {
      this.container = document.createElement('div');
    }
    const previousCallback = this.chartRefCallback;
    this.chartRefCallback = typeof chartRef === 'function' ? chartRef : null;
    // a callback swapped in after mount still gets the handle, and the one swapped out is told it lost it, like Lit's ref()
    if (this.host !== null && this.chartRefCallback !== previousCallback) {
      previousCallback?.(null);
      this.chartRefCallback?.(this.chartRef);
    }
    this.applyContainerProps(className, style, dataTestId);
    if (this.host !== null) {
      this.host.update(this.props);
    }
    else {
      this.queueMount();
    }
    // Committing the same node again is a no-op in lit-html.
    return this.container;
  }

  private applyContainerProps(className: unknown, style: unknown, dataTestId: unknown): void {
    const container = this.container!;
    container.className = typeof className === 'string' ? className : '';
    container.style.cssText = typeof style === 'string' ? style : '';
    if (typeof dataTestId === 'string') {
      container.setAttribute('data-testid', dataTestId);
    }
    else {
      container.removeAttribute('data-testid');
    }
    const { width, height } = this.props;
    if (typeof width === 'number') {
      container.style.width = `${width}px`;
    }
    if (typeof height === 'number') {
      container.style.height = `${height}px`;
    }
  }

  private queueMount(): void {
    if (this.mountQueued) {
      return;
    }
    this.mountQueued = true;
    queueMicrotask(() => {
      this.mountQueued = false;
      if (!this.isConnected || this.host !== null || this.container === null) {
        return;
      }
      this.host = mountChartHost(this.create, this.container, this.props);
      this.chartRefCallback?.(this.chartRef);
    });
  }

  override disconnected(): void {
    const host = this.host;
    this.host = null;
    if (host !== null) {
      this.chartRefCallback?.(null);
    }
    host?.destroy();
  }

  override reconnected(): void {
    this.queueMount();
  }
}

class ChartDirective extends ChartHostDirective {
  protected readonly create: CreateChartFn = createChart as CreateChartFn;
  override render(_props: ChartProps): unknown {
    return noChange;
  }
}

class DefaultChartDirective extends ChartHostDirective {
  protected readonly create: CreateChartFn = createDefaultChart as CreateChartFn;
  override render(_props: DefaultChartProps): unknown {
    return noChange;
  }
}

/**
 * lit-html directive around mochart's `createChart`: takes a pre-enhanced
 * config (`mochartConfig`) and a data provider. Omit `width`/`height` to have
 * the chart track the container div's size.
 */
export const chart = directive(ChartDirective);

/**
 * lit-html directive around mochart's `createDefaultChart`: takes a raw
 * `config` (enhanced internally) and a plain `data` — an array of objects or an object of arrays. Omit
 * `width`/`height` to have the chart track the container div's size.
 */
export const defaultChart = directive(DefaultChartDirective);
