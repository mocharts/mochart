// Deterministic jsdom + virtual clock for the config fuzzer. The same case must render the same DOM
// on every run and every machine, since DOM equality is what the oracles compare.
import { JSDOM } from 'jsdom';
import type { DOMWindow } from 'jsdom';
import { installTextMetrics } from '../golden/textMetrics';

export const FRAME_MS = 16;

interface Timer {
  id: number;
  time: number;
  seq: number;
  callback: (...args: unknown[]) => void;
  args: unknown[];
  repeat: number | null;
}

let now = 0;
let nextTimerId = 1;
let sequence = 0;
const timers = new Map<number, Timer>();

function schedule(callback: unknown, delay: unknown, args: unknown[], repeat: number | null): number {
  const id = nextTimerId++;
  if (typeof callback !== 'function') {
    return id;
  }
  const wait = typeof delay === 'number' && isFinite(delay) && delay > 0 ? delay : 0;
  timers.set(id, { id, time: now + wait, seq: sequence++, callback: callback as Timer['callback'], args, repeat });
  return id;
}

function cancel(id: unknown): void {
  if (typeof id === 'number') {
    timers.delete(id);
  }
}

/** Fire every timer already due at the current virtual time, including ones scheduled by those callbacks. */
function fireDue(): void {
  // guards a callback that re-schedules itself at zero delay forever
  for (let round = 0; round < 1000; round++) {
    const due = [...timers.values()].filter(timer => timer.time <= now).sort((a, b) => a.time - b.time || a.seq - b.seq);
    if (due.length === 0) {
      return;
    }
    for (const timer of due) {
      if (!timers.has(timer.id)) {
        continue;
      }
      if (timer.repeat === null) {
        timers.delete(timer.id);
      }
      else {
        timer.time = now + timer.repeat;
        timer.seq = sequence++;
      }
      timer.callback(...timer.args);
    }
  }
}

/** Advance frame by frame until nothing is pending; `settled` is false when the frame cap was hit first. */
export function runFrames(maxFrames: number): { frames: number; settled: boolean } {
  let frames = 0;
  while (timers.size > 0 && frames < maxFrames) {
    now += FRAME_MS;
    fireDue();
    frames++;
  }
  return { frames, settled: timers.size === 0 };
}

export function pendingTimerCount(): number {
  return timers.size;
}

/** Drop anything still scheduled and rewind the clock, so one case cannot perturb the next. */
export function resetClock(): void {
  timers.clear();
  now = 0;
  sequence = 0;
}

function installClock(window: DOMWindow): void {
  const target = globalThis as unknown as Record<string, unknown>;
  const clock = {
    setTimeout: (callback: unknown, delay?: unknown, ...args: unknown[]) => schedule(callback, delay, args, null),
    clearTimeout: cancel,
    setInterval: (callback: unknown, delay?: unknown, ...args: unknown[]) =>
      schedule(callback, delay, args, typeof delay === 'number' && delay > 0 ? delay : FRAME_MS),
    clearInterval: cancel,
    requestAnimationFrame: (callback: unknown) => schedule(callback, FRAME_MS, [now + FRAME_MS], null),
    cancelAnimationFrame: cancel
  };
  for (const [key, value] of Object.entries(clock)) {
    target[key] = value;
    (window as unknown as Record<string, unknown>)[key] = value;
  }
  const performanceNow = { now: () => now };
  Object.defineProperty(window, 'performance', { value: performanceNow, configurable: true });
  target.performance = performanceNow;
  Date.now = () => now;
}

function installWindowGlobals(window: DOMWindow): void {
  const target = globalThis as unknown as Record<string, unknown>;
  target.window = window;
  target.document = window.document;
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key.startsWith('_') || key in target) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window, key);
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    }
  }
}

/** Build the DOM globals, clock and text metrics; must run before the library is imported. */
export function installEnvironment(): void {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: false });
  installWindowGlobals(dom.window);
  installClock(dom.window);
  installTextMetrics();
}

export function mountContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

export function unmountContainer(container: HTMLDivElement): void {
  container.remove();
}
