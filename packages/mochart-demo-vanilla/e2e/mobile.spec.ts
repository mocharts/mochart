import { byAria, byTitle, demoText, expect, openDemo, phoneTag, press, tabPanel, test } from './helpers';
import type { Locator, Page } from '@playwright/test';

// The phone fold reparents controls into the overflow panel rather than mirroring them, so a duplicate is the regression to guard and "appears exactly once" is the assertion that catches it.

const { editableChart, overflowMenu } = demoText;

/** Every control the category-mode strip owns, folded or not. */
const categoryControls = [
  editableChart.resetCategories.aria,
  editableChart.reverseCategories.aria,
  editableChart.addCategories.aria,
  editableChart.removeCategories.aria,
  editableChart.playAddCategories.aria,
  editableChart.playRemoveCategories.aria,
  editableChart.stopSequence.aria,
  editableChart.selectAllCategories.aria,
  editableChart.editMode.aria
];

/** Every control the series-mode strip owns. */
const seriesControls = [
  editableChart.decreaseCategoryOrder.aria,
  editableChart.increaseCategoryOrder.aria,
  editableChart.previousSeries.aria,
  editableChart.nextSeries.aria,
  editableChart.resetSeries.aria,
  editableChart.applySeries.aria,
  editableChart.editMode.aria
];

function chartPanel(page: Page): Locator {
  return tabPanel(page, 'chart');
}

async function expectExactlyOnce(scope: Locator, ariaLabels: readonly string[]): Promise<void> {
  for (const ariaLabel of ariaLabels) {
    await expect(byAria(scope, ariaLabel), ariaLabel).toHaveCount(1);
  }
}

/** Open the chart strip's `…` menu, whose contents are the folded controls themselves. */
async function openChartMenu(page: Page): Promise<void> {
  await press(byAria(chartPanel(page), overflowMenu.chart.aria), 'aria-expanded', 'true');
}

/**
 * Switch between the category and series strips.
 *
 * The tooltip is the state assertion: the button keeps one accessible name and
 * flips its `title` to name the mode it would switch to next. Without it a lost
 * press would leave the counts below passing against the strip they started on —
 * every panel stays mounted, so the DOM alone cannot say which one is showing.
 */
async function toggleEditMode(page: Page, toSeries: boolean): Promise<void> {
  const { editMode } = editableChart;
  const nextTooltip = toSeries ? editMode.tooltipToCategories : editMode.tooltipToSeries;
  await press(byAria(chartPanel(page), editMode.aria), 'title', nextTooltip);
}

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'single');
});

test('the chart control strip folds behind a trigger', { tag: phoneTag }, async ({ page }) => {
  const panel = chartPanel(page);
  const trigger = byAria(panel, overflowMenu.chart.aria);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  // Reset folded away; Add and Remove act on the input beside them, so they stay.
  await expect(byAria(panel, editableChart.resetCategories.aria)).toBeHidden();
  await expect(byAria(panel, editableChart.addCategories.aria)).toBeVisible();

  await openChartMenu(page);
  await expect(byAria(panel, editableChart.resetCategories.aria)).toBeVisible();
});

test('every folded chart control appears exactly once', { tag: phoneTag }, async ({ page }) => {
  const panel = chartPanel(page);
  await expectExactlyOnce(panel, categoryControls);

  // Opening the panel must not mint copies of what it hosts.
  await openChartMenu(page);
  await expectExactlyOnce(panel, categoryControls);

  // Switching edit mode swaps the whole hosted list, which detaches the category
  // rows and re-homes them on their own strip — the move most likely to leave a
  // copy behind. The button that does it is itself one of the folded controls.
  await toggleEditMode(page, true);
  await expectExactlyOnce(panel, seriesControls);

  await openChartMenu(page);
  await toggleEditMode(page, false);
  await expectExactlyOnce(panel, categoryControls);
});

test('the navigation row folds and offers each control once', { tag: phoneTag }, async ({ page }) => {
  const trigger = byAria(page, overflowMenu.nav.aria);
  await expect(trigger).toBeVisible();

  const back = byAria(page, demoText.backToDemos.aria);
  await expect(back).toHaveCount(1);
  await expect(back).toBeHidden();
  await expect(byAria(page, demoText.themeToggle.aria)).toHaveCount(1);

  // Multi mode is not offered at this width (a grid of charts has no room), so
  // its segment is absent rather than folded.
  await expect(byTitle(page, demoText.modeSwitcher.modes.single.title)).toHaveCount(1);
  await expect(byTitle(page, demoText.modeSwitcher.modes.random.title)).toHaveCount(1);
  await expect(byTitle(page, demoText.modeSwitcher.modes.multi.title)).toHaveCount(0);

  await press(trigger, 'aria-expanded', 'true');
  await expect(back).toBeVisible();
  await expect(byTitle(page, demoText.modeSwitcher.modes.single.title)).toBeVisible();
});

test('nothing folds at desktop width', async ({ page }) => {
  const panel = chartPanel(page);
  await expect(byAria(panel, overflowMenu.chart.aria)).toBeHidden();
  await expect(byAria(page, overflowMenu.nav.aria)).toBeHidden();

  // The whole strip is on screen, and the second-chart button is offered too
  // (it needs room for two plots, so the phone tier never shows it).
  const desktopControls = [...categoryControls, editableChart.secondChart.aria];
  await expectExactlyOnce(panel, desktopControls);
  for (const ariaLabel of desktopControls) {
    await expect(byAria(panel, ariaLabel), ariaLabel).toBeVisible();
  }
  await expect(byAria(page, demoText.backToDemos.aria)).toBeVisible();
});
