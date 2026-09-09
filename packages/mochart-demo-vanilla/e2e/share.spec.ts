import {
  byTitle, charts, copyShareLink, demoText, expect, followShareLink, openDemo, selectTab,
  shareHashPrefix, tabPanel, test
} from './helpers';

// The share link is a deflate-compressed, base64url-encoded payload carrying a
// mode tag, appended to the current route's hash and stripped again after the
// load that consumes it. None of that is reachable from jsdom: it needs a real
// clipboard, a real navigation and a real second mount.

test.describe('share links', () => {
  test('a single-mode link restores the mode and the edited config', async ({ page }) => {
    await openDemo(page, 'single');

    // Edit the config through the Config tab, so the shared payload differs from
    // the demo's own config in a way the restored page can be asked about.
    await selectTab(page, 'config');
    const invert = page.locator('#config-inverted');
    await expect(invert).toHaveAttribute('aria-pressed', 'false');
    await invert.click();
    await expect(invert).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#config-apply').click();
    await selectTab(page, 'chart');

    const link = await copyShareLink(page, tabPanel(page, 'chart'));
    expect(link).toContain('/single/');
    await followShareLink(page, link);

    await expect(charts(page).first()).toBeVisible();
    // The strip happens across the post-load window (the browser re-asserts the
    // fragment after `load`), so this polls rather than reading the URL once.
    await expect.poll(() => page.url()).not.toContain(shareHashPrefix);

    // Restored mode: the switcher marks the link's own mode as the current one.
    const single = byTitle(page, demoText.modeSwitcher.modes.single.title);
    await expect(single).toHaveAttribute('aria-current', 'page');

    // Restored config: the Invert toggle reads its pressed state off the config
    // the view mounted with, which on this load is the one out of the payload.
    await selectTab(page, 'config');
    await expect(page.locator('#config-inverted')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a multi-mode link restores the grid and the interval', async ({ page }) => {
    await openDemo(page, 'multi');
    await expect(charts(page)).toHaveCount(4);

    await page.locator('#grid-rows').fill('1');
    await page.locator('#grid-cols').fill('3');
    await page.locator('#multi-rate').fill('5000');
    await expect(charts(page)).toHaveCount(3);

    const link = await copyShareLink(page);
    await followShareLink(page, link);

    await expect(charts(page)).toHaveCount(3);
    await expect(page.locator('#grid-rows')).toHaveValue('1');
    await expect(page.locator('#grid-cols')).toHaveValue('3');
    await expect(page.locator('#multi-rate')).toHaveValue('5000');
    await expect(byTitle(page, demoText.modeSwitcher.modes.multi.title))
      .toHaveAttribute('aria-current', 'page');
  });

  test('a payload is ignored on a route for another mode', async ({ page }) => {
    await openDemo(page, 'single');
    const link = await copyShareLink(page, tabPanel(page, 'chart'));

    // Same payload, hand-moved onto the multi route — which is what the mode tag
    // inside it exists to catch. The multi view must fall back to its own
    // defaults (2x2) rather than reading someone else's state, and must not
    // throw doing it (the fixture fails the test on any page error).
    await followShareLink(page, link.replace('/single/', '/multi/'));

    await expect(charts(page)).toHaveCount(4);
    await expect(page.locator('#grid-rows')).toHaveValue('2');
    await expect(page.locator('#grid-cols')).toHaveValue('2');
  });
});
