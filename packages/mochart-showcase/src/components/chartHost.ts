// Chart host (adapted from demo-vanilla): mounts a chart into a container div
// and keeps it sized. Explicit `width`/`height` props always win; whichever
// dimension is omitted tracks the container's own size via ResizeObserver.
import { createChart, createDefaultChart } from '@mochart/core';
import type { ChartHandle } from '@mochart/core';

import { el } from '../ui/dom';

/* eslint-disable @typescript-eslint/no-explicit-any */
type CreateChartFn = (container: Element, props: any) => ChartHandle<any>;

export type ChartProps = Record<string, unknown>;

export interface ChartHostHandle {
  el: HTMLDivElement;
  update(props: ChartProps): void;
  destroy(): void;
}

interface Size {
  width: number;
  height: number;
}

function measure(container: HTMLElement): Size {
  const rect = container.getBoundingClientRect();
  return { width: Math.floor(rect.width), height: Math.floor(rect.height) };
}

function withSize(props: ChartProps, measured: Size): ChartProps {
  return {
    ...props,
    width: props.width === undefined ? measured.width : props.width,
    height: props.height === undefined ? measured.height : props.height
  };
}

function applyContainerSize(container: HTMLDivElement, props: ChartProps): void {
  container.style.width = typeof props.width === 'number' ? `${props.width}px` : '';
  container.style.height = typeof props.height === 'number' ? `${props.height}px` : '';
}

function mountHost(
  create: CreateChartFn,
  props: ChartProps,
  containerOptions: { className?: string; style?: string } = {}
): ChartHostHandle {
  const container = el('div', containerOptions);
  applyContainerSize(container, props);

  let lastProps = props;
  let measured = measure(container);
  let chart: ChartHandle<any> | null = null;
  let destroyed = false;

  // The chart measures text against the live DOM, so mount on the microtask
  // after the container is appended (the framework bindings mount from their
  // onMount/connected hooks for the same reason).
  queueMicrotask(() => {
    if (destroyed) {
      return;
    }
    measured = measure(container);
    chart = create(container, withSize(lastProps, measured));
  });

  const observer = new ResizeObserver(() => {
    const next = measure(container);
    if (next.width === measured.width && next.height === measured.height) {
      return;
    }
    measured = next;
    if (chart && (lastProps.width === undefined || lastProps.height === undefined)) {
      chart.update(withSize(lastProps, measured));
    }
  });
  observer.observe(container);

  return {
    el: container,
    update(nextProps: ChartProps) {
      lastProps = nextProps;
      applyContainerSize(container, nextProps);
      if (chart) {
        chart.update(withSize(nextProps, measured));
      }
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      if (chart) {
        chart.destroy();
        chart = null;
      }
    }
  };
}

/** Mount a chart from a pre-enhanced `mochartConfig` plus a data provider. */
export function mountChart(
  props: ChartProps,
  containerOptions: { className?: string; style?: string } = {}
): ChartHostHandle {
  return mountHost(createChart as CreateChartFn, props, containerOptions);
}

/** Mount a chart from a raw config plus a plain array-of-objects dataset. */
export function mountDefaultChart(
  props: ChartProps,
  containerOptions: { className?: string; style?: string } = {}
): ChartHostHandle {
  return mountHost(createDefaultChart as CreateChartFn, props, containerOptions);
}
