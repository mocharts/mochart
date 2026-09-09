// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createShareLinkCopier, shareHashPrefix } from '../src/shareState';
import { demoText } from '../src/demoText';
import type { ShareState } from '../src/shareState';

const state: ShareState = { mode: 'multi', rows: 2, cols: 2, step: 0, interval: 2000 };

function stubClipboard(writeText: (url: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function liveRegions(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="status"]'));
}

// The clipboard write, prompt fallback and revert timer were spelled out in all six ports' export/share menus.
describe('createShareLinkCopier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The announcer's region is per-document, so drop it between tests.
    liveRegions().forEach(region => region.remove());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('copies the share URL and reports copied, then reverts', async () => {
    const written: string[] = [];
    stubClipboard(url => { written.push(url); return Promise.resolve(); });
    const changes: boolean[] = [];
    const copier = createShareLinkCopier(copied => changes.push(copied));

    copier.copy(state);
    await vi.waitFor(() => expect(changes).toEqual([true]));
    expect(written[0]).toContain(shareHashPrefix);

    vi.advanceTimersByTime(1500);
    expect(changes).toEqual([true, false]);
  });

  it('offers the link in a prompt when there is no clipboard at all', () => {
    // jsdom's own navigator has no clipboard, like a real insecure context.
    delete (navigator as { clipboard?: unknown }).clipboard;
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const changes: boolean[] = [];
    const copier = createShareLinkCopier(copied => changes.push(copied));

    copier.copy(state);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt.mock.calls[0][0]).toBe(demoText.shareButton.tooltip);
    expect(prompt.mock.calls[0][1]).toContain(shareHashPrefix);
    expect(changes).toEqual([]);
  });

  it('offers the link in a prompt when the clipboard refuses', async () => {
    stubClipboard(() => Promise.reject(new Error('insecure context')));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const changes: boolean[] = [];
    const copier = createShareLinkCopier(copied => changes.push(copied));

    copier.copy(state);
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(prompt.mock.calls[0][0]).toBe(demoText.shareButton.tooltip);
    expect(changes).toEqual([]);
  });

  // The "Link copied" label swap happens inside a menu the same click closes, so only the live region speaks.
  it('announces the copy through a visually hidden polite live region', async () => {
    stubClipboard(() => Promise.resolve());
    const copier = createShareLinkCopier(() => { /* label swap not under test */ });

    copier.copy(state);
    await vi.waitFor(() => expect(liveRegions()).toHaveLength(1));
    const region = liveRegions()[0];
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.getAttribute('style')).toContain('clip-path:inset(50%)');

    // The text arrives on a later task, so the empty region is a live region first.
    expect(region.textContent).toBe('');
    vi.advanceTimersByTime(100);
    expect(region.textContent).toBe(demoText.shareButton.announcementCopied);

    copier.dispose();
  });

  it('re-announces an identical message on a second copy', async () => {
    stubClipboard(() => Promise.resolve());
    const copier = createShareLinkCopier(() => { /* label swap not under test */ });

    copier.copy(state);
    await vi.waitFor(() => expect(liveRegions()).toHaveLength(1));
    vi.advanceTimersByTime(100);
    const region = liveRegions()[0];
    expect(region.textContent).toBe(demoText.shareButton.announcementCopied);

    // Same text again: emptying the region is what makes the second one speak.
    copier.copy(state);
    await vi.waitFor(() => expect(region.textContent).toBe(''));
    vi.advanceTimersByTime(100);
    expect(region.textContent).toBe(demoText.shareButton.announcementCopied);
    // Still one region: every menu on the page announces through the same node.
    expect(liveRegions()).toHaveLength(1);

    copier.dispose();
  });

  it('announces nothing when the clipboard refuses, since the prompt speaks for itself', async () => {
    stubClipboard(() => Promise.reject(new Error('insecure context')));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const copier = createShareLinkCopier(() => { /* label swap not under test */ });

    copier.copy(state);
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    vi.advanceTimersByTime(100);
    expect(liveRegions().map(region => region.textContent)).not.toContain(demoText.shareButton.announcementCopied);

    copier.dispose();
  });

  // Regression: dispose dropped only the revert timer, so a write still in flight called back after teardown.
  it('ignores a clipboard write that resolves after dispose', async () => {
    let settle: () => void = () => { /* replaced below */ };
    stubClipboard(() => new Promise<void>(resolve => { settle = resolve; }));
    const changes: boolean[] = [];
    const copier = createShareLinkCopier(copied => changes.push(copied));

    copier.copy(state);
    copier.dispose();
    settle();
    await vi.advanceTimersByTimeAsync(5000);

    expect(changes).toEqual([]);
    expect(liveRegions().map(region => region.textContent)).not.toContain(demoText.shareButton.announcementCopied);
  });

  it('ignores a clipboard write that rejects after dispose, rather than prompting a menu that is gone', async () => {
    let fail: () => void = () => { /* replaced below */ };
    stubClipboard(() => new Promise<void>((_resolve, reject) => { fail = () => reject(new Error('insecure context')); }));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const copier = createShareLinkCopier(() => { /* label swap not under test */ });

    copier.copy(state);
    copier.dispose();
    fail();
    await vi.advanceTimersByTimeAsync(5000);

    expect(prompt).not.toHaveBeenCalled();
  });

  it('drops a pending revert on dispose, so a torn-down menu never calls back', async () => {
    stubClipboard(() => Promise.resolve());
    const changes: boolean[] = [];
    const copier = createShareLinkCopier(copied => changes.push(copied));

    copier.copy(state);
    await vi.waitFor(() => expect(changes).toEqual([true]));
    copier.dispose();
    vi.advanceTimersByTime(5000);
    expect(changes).toEqual([true]);
  });
});
