// Shareable demo-page state in the URL hash. The demo slug and the seed live
// in the URL path/query already, so the payload only carries edits: the
// (possibly edited) config and/or data. Same technique as demo-common's
// shareState (deflate + base64url via fflate), with a showcase-local shape.

import { deflateSync, inflateSync } from 'fflate';

import type { DataObject, DemoConfig } from '@mochart/demo-data';

export interface ShowcaseShareState {
  v: 1;
  slug: string;
  config?: DemoConfig;
  data?: DataObject[];
}

export const shareHashPrefix = '#s=';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function encodeShareState(state: ShowcaseShareState): string {
  const compressed = deflateSync(new TextEncoder().encode(JSON.stringify(state)));
  return bytesToBase64Url(compressed);
}

/** Decode a share payload; returns null for anything malformed. */
export function decodeShareState(encoded: string): ShowcaseShareState | null {
  try {
    const json = new TextDecoder().decode(inflateSync(base64UrlToBytes(encoded)));
    const parsed: unknown = JSON.parse(json);
    if (!isPlainObject(parsed) || parsed.v !== 1 || typeof parsed.slug !== 'string') {
      return null;
    }
    const state: ShowcaseShareState = { v: 1, slug: parsed.slug };
    if (parsed.config !== undefined) {
      if (!isPlainObject(parsed.config)) {
        return null;
      }
      state.config = parsed.config as DemoConfig;
    }
    if (parsed.data !== undefined) {
      if (!Array.isArray(parsed.data) || parsed.data.some(row => !isPlainObject(row))) {
        return null;
      }
      state.data = parsed.data as DataObject[];
    }
    return state;
  }
  catch {
    return null;
  }
}

/** The current URL with the given state encoded in its hash. */
export function buildShareUrl(state: ShowcaseShareState): string {
  const { origin, pathname, search } = window.location;
  return origin + pathname + search + shareHashPrefix + encodeShareState(state);
}

function stripShareHash(): void {
  const { origin, pathname, search, hash } = window.location;
  if (!hash.startsWith(shareHashPrefix)) {
    return;
  }
  window.history.replaceState(window.history.state, '', origin + pathname + search);
}

/**
 * Read and decode share state from the URL hash, then strip the hash so
 * reloads and later copies of the address stay clean. The strip is retried
 * across the post-load window because the browser re-asserts location.hash
 * shortly after the load event (see demo-common's consumeShareState, which
 * this mirrors).
 */
export function consumeShareState(expectedSlug: string): ShowcaseShareState | null {
  const { hash } = window.location;
  if (!hash.startsWith(shareHashPrefix)) {
    return null;
  }
  const state = decodeShareState(hash.slice(shareHashPrefix.length));
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
  return state !== null && state.slug === expectedSlug ? state : null;
}
