import { mochartCssClasses } from '@mochart/core';
import { demoText } from '@mochart/demo-common';
import type { Locator, Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { shareHashPrefix } from '../src/state/share';

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

/** Reused demo-data entries with a random spec, so the seed stepper and the wall both accept them. */
export const demoSlug = 'stacked';
export const secondDemoSlug = 'grouped';

/** Element carrying an `aria-label` the showcase's controls set. */
export function byAria(scope: Page | Locator, ariaLabel: string): Locator {
  return scope.locator('[aria-label=' + JSON.stringify(ariaLabel) + ']');
}

/** A rendered chart. */
export function charts(page: Page): Locator {
  return page.locator(chartClass(mochartCssClasses.chart));
}

/** The seed / rotation readout in the demo page's control strip. */
export function seedLabel(page: Page): Locator {
  return page.locator('.sc-seed-value');
}

/** Open a demo page and wait for its chart to draw its first series. */
export async function openDemo(page: Page, slug = demoSlug, query = ''): Promise<void> {
  await page.goto('/d/' + slug + query);
  await expect(charts(page).first()).toBeVisible();
  await expect(page.locator(chartClass(mochartCssClasses.series)).first()).toBeAttached();
}

/** Follow a copied share link via about:blank, so the hash-only change loads a fresh document instead of navigating same-document. */
export async function followShareLink(page: Page, link: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(link);
}

/** Copy the demo page's share link and hand back what landed on the clipboard. */
export async function copyShareLink(page: Page): Promise<string> {
  // Chromium refuses `readText` without `clipboard-read`.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin
  });
  await byAria(page, 'Copy share link').click();
  // The copier writes the clipboard from a promise callback, so the read polls.
  let link = '';
  await expect.poll(async () => {
    link = await page.evaluate(() => navigator.clipboard.readText());
    return link;
  }).toContain(shareHashPrefix);
  return link;
}
