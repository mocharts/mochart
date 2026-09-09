import { mochartCssClasses } from '@mochart/core';
import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

export interface DemoEntry {
  id: string;
  title: string;
  config: string;
  data: string;
}

// Any uncaught exception in the page fails the test that triggered it.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await use(page);
    expect(pageErrors, 'uncaught page errors').toEqual([]);
  }
});

export { expect };

/**
 * Tag for the cross-engine smoke subset: tagged tests run on firefox and webkit
 * as well as chromium (see the projects in playwright.config.ts). Keep it small
 * — one render, one pointer interaction, one keyboard traversal, one export each.
 */
export const smokeTag = '@smoke';

/** A selector for one `mochartCssClasses` entry (the first token is the stable class). */
export function chartClass(entry: string): string {
  return '.' + entry.split(' ')[0];
}

/** A selector for an entry's per-item class, e.g. `series` + 'slice0'. */
export function chartIdClass(entry: string, id: string): string {
  return '.' + entry.split(' ')[1] + id;
}

export async function openDemo(page: Page, id: string): Promise<void> {
  await page.goto('/#' + id);
  await expect(page.locator('#chart-host ' + chartClass(mochartCssClasses.chart))).toBeVisible();
}
