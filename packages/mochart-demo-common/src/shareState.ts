// Shareable chart state encoded in the URL hash. Each demo mode carries the
// state needed to reproduce what's on screen; the demo id (and, for random,
// the step) already live in the URL path, so only the mode's own view state
// goes in the payload:
//   single — the (possibly edited) config and data
//   multi  — the grid size, playback step and interval
//   random — the (possibly edited) generator config, the reuse toggle and interval
// The payload is JSON, deflate-compressed (the data/config is very repetitive,
// so this shrinks links a lot) and base64url-encoded. Every gallery uses the
// same helpers: createShareLinkCopier from its share menu, consumeShareState
// once while mounting the matching view.

import { deflateSync, inflateSync } from 'fflate';

import { demoText } from './demoText';

import type { DataObject, DemoConfig, DemoRandomConfig } from './types';

export interface SingleShareState {
  mode: 'single';
  config: DemoConfig;
  data: DataObject[];
}

export interface MultiShareState {
  mode: 'multi';
  rows: number;
  cols: number;
  step: number;
  interval: number;
}

export interface RandomShareState {
  mode: 'random';
  randomConfig: DemoRandomConfig;
  applyReuse: boolean;
  interval: number;
}

export type ShareState = SingleShareState | MultiShareState | RandomShareState;

export const shareHashPrefix = '#share=';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeShareState(state: ShareState): string {
  const json = JSON.stringify(state);
  const compressed = deflateSync(new TextEncoder().encode(json));
  return bytesToBase64Url(compressed);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

// Hand-edited links bypass the demos' interval inputs; restore within the same 5–60000ms limits.
function clampInterval(value: number): number {
  return Math.min(60000, Math.max(5, value));
}

// Playback steps are counted up from 0; hand-edited fractions/negatives seek nonsense positions.
function normalizeStep(value: number): number {
  return Math.max(0, Math.round(value));
}

// Hand-edited links bypass the multi grid's 1–4 steppers too.
function clampGrid(value: number): number {
  return Math.min(4, Math.max(1, Math.round(value)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Decode a share payload; returns null for anything malformed. */
export function decodeShareState(encoded: string): ShareState | null {
  try {
    const json = new TextDecoder().decode(inflateSync(base64UrlToBytes(encoded)));
    const parsed: unknown = JSON.parse(json);
    if (!isPlainObject(parsed)) {
      return null;
    }
    switch (parsed.mode) {
      case 'single': {
        const { config, data } = parsed;
        if (!isPlainObject(config) || !Array.isArray(data)) {
          return null;
        }
        if (data.some(row => !isPlainObject(row))) {
          return null;
        }
        return { mode: 'single', config: config as DemoConfig, data: data as DataObject[] };
      }
      case 'multi': {
        const { rows, cols, step, interval } = parsed;
        if (!isFiniteNumber(rows) || !isFiniteNumber(cols) || !isFiniteNumber(step) || !isFiniteNumber(interval)) {
          return null;
        }
        return { mode: 'multi', rows: clampGrid(rows), cols: clampGrid(cols), step: normalizeStep(step), interval: clampInterval(interval) };
      }
      case 'random': {
        const { randomConfig, applyReuse, interval } = parsed;
        if (!isPlainObject(randomConfig) || typeof applyReuse !== 'boolean' || !isFiniteNumber(interval)) {
          return null;
        }
        return { mode: 'random', randomConfig: randomConfig as unknown as DemoRandomConfig, applyReuse, interval: clampInterval(interval) };
      }
      default:
        return null;
    }
  }
  catch {
    return null;
  }
}

/** The current view's URL with the given state encoded in its hash. */
export function buildShareUrl(state: ShareState): string {
  const { origin, pathname, search } = window.location;
  return origin + pathname + search + shareHashPrefix + encodeShareState(state);
}

/** Remove the share payload from the address bar, keeping any other hash. */
function stripShareHash(): void {
  const { origin, pathname, search, hash } = window.location;
  if (!hash.startsWith(shareHashPrefix)) {
    return;
  }
  window.history.replaceState(window.history.state, '', origin + pathname + search);
}

/**
 * Read and decode share state from the URL hash, then strip the hash so
 * reloads and later copies of the address stay clean. Returns null when the
 * hash carries no (valid) share payload, or one whose mode doesn't match
 * `expectedMode` (a link for another mode landed here via manual editing).
 *
 * This clears the hash via the History API as a best effort. Under a
 * client-side router that owns the location (e.g. React Router re-asserts the
 * initial URL during mount), this can be overwritten — such demos should also
 * clear the hash through their router after consuming (see the React demo's
 * useClearShareHash). Decoding is synchronous, so callers get the state
 * immediately for their initial render.
 */
export function consumeShareState(expectedMode?: ShareState['mode']): ShareState | null {
  const { hash } = window.location;
  if (!hash.startsWith(shareHashPrefix)) {
    return null;
  }
  const state = decodeShareState(hash.slice(shareHashPrefix.length));
  // A strip during the initial page load gets reverted: while navigating to a
  // URL with a fragment, the browser re-asserts location.hash shortly AFTER the
  // load event (fragment/scroll handling), so a single early strip loses the
  // race. Strip once now (best effort) and again a few times across the
  // post-load window so one lands after the re-assertion and sticks
  // (stripShareHash is a no-op once the hash is already clean). Routers that
  // additionally re-own the location (React Router) still get a router-level
  // strip; see useClearShareHash.
  const stripAcrossLoad = () => {
    stripShareHash();
    for (const delay of [50, 150, 350, 600]) {
      setTimeout(stripShareHash, delay);
    }
  };
  if (document.readyState === 'complete') {
    stripAcrossLoad();
  }
  else {
    window.addEventListener('load', stripAcrossLoad, { once: true });
  }
  if (state !== null && expectedMode !== undefined && state.mode !== expectedMode) {
    return null;
  }
  return state;
}

/** Consume a single-mode share payload, narrowed to SingleShareState. */
export function consumeSingleShareState(): SingleShareState | null {
  const state = consumeShareState('single');
  return state !== null && state.mode === 'single' ? state : null;
}

/** How long the Share item shows its "Link copied" confirmation. */
const copiedFeedbackMs = 1500;

// Visually hidden but still read by assistive tech (the clipped-1px-box idiom,
// same as core's chart announcer). Inline, because demo.css is optional.
const liveRegionStyle = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

// One copy announcer per document, parked on <body>: pressing Share closes the menu, and nothing inside a hidden panel is spoken.
let liveRegion: HTMLElement | null = null;
let announceTimer: ReturnType<typeof setTimeout> | null = null;

function getLiveRegion(): HTMLElement {
  // parentNode: a test or a demo that wiped the body gets a fresh region.
  if (liveRegion === null || liveRegion.parentNode === null) {
    liveRegion = document.createElement('div');
    // role="status" implies the other two; both are set anyway, as core's announcer does.
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('style', liveRegionStyle);
    document.body.appendChild(liveRegion);
  }
  return liveRegion;
}

// Long enough for the empty region to be registered as a live region before the
// text arrives, short enough that the confirmation still feels immediate.
const announceDelayMs = 100;

/** Empty the region first and write on a later task, so a repeat of the same message is still spoken. */
function announce(message: string): void {
  const region = getLiveRegion();
  region.textContent = '';
  if (announceTimer !== null) {
    clearTimeout(announceTimer);
  }
  announceTimer = setTimeout(() => {
    announceTimer = null;
    region.textContent = message;
  }, announceDelayMs);
}

export interface ShareLinkCopier {
  /** Build and copy the link, then report copied true and, shortly after, false. */
  copy(state: ShareState): void;
  /** Cancel a pending revert, on teardown. */
  dispose(): void;
}

/** Everything the Share item does apart from rendering: build, copy, announce, and drive the copied flag through `onCopiedChange`; without a usable clipboard the link is offered in a prompt. */
export function createShareLinkCopier(onCopiedChange: (copied: boolean) => void): ShareLinkCopier {
  let revertTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function clearRevert(): void {
    if (revertTimer !== null) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
  }

  return {
    copy(state: ShareState) {
      const url = buildShareUrl(state);
      // In an insecure context there is no `navigator.clipboard` at all.
      if (navigator.clipboard?.writeText === undefined) {
        window.prompt(demoText.shareButton.tooltip, url);
        return;
      }
      // a write still pending at teardown would call back, announce, and arm a timer for a menu that is gone
      navigator.clipboard.writeText(url).then(() => {
        if (disposed) {
          return;
        }
        onCopiedChange(true);
        announce(demoText.shareButton.announcementCopied);
        clearRevert();
        revertTimer = setTimeout(() => {
          revertTimer = null;
          onCopiedChange(false);
        }, copiedFeedbackMs);
      }, () => {
        if (disposed) {
          return;
        }
        window.prompt(demoText.shareButton.tooltip, url);
      });
    },
    dispose() {
      disposed = true;
      clearRevert();
    }
  };
}
