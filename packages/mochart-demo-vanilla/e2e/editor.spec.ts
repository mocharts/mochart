import { demoText, expect, openDemo, selectTab, tabPanel, test } from './helpers';
import type { Locator, Page } from '@playwright/test';
import type { DemoTabName } from '@mochart/demo-common';

// The @mochart/editor JSON tabs in situ: every wait is on the editor's own `[data-validity]` root attribute, which is 'pending' until the lazy chunk has loaded and the linter has run.

/** The editor's text surface: CodeMirror's content element, named by the demo. */
function editorTextbox(panel: Locator, ariaLabel: string): Locator {
  return panel.getByRole('textbox', { name: ariaLabel });
}

function editorRoot(panel: Locator): Locator {
  return panel.locator('[data-validity]');
}

/** Show a JSON tab and wait for its editor to have loaded and linted. */
async function openEditorTab(page: Page, name: DemoTabName, ariaLabel: string): Promise<Locator> {
  await selectTab(page, name);
  const panel = tabPanel(page, name);
  await expect(editorTextbox(panel, ariaLabel)).toBeVisible();
  await expect(editorRoot(panel)).toHaveAttribute('data-validity', 'valid');
  return panel;
}

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'single');
});

test('the config tab mounts the lazy editor with the demo config', async ({ page }) => {
  const panel = await openEditorTab(page, 'config', demoText.configTab.editorAria);
  await expect(editorTextbox(panel, demoText.configTab.editorAria)).toContainText('categoryAxis');
  // Valid JSON, so the footer offers Apply; the invalid case is the next test.
  await expect(page.locator('#config-apply')).toBeEnabled();
});

test('an invalid edit is linted and blocks Apply', async ({ page }) => {
  const panel = await openEditorTab(page, 'config', demoText.configTab.editorAria);
  const textbox = editorTextbox(panel, demoText.configTab.editorAria);

  // Focus, never click: CodeMirror renders only the lines in view, so scrolling a
  // long document towards its middle (which is where `click` aims) changes the
  // content height under the pointer and the hit test lands on the pane instead.
  await textbox.focus();
  await textbox.press('ControlOrMeta+End');
  await textbox.press('x');

  await expect(editorRoot(panel)).toHaveAttribute('data-validity', 'invalid');
  await expect(panel.getByRole('alert')).toHaveText(demoText.errors.invalidJson);
  await expect(page.locator('#config-apply')).toBeDisabled();
  await expect(page.locator('#config-format')).toBeDisabled();

  await page.keyboard.press('Backspace');
  await expect(editorRoot(panel)).toHaveAttribute('data-validity', 'valid');
  await expect(page.locator('#config-apply')).toBeEnabled();
});

test('the data tab mounts a second editor of its own', async ({ page }) => {
  await openEditorTab(page, 'config', demoText.configTab.editorAria);
  const dataPanel = await openEditorTab(page, 'data', demoText.dataTab.editorAria);
  await expect(editorTextbox(dataPanel, demoText.dataTab.editorAria)).not.toBeEmpty();
  // Both panes mount their own instance out of the one lazily imported chunk.
  await expect(page.locator('[data-validity]')).toHaveCount(2);
});
