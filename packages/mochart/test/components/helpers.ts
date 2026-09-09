/**
 * Shared jsdom test harness: fake frame clock, layout mocks, chart-handle teardown and bar-path parsing.
 * Only imports the leaf ChartDom module — fake timers must be installed before the library entry is imported.
 */
import { afterAll, afterEach, expect, vi } from 'vitest';
import type { ChartHandle } from '../../src/createChart';
import { getCssClass, getIdCssSelector, getCssClassMatchSelector } from '../../src/utils/ChartDom';

export const FRAME_MS = 16;

/** rAF-on-setTimeout shim + fake timers; call before dynamically importing the library. */
export function installFakeFrameClock(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), FRAME_MS) as unknown as number;
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
  vi.useFakeTimers({
    toFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'
    ]
  });
}

/** Advance the fake clock frame by frame until all tweens/timers settle; returns frames run. */
export function runFrames(maxFrames = 500): number {
  let frames = 0;
  while (vi.getTimerCount() > 0 && frames < maxFrames) {
    vi.advanceTimersByTime(FRAME_MS);
    frames++;
  }
  return frames;
}

export function advanceFrames(count: number): void {
  for (let i = 0; i < count && vi.getTimerCount() > 0; i++) {
    vi.advanceTimersByTime(FRAME_MS);
  }
}

/** jsdom has no layout; report every element as a fixed width×height box at the origin. */
export function mockBoundingClientRect(width: number, height: number): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return {
      x: 0, y: 0, left: 0, top: 0, right: width, bottom: height,
      width, height, toJSON: () => ({})
    } as DOMRect;
  });
}

const handles: ChartHandle<any>[] = [];

export function mountContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/** Register a chart handle for destruction after the current test. */
export function trackHandle<H extends ChartHandle<any>>(handle: H): H {
  handles.push(handle);
  return handle;
}

/** The most recently tracked handle (the chart the test just mounted). */
export function lastHandle<H extends ChartHandle<any> = ChartHandle<any>>(): H {
  return handles[handles.length - 1] as H;
}

afterEach(() => {
  for (const handle of handles) {
    handle.destroy();
  }
  handles.length = 0;
  if (vi.isFakeTimers()) {
    // let the shared rAF loop see the tweens finish; a cleared frame would leave it stuck for the next test
    runFrames();
    vi.clearAllTimers();
  }
  document.body.innerHTML = '';
});

afterAll(() => {
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
  }
});

export interface BarRect { x: number; y: number; width: number; height: number; path: SVGPathElement }

/** Parse a series' bar paths `M{x},{y}h{w}v{h}…` into rects. */
export function barRects(container: Element, seriesId: string): BarRect[] {
  const paths = container.querySelectorAll<SVGPathElement>(
    getIdCssSelector('series', seriesId) + ' path' + getCssClassMatchSelector(getCssClass('seriesBar'))
  );
  return Array.from(paths).map((path) => {
    const d = path.getAttribute('d') ?? '';
    const match = /^M(-?[\d.]+),(-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)/.exec(d);
    expect(match, `unexpected bar path: ${d}`).not.toBeNull();
    return { x: Number(match![1]), y: Number(match![2]), width: Number(match![3]), height: Number(match![4]), path };
  });
}
