import {
  byAria, charts, copyShareLink, demoSlug, demoText, expect, followShareLink, openDemo, phoneTag, secondDemoSlug,
  seedLabel, shareHashPrefix, test
} from './helpers';

// Smoke coverage for the routes the deployed site links to: the gallery, a
// deep-linked demo page with its seed stepper and share link, and the wall.
// Anything finer-grained (editors, export) is the galleries' suites' job.

test.describe('gallery', () => {
  test('renders its sections with live thumbnails', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mochart Showcase' })).toBeVisible();
    await expect(page.locator('.sc-section').first()).toBeVisible();
    // Thumbnails mount on their first intersection, so the first row's charts are the ones to wait for.
    await expect(charts(page).first()).toBeVisible();
  });

  test('links to the docs site only when the site build says where it is', async ({ page }) => {
    await page.goto('/');
    await expect(byAria(page, demoText.siteRootLink.aria)).toHaveCount(0);
    await page.goto('/?siteRoot=/docs/');
    await expect(byAria(page, demoText.siteRootLink.aria)).toHaveAttribute('href', '/docs/');
  });

  test('renders on a phone', { tag: phoneTag }, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mochart Showcase' })).toBeVisible();
    await expect(charts(page).first()).toBeVisible();
  });
});

test.describe('demo page', () => {
  test('opens from a deep link and steps the seed through the URL', async ({ page }) => {
    await openDemo(page);
    await expect(seedLabel(page)).toHaveText('Curated');

    await byAria(page, 'Randomize data').click();
    await expect(seedLabel(page)).toHaveText('Seed 1');
    await expect.poll(() => new URL(page.url()).searchParams.get('seed')).toBe('1');
    await expect(charts(page).first()).toBeVisible();

    await byAria(page, 'Next step').click();
    await expect(seedLabel(page)).toHaveText('Seed 2');
    await byAria(page, 'Previous step').click();
    await expect(seedLabel(page)).toHaveText('Seed 1');

    await byAria(page, 'Back to curated data').click();
    await expect(seedLabel(page)).toHaveText('Curated');
    await expect.poll(() => new URL(page.url()).searchParams.get('seed')).toBeNull();
  });

  test('reads a seed from the URL and its share link restores it', async ({ page }) => {
    await openDemo(page, demoSlug, '?seed=3');
    await expect(seedLabel(page)).toHaveText('Seed 3');

    const link = await copyShareLink(page);
    expect(link).toContain('/d/' + demoSlug);
    expect(link).toContain('seed=3');
    await followShareLink(page, link);

    await expect(charts(page).first()).toBeVisible();
    await expect(seedLabel(page)).toHaveText('Seed 3');
    // The payload is stripped across the post-load window (the browser re-asserts the fragment after `load`), so this polls.
    await expect.poll(() => page.url()).not.toContain(shareHashPrefix);
  });

  test('goes back to the gallery', async ({ page }) => {
    await openDemo(page);
    await byAria(page, 'Back to gallery').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mochart Showcase' })).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });

  test('opens from a deep link on a phone', { tag: phoneTag }, async ({ page }) => {
    await openDemo(page);
    await byAria(page, 'Randomize data').click();
    await expect(seedLabel(page)).toHaveText('Seed 1');
  });
});

test.describe('wall', () => {
  test('lays out the requested demos with a shared seed', async ({ page }) => {
    await page.goto('/wall?d=' + demoSlug + ',' + secondDemoSlug + '&seed=1');
    await expect(page.getByRole('heading', { level: 1, name: 'Chart Wall' })).toBeVisible();
    await expect(charts(page)).toHaveCount(2);
    await expect(seedLabel(page)).toHaveText('Seed 1');

    await byAria(page, 'Randomize all charts').click();
    await expect(seedLabel(page)).toHaveText('Seed 2');
    await expect.poll(() => new URL(page.url()).searchParams.get('seed')).toBe('2');
  });

  test('explains itself instead of drawing on a phone', { tag: phoneTag }, async ({ page }) => {
    await page.goto('/wall?d=' + demoSlug);
    await expect(page.locator('.sc-wall-notice')).toBeVisible();
    await expect(charts(page)).toHaveCount(0);
  });
});
