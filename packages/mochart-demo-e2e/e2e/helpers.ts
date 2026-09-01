import { mochartCssClasses } from '@mochart/core';
import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

// Any uncaught exception or console error in the page fails the test that
// triggered it. Console errors count because the framework bindings route
// render failures through their own error handlers (Angular's ErrorHandler,
// React's error boundary logging), which log instead of throwing.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, 'page errors').toEqual([]);
  }
});

export { expect };

/** A selector for one `mochartCssClasses` entry (the first token is the stable class). */
export function chartClass(entry: string): string {
  return '.' + entry.split(' ')[0];
}

/** Open a gallery demo in single mode and wait for its chart to render. */
export async function openDemo(page: Page, id: string): Promise<void> {
  await page.goto('/single/' + id);
  await expect(page.locator(chartClass(mochartCssClasses.chart))).toBeVisible();
}
