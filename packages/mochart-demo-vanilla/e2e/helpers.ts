import { mochartCssClasses } from '@mochart/core';
import { demoTabId, demoTabPanelId, demoText, shareHashPrefix } from '@mochart/demo-common';
import type { DemoTabName } from '@mochart/demo-common';
import type { Locator, Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

// Any uncaught exception in the page fails the test that triggered it.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await use(page);
    expect(pageErrors, 'uncaught page errors').toEqual([]);
  }
});

export { expect, demoText, shareHashPrefix };

/** Tag for the phone-viewport subset: tagged tests run only in `chromium-phone`, untagged ones only at desktop width. */
export const phoneTag = '@phone';

/** A selector for one `mochartCssClasses` entry (the first token is the stable class). */
export function chartClass(entry: string): string {
  return '.' + entry.split(' ')[0];
}

/** The demo this suite drives — plain bars with several series, no pie mode or generator step. */
export const demoId = 'stacked';

/** Element carrying an `aria-label` from demoText — the demos' control selector. */
export function byAria(scope: Page | Locator, ariaLabel: string): Locator {
  return scope.locator('[aria-label=' + JSON.stringify(ariaLabel) + ']');
}

/** Element carrying a `title` from demoText — a role query would skip controls hidden in a closed overflow panel. */
export function byTitle(scope: Page | Locator, title: string): Locator {
  return scope.locator('[title=' + JSON.stringify(title) + ']');
}

/** A rendered chart. */
export function charts(page: Page): Locator {
  return page.locator(chartClass(mochartCssClasses.chart));
}

/** A view's tab pane, by the id demo-common pairs with its tab button. */
export function tabPanel(page: Page, name: DemoTabName): Locator {
  return page.locator('#' + demoTabPanelId(name));
}

/** Press `control` once and assert `attribute` reads `value` — no retry, so a lost press fails the gate. */
export async function press(control: Locator, attribute: string, value: string): Promise<void> {
  await control.click();
  await expect(control).toHaveAttribute(attribute, value);
}

export async function selectTab(page: Page, name: DemoTabName): Promise<void> {
  await press(page.locator('#' + demoTabId(name)), 'aria-selected', 'true');
}

/** Open a demo in one of the switchable modes and wait for its first chart. */
export async function openDemo(page: Page, mode: 'single' | 'multi', id = demoId): Promise<void> {
  await page.goto('/' + mode + '/' + id);
  await expect(charts(page).first()).toBeVisible();
  await expect(page.locator(chartClass(mochartCssClasses.series)).first()).toBeAttached();
}

/** Follow a copied share link via about:blank, so the hash-only change loads a fresh document instead of navigating same-document. */
export async function followShareLink(page: Page, link: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(link);
}

/** Grant clipboard permissions so the test can read back what the copier wrote — Chromium refuses `readText` without `clipboard-read`. */
export async function grantClipboard(page: Page): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin
  });
}

export function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/** Open the export/share dropdown inside `scope` and wait for it to be expanded. */
export async function openExportShareMenu(scope: Page | Locator): Promise<void> {
  await press(byAria(scope, demoText.exportShareMenu.trigger.aria), 'aria-expanded', 'true');
}

/** Copy the current view's share link and hand back what landed on the clipboard. */
export async function copyShareLink(page: Page, scope: Page | Locator = page): Promise<string> {
  await grantClipboard(page);
  await openExportShareMenu(scope);
  // No assertion on the confirmation label: pressing Share closes the menu, so the label swap happens hidden.
  await byAria(scope, demoText.shareButton.aria).click();
  // The copier writes the clipboard from a promise callback, so the read polls.
  let link = '';
  await expect.poll(async () => {
    link = await readClipboard(page);
    return link;
  }).toContain(shareHashPrefix);
  return link;
}
