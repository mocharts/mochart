#!/usr/bin/env node
// Screenshot harness for the demo galleries. See README.md beside this file.
//
// Captures a fixed matrix of viewport x route x state x theme screenshots into
// an output directory, so a redesign can be checked for pixel-level regressions
// against an earlier capture (see compare.mjs).
//
// Every port renders from the same `demo.css` and the same DOM class structure,
// so this drives ANY of the six — point `--base-url` at that port's dev server
// and diff the result against a vanilla capture. The shot matrix below is
// written in terms of routes and demo ids, both of which every port shares.
//
// Usage:
//   node scripts/screenshots/capture.mjs <outDir> [options]
//
// Options:
//   --base-url <url>   dev server to shoot (default http://localhost:5179).
//                      Passing this implies --no-server; see below.
//   --bar-demo <id>    primary bar/line demo id (default "grouped")
//   --pie-demo <id>    pie/donut demo id (default "pie")
//   --notes-demo <id>  demo id used for the notes-panel shots (default: --bar-demo)
//   --tall-notes-demo <id>  demo whose notes overflow a short viewport (default "candlestick")
//   --filter <substr>  only capture shots whose file name contains <substr>
//   --no-self-check    skip the repeat-capture determinism check
//   --no-server        never spawn a dev server, fail if the base URL is down
//   --allow-server     spawn the vanilla dev server even though --base-url was
//                      given (only sensible when it points at vanilla's port)
//   --list             print the shot names and exit without capturing
//
// Exits non-zero if any requested shot could not be captured, or if the
// repeat-capture self-check comes out non-identical. A capture that leaves a
// state out is worse than one that fails: the missing state shows up in
// compare.mjs as ONLY-IN-A, which reads like a file that was added rather than
// like coverage that was lost.
//
// Determinism notes: see the header comment on settle() below.

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
// The only package this harness can start for itself. Any other port has to be
// running already — which is what makes `--base-url` imply `--no-server`.
const vanillaPackageDir = resolve(repoRoot, 'packages', 'mochart-demo-vanilla');

// ---------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    outDir: null,
    baseUrl: 'http://localhost:5179',
    barDemo: 'grouped',
    pieDemo: 'pie',
    notesDemo: null,
    tallNotesDemo: 'candlestick',
    filter: null,
    selfCheck: true,
    allowServer: true,
    list: false
  };
  // Tracked separately from `allowServer` so that an explicit `--base-url` can
  // flip the default without overriding an explicit `--allow-server`.
  let baseUrlGiven = false;
  let serverChoiceGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base-url') { options.baseUrl = argv[++i]; baseUrlGiven = true; }
    else if (arg === '--bar-demo') { options.barDemo = argv[++i]; }
    else if (arg === '--pie-demo') { options.pieDemo = argv[++i]; }
    else if (arg === '--notes-demo') { options.notesDemo = argv[++i]; }
    else if (arg === '--tall-notes-demo') { options.tallNotesDemo = argv[++i]; }
    else if (arg === '--filter') { options.filter = argv[++i]; }
    else if (arg === '--no-self-check') { options.selfCheck = false; }
    else if (arg === '--no-server') { options.allowServer = false; serverChoiceGiven = true; }
    else if (arg === '--allow-server') { options.allowServer = true; serverChoiceGiven = true; }
    else if (arg === '--list') { options.list = true; }
    else if (arg.startsWith('--')) { throw new Error('unknown option: ' + arg); }
    else if (options.outDir === null) { options.outDir = arg; }
    else { throw new Error('unexpected argument: ' + arg); }
  }
  if (options.outDir === null && !options.list) {
    throw new Error('missing <outDir> argument');
  }
  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  // `--base-url` implies `--no-server`, and this default is a safety measure
  // rather than a convenience. The only server this harness knows how to start is
  // VANILLA's. Point it at another port, forget `--no-server`, and if that port
  // happens to be down it starts vanilla there instead — then captures vanilla,
  // diffs it against vanilla, and reports a flawless 147/147 for a port it
  // never loaded. A silent false pass is the worst failure this tool can have,
  // so the safe choice is the default and `--allow-server` is the opt-out.
  if (baseUrlGiven && !serverChoiceGiven) {
    options.allowServer = false;
  }
  if (options.notesDemo === null) {
    options.notesDemo = options.barDemo;
  }
  return options;
}

// ---------------------------------------------------------------------------
// the shot matrix
// ---------------------------------------------------------------------------

// Desktop-invariance tiers first, then the phone tiers the redesign targets.
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '901x800', width: 901, height: 800 },
  { name: '700x900', width: 700, height: 900 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '896x414', width: 896, height: 414 },
  { name: '640x800', width: 640, height: 800 },
  { name: '641x800', width: 641, height: 800 },
  { name: '320x568', width: 320, height: 568 }
];

// Mirrors demo-common/src/viewport.ts (phoneMaxWidth 640, landscape 900x480).
// A phone has no Multi mode, so /multi there only redirects to /single.
function isPhoneViewport(viewport) {
  return viewport.width <= 640 || (viewport.width <= 900 && viewport.height <= 480);
}

const tabConfig = { kind: 'tab', name: 'Config' };
const tabData = { kind: 'tab', name: 'Data' };

// Controls are addressed by `aria-label` (state-stable, unlike the visible label); strings mirror demo-common/src/demoText.ts.
const clickEditMode = { kind: 'click', selector: '[aria-label="Toggle Mode"]' };
const clickChartCount = { kind: 'click', selector: '[aria-label="Toggle Chart Count"]' };

// Open-menu steps. A `menu` step is a click that additionally waits for the
// panel it discloses to actually be `.open` and visible before the shot is
// allowed to proceed (see captureShot), and marks the shot as one that must
// still have an open menu at screenshot time.
//
// Every menu panel is `position: fixed` at coordinates measured from its
// trigger, so where it lands relative to the viewport edges IS the behaviour
// under test — that is why these shots are full-viewport rather than scoped to
// the menu element, which would frame out exactly the clamping being checked.
//
// No per-view prefix: each of these shots is on its own path, so the first menu on the page is the right one.
const openExportShareMenu = {
  kind: 'menu',
  selector: '.mochart-export-share-menu > .demo-menu-trigger',
  panel: '.mochart-export-share-menu .demo-menu'
};

const openNotesMenu = {
  kind: 'menu',
  selector: '.mochart-demo-notes-trigger',
  panel: '.mochart-demo-notes-menu .demo-menu'
};

// The phone fold. On a phone the single-mode chart strip MOVES its secondary
// controls into a `…` menu (see OverflowMenu.ts — hosts, not mirrors), so the
// panel is the only place several of them exist at that width. Scoped to
// `.chart-controls-menu` so this keeps meaning "the chart pane's fold" once
// other rows grow one of their own.
//
// Full-viewport like every other menu shot, and for a sharper reason here: this
// panel is right-aligned against the trailing control group and opens upward
// from a strip at the bottom of the pane, so both the clamp to the right edge
// and the `max-height` it gets from the room above the trigger are only
// legible with the viewport edges in frame.
const overflowPanelSelector = '.demo-menu.demo-menu-overflow';
const overflowTriggerSelector = '.demo-overflow-menu > button';
const chartOverflowTriggerSelector = '.chart-controls-menu ' + overflowTriggerSelector;

const openChartOverflowMenu = {
  kind: 'menu',
  selector: chartOverflowTriggerSelector,
  panel: overflowPanelSelector
};

// The other three folds, each scoped to the surface it belongs to so a shot can
// never open the wrong panel: the random mode's control strip, and the Config
// and Data tabs' footers. Every one of them opens upward, right-aligned against
// its own full-width row.
function openOverflowMenuIn(scope) {
  return {
    kind: 'menu',
    selector: scope + ' ' + overflowTriggerSelector,
    panel: overflowPanelSelector
  };
}

const openRandomOverflowMenu = openOverflowMenuIn('.random-controls');
const openConfigOverflowMenu = openOverflowMenuIn('.mochart-demo-tab-container.config');
const openDataOverflowMenu = openOverflowMenuIn('.mochart-demo-tab-container.data');

// The navigation row's own fold, and the only one that opens DOWNWARD — the row
// is at the top of the shell, so there is nothing above it to open into. It also
// folds a different kind of thing from the control strips: two whole navigation
// destinations, the mode switcher's toolbar, and the notes disclosure below.
const openNavOverflowMenu = openOverflowMenuIn('.mochart-demo-tabs-container');

// The notes, as a phone reaches them.
//
// Above the breakpoint the ⓘ button in the row opens a popover. Below it that
// button is folded away and the notes render as a disclosure INSIDE the
// navigation row's overflow panel — a popover nested in that panel could not
// work, because the panel hides its subtree with `display: none`. So the same
// state is reached differently: `revealControl` opens the `…` to get at the row,
// the row expands in place, and the panel it lives in is the one that must still
// be open when the shot is taken (`.demo-menu-keep-open` is what keeps it so).
const openNotesDisclosure = {
  kind: 'menu',
  selector: '.mochart-demo-notes-item > button',
  panel: overflowPanelSelector
};

function notesStep(viewport) {
  return isPhoneViewport(viewport) ? openNotesDisclosure : openNotesMenu;
}

// A right-aligned menu pins its panel `right` from the trigger's distance to the
// viewport edge, and that offset can be floored at the menu gap. Measured across
// the whole matrix, the export trigger never gets nearer than 23px to the edge —
// the demo shell's own padding sees to that — so no real state reaches the
// floor, and a shot of one would show nothing either way.
//
// This moves the trigger group flush into the bottom-right corner so the raw
// offset is 0 and the floor is the only thing that can decide where the panel
// lands. It is applied identically to whichever build is being shot, so the
// before/after pair isolates exactly that arithmetic — but the resulting page is
// NOT a state the app can be in, and these shots are named `flushright` so they
// are never mistaken for one.
const flushRightCss = `
  .mochart-export-share-menu {
    position: fixed !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 1079;
  }
`;

function buildShots(options) {
  const { barDemo, pieDemo, notesDemo, tallNotesDemo } = options;
  const shots = [];

  const push = (viewport, route, path, state, theme, steps, extra) => {
    shots.push({
      name: `${viewport.name}__${route}__${state}__${theme}`,
      viewport, path, theme, steps,
      expectsOpenMenu: steps.some(step => step.kind === 'menu'),
      ...extra
    });
  };

  for (const viewport of viewports) {
    const single = `single-${barDemo}`;
    const singlePath = `/single/${barDemo}`;

    push(viewport, single, singlePath, 'chart-group', 'light', []);
    push(viewport, single, singlePath, 'chart-series', 'light', [clickEditMode]);
    push(viewport, single, singlePath, 'config', 'light', [tabConfig]);
    push(viewport, single, singlePath, 'data', 'light', [tabData]);
    push(viewport, `single-${pieDemo}`, `/single/${pieDemo}`, 'chart-slice', 'light', []);
    push(viewport, `random-${barDemo}-0`, `/random/${barDemo}/0`, 'chart', 'light', []);

    if (!isPhoneViewport(viewport)) {
      push(viewport, `multi-${barDemo}`, `/multi/${barDemo}`, 'chart', 'light', []);
    }

    // Open menus, at every tier. Two distinct geometries are covered:
    //
    //  * the export/share dropdown opens upward and right-aligned, anchored from
    //    the trigger's distance to the right edge (never below 23px in any real
    //    state — see flushRightCss for the case that pushes it to 0);
    //  * the notes panel opens downward and left-aligned with a width clamp, and
    //    holds prose that can outgrow a short viewport — 896x414 (a landscape
    //    phone, 414px tall) is the tier where a panel height cap would bind.
    //
    // All three modes get an export menu because each mounts its own instance
    // with its own id prefix, in a differently-sized controls row.
    push(viewport, single, singlePath, 'menu-export', 'light', [openExportShareMenu]);
    push(viewport, `random-${barDemo}-0`, `/random/${barDemo}/0`, 'menu-export', 'light', [openExportShareMenu]);
    if (!isPhoneViewport(viewport)) {
      push(viewport, `multi-${barDemo}`, `/multi/${barDemo}`, 'menu-export', 'light', [openExportShareMenu]);
    }
    push(viewport, `single-${notesDemo}`, `/single/${notesDemo}`, 'menu-notes', 'light', [notesStep(viewport)]);

    // The phone fold's own panel, which exists at no other tier — above the
    // phone breakpoint the controls stay in the strip and the trigger is
    // `hidden`, so there is nothing to open and the shot would be a guaranteed
    // failure rather than a missing state.
    //
    // One shot per panel, because each folds a different list: the category panel
    // sends eight buttons over, the series panel Reset plus the mode toggle,
    // the slice panel Reset plus the play/stop pair. `clickEditMode` reaches
    // the series panel through the category panel's own fold (revealControl opens
    // the ⋯ to get at the mode toggle), and the trigger follows the panel it
    // switched to, so the second step finds it in place.
    //
    // The shortest phone tier does double duty: at 896x414 the category panel's
    // `max-height` (the room above a trigger 414px down the screen) is smaller
    // than the eight rows it holds, so that shot is also the `overflow-y: auto`
    // case — the one that decides what happens as more controls fold in.
    //
    // The random strip and the two editor footers fold as well, and each sends a
    // different kind of thing over: the random panel takes a button, a toggle
    // and a labelled number input (the one menu row that is not a `.demo-btn`),
    // the Config panel four buttons plus the generated reference-links row, the
    // Data panel two buttons. All three are also the shots that show what stayed
    // behind — Apply and its `role="alert"` error span are deliberately NOT
    // foldable, and only a picture proves they are still in the row.
    //
    // The navigation row's fold gets one too, and it is the shot that has to
    // show BOTH halves of the fold at once: what stayed directly tappable (the
    // tab strip) and what the `…` beside it now holds.
    if (isPhoneViewport(viewport)) {
      push(viewport, single, singlePath, 'menu-overflow-nav', 'light', [openNavOverflowMenu]);
      push(viewport, single, singlePath, 'menu-overflow', 'light', [openChartOverflowMenu]);
      push(viewport, single, singlePath, 'menu-overflow-series', 'light', [clickEditMode, openChartOverflowMenu]);
      push(viewport, `single-${pieDemo}`, `/single/${pieDemo}`, 'menu-overflow', 'light', [openChartOverflowMenu]);
      push(viewport, `random-${barDemo}-0`, `/random/${barDemo}/0`, 'menu-overflow', 'light', [openRandomOverflowMenu]);
      push(viewport, single, singlePath, 'menu-overflow-config', 'light', [tabConfig, openConfigOverflowMenu]);
      push(viewport, single, singlePath, 'menu-overflow-data', 'light', [tabData, openDataOverflowMenu]);
    }

    // The two-up layout is the highest-risk regression (a `display: contents`
    // grid has to keep both plots row-aligned), and the second chart is only
    // offered above ~960px, so it gets its own shots at the widest tier.
    if (viewport.name === '1440x900') {
      push(viewport, single, singlePath, 'chart-group-2up', 'light', [clickChartCount]);
      push(viewport, single, singlePath, 'chart-series-2up', 'light', [clickChartCount, clickEditMode]);
    }
  }

  // The notes of the default demo still fit the shortest viewport, so on their
  // own they never reach a height cap. This demo's notes are the longest in the
  // gallery (~2.7x), which at 414px of viewport height overflows the room below
  // its trigger outright — the state a `max-height` would have to handle, and
  // the one place a capped panel and an uncapped one cannot look the same.
  // 320x568 repeats it narrow, where the width clamp makes the prose taller
  // still.
  //
  // Both of these tiers are phones, so since the navigation row folds they are
  // also the shots of the notes DISCLOSURE at its worst: the longest note in the
  // gallery, expanded inside an overflow panel that is already capped by the
  // room below the bar. If the panel's `overflow-y: auto` were ever lost, this
  // is the pair that shows it.
  for (const name of ['896x414', '320x568']) {
    const viewport = viewports.find(entry => entry.name === name);
    push(viewport, `single-${tallNotesDemo}`, `/single/${tallNotesDemo}`, 'menu-notes-tall', 'light', [notesStep(viewport)]);
  }

  // A PROBE, not a state of the app — the only shots here whose page has been
  // restyled by the harness. See flushRightCss.
  for (const name of ['320x568', '390x844']) {
    const viewport = viewports.find(entry => entry.name === name);
    push(viewport, `single-${barDemo}`, `/single/${barDemo}`, 'menu-export-flushright', 'light',
      [openExportShareMenu], { extraCss: flushRightCss });
  }

  for (const name of ['1440x900', '390x844']) {
    const viewport = viewports.find(entry => entry.name === name);
    push(viewport, `single-${barDemo}`, `/single/${barDemo}`, 'chart-group', 'dark', []);
  }

  // Dark, at the phone tier, of the surfaces the fold introduced.
  //
  // Those panels exist at no other viewport, so the two `chart-group` shots
  // above cannot cover them — and everything in them arrived by being
  // reparented out of a strip and restyled BY CONTEXT rather than by swapping
  // classes, which is exactly the chain a light-mode literal hides in. Four
  // panels, because each holds a different kind of thing: the navigation row's
  // (a link, a toolbar of toggles, the notes disclosure row), the chart strip's
  // (eight reparented buttons, most of them disabled in this state), the config
  // footer's (four toggles plus the generated reference-links row, the one menu
  // row made of anchors), and the same panel with the longest note in the
  // gallery expanded inside it — the only place the disclosure's own title and
  // body colours are on screen at a phone width.
  {
    const viewport = viewports.find(entry => entry.name === '390x844');
    const single = `single-${barDemo}`;
    const singlePath = `/single/${barDemo}`;
    push(viewport, single, singlePath, 'menu-overflow-nav', 'dark', [openNavOverflowMenu]);
    push(viewport, single, singlePath, 'menu-overflow', 'dark', [openChartOverflowMenu]);
    push(viewport, single, singlePath, 'menu-overflow-config', 'dark', [tabConfig, openConfigOverflowMenu]);
    push(viewport, `single-${tallNotesDemo}`, `/single/${tallNotesDemo}`, 'menu-notes-tall', 'dark', [openNotesDisclosure]);
  }

  return shots;
}

// ---------------------------------------------------------------------------
// dev server
// ---------------------------------------------------------------------------

async function isServerUp(baseUrl) {
  try {
    const response = await fetch(baseUrl + '/', { redirect: 'manual' });
    return response.status < 500;
  }
  catch {
    return false;
  }
}

async function ensureServer(options) {
  if (await isServerUp(options.baseUrl)) {
    return { spawned: false, stop: async () => {} };
  }
  if (!options.allowServer) {
    // Naming the port is the useful half of this message: the usual cause is a
    // port-scoped dev server that simply is not running yet.
    throw new Error('no dev server at ' + options.baseUrl
      + ' — start it first (an explicit --base-url implies --no-server; pass --allow-server'
      + ' to let the harness start the VANILLA demo on that port instead)');
  }
  const port = new URL(options.baseUrl).port || '5179';
  const child = spawn(
    'npm', ['run', 'dev', '--prefix', vanillaPackageDir, '--', '--port', port, '--strictPort'],
    { cwd: repoRoot, stdio: 'ignore', detached: false }
  );
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise(done => setTimeout(done, 400));
    if (await isServerUp(options.baseUrl)) {
      return { spawned: true, stop: async () => { child.kill('SIGTERM'); } };
    }
  }
  child.kill('SIGKILL');
  throw new Error('dev server did not come up on ' + options.baseUrl);
}

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------

// Charts animate on mount and on every change, and the animation is driven by
// requestAnimationFrame writing SVG attributes — CSS animation controls cannot
// stop it. So rather than sleeping a fixed time, poll a hash of the rendered
// DOM (which carries every animated geometry attribute) and wait until it stops
// changing. Same idea as waitForSettledBars() in the demo-basic e2e suite, but
// over the whole app subtree instead of just the bars, and requiring three
// consecutive equal samples rather than two.
const settleIntervalMs = 250;
const settleTimeoutMs = 30000;

function domSignature() {
  const root = document.getElementById('root');
  if (root === null) {
    return 'no-root';
  }
  const html = root.innerHTML;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < html.length; i++) {
    const code = html.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return html.length + ':' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

async function settle(page) {
  const deadline = Date.now() + settleTimeoutMs;
  let previous = await page.evaluate(domSignature);
  let stableRounds = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(settleIntervalMs);
    const current = await page.evaluate(domSignature);
    stableRounds = current === previous ? stableRounds + 1 : 0;
    previous = current;
    if (stableRounds >= 2) {
      return true;
    }
  }
  return false;
}

// Even a fully settled page can rasterize differently between runs: Skia's
// analytic antialiasing of rounded corners and glyph edges depends on how the
// frame was tiled and on whether the paint was partial or full, which showed up
// as a handful of +/-3 pixels on the demo's rounded buttons. These flags pin
// the rasterizer down (no partial raster, no LCD/hinted text, fixed colour
// profile, no threaded animation) so repeat captures come out byte-identical.
const chromiumArgs = [
  '--deterministic-mode',
  '--disable-partial-raster',
  '--disable-skia-runtime-opts',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--disable-font-subpixel-positioning',
  '--force-color-profile=srgb',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
  '--disable-new-content-rendering-timeout',
  '--run-all-compositor-stages-before-draw'
];

const freezeCss = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

// ---------------------------------------------------------------------------
// reaching a control that the phone fold has put behind a menu
// ---------------------------------------------------------------------------

const stepTimeoutMs = 5000;

function describeStep(step) {
  return step.kind === 'tab' ? 'tab ' + step.name : step.selector;
}

/**
 * Index of the overflow trigger that discloses `element`, among all triggers in
 * the document, or -1 if the element is not inside an overflow panel.
 *
 * An index rather than a marker attribute or a bespoke selector: the harness
 * must not mutate the page it is photographing (an added attribute changes the
 * innerHTML the settle loop hashes), and the panel has no id of its own to
 * select by. `nth()` over the same selector this counted is stable because the
 * page is settled by the time it is asked.
 */
function overflowTriggerIndexOf(element, selectors) {
  const panel = element.closest(selectors.panel);
  if (panel === null) {
    return -1;
  }
  const wrapper = panel.closest('.demo-overflow-menu');
  if (wrapper === null) {
    return -1;
  }
  const trigger = wrapper.querySelector(':scope > button');
  if (trigger === null) {
    return -1;
  }
  return Array.from(document.querySelectorAll(selectors.trigger)).indexOf(trigger);
}

/**
 * Make `locator` clickable, opening whatever the phone fold hid it behind.
 *
 * The fold MOVES controls into a `…` panel rather than duplicating them, so
 * below the phone breakpoint a control like the mode toggle is still in the
 * document, still the same element, but sitting inside a `display: none` panel.
 * Waiting for it to become visible therefore times out and the step used to be
 * abandoned — which quietly deleted five phone shots from the matrix.
 *
 * Deliberately keyed off the panel class rather than off any particular
 * control: later stages fold more of the strip in, and each one would otherwise
 * need its own special case here.
 *
 * Returns `{ openedOverflow }` on success, `{ failed }` with a reason if the
 * control cannot be reached at all.
 */
async function revealControl(page, locator, step) {
  const selectors = { panel: overflowPanelSelector, trigger: overflowTriggerSelector };

  try {
    await locator.waitFor({ state: 'attached', timeout: stepTimeoutMs });
  }
  catch {
    return { failed: 'control not in the document: ' + describeStep(step) };
  }
  if (await locator.isVisible()) {
    return { openedOverflow: false };
  }

  const triggerIndex = await locator.evaluate(overflowTriggerIndexOf, selectors);
  if (triggerIndex < 0) {
    // Not folded away — just hidden. Give it the benefit of the original wait
    // (a control could still be on its way in) and report honestly if not.
    try {
      await locator.waitFor({ state: 'visible', timeout: stepTimeoutMs });
      return { openedOverflow: false };
    }
    catch {
      return { failed: 'control present but never visible: ' + describeStep(step) };
    }
  }

  const trigger = page.locator(overflowTriggerSelector).nth(triggerIndex);
  try {
    await trigger.waitFor({ state: 'visible', timeout: stepTimeoutMs });
  }
  catch {
    return { failed: 'overflow trigger for ' + describeStep(step) + ' is itself not visible' };
  }
  await trigger.click();
  try {
    await page.locator(overflowPanelSelector + '.open').first()
      .waitFor({ state: 'visible', timeout: stepTimeoutMs });
    await locator.waitFor({ state: 'visible', timeout: stepTimeoutMs });
  }
  catch {
    return { failed: 'overflow menu did not reveal ' + describeStep(step) };
  }
  return { openedOverflow: true };
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

async function captureShot(browser, options, shot, outPath) {
  const context = await browser.newContext({
    viewport: { width: shot.viewport.width, height: shot.viewport.height },
    deviceScaleFactor: 1,
    colorScheme: shot.theme === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce'
  });

  const warnings = [];
  const notes = [];
  try {
    // The demo (and its pre-hydration guard in index.html) reads the VitePress
    // appearance key, so setting it before load themes the very first paint —
    // far steadier than clicking the toggle after mount.
    await context.addInitScript(theme => {
      try {
        localStorage.setItem('vitepress-theme-appearance', theme);
      }
      catch { /* storage unavailable: the page falls back to light */ }
    }, shot.theme);

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));

    await page.goto(options.baseUrl + shot.path, { waitUntil: 'load' });
    await page.addStyleTag({ content: freezeCss });
    if (shot.extraCss !== undefined) {
      await page.addStyleTag({ content: shot.extraCss });
    }
    // Icon and text metrics move the whole layout, so never shoot before the
    // webfonts have actually landed.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15000 });

    if (!await settle(page)) {
      warnings.push('did not settle before the first interaction');
    }

    for (const step of shot.steps) {
      const locator = step.kind === 'tab'
        ? page.locator('.demo-tab').filter({ hasText: new RegExp('^' + step.name + '$') }).first()
        : page.locator(step.selector).first();

      const reveal = await revealControl(page, locator, step);
      if (reveal.failed !== undefined) {
        return { failed: reveal.failed };
      }
      if (reveal.openedOverflow) {
        // The panel opened over the chart, which repaints; let that land before
        // clicking, exactly as after any other interaction.
        if (!await settle(page)) {
          warnings.push('did not settle after opening the overflow menu for ' + describeStep(step));
        }
        // Not a warning — it is the expected route at this tier. Reported so a
        // shot that silently stopped going through the fold is visible in the
        // log rather than only in the pixels.
        notes.push('via overflow menu: ' + describeStep(step));
      }

      await locator.click();
      // A menu step is not done when the click lands: the panel is
      // `display: none` until the opener adds `.open`, and it is positioned in
      // that same turn, so wait for it to be visible before anything measures
      // or shoots it.
      if (step.kind === 'menu') {
        try {
          await page.locator(step.panel + '.open').first()
            .waitFor({ state: 'visible', timeout: stepTimeoutMs });
        }
        catch {
          return { failed: 'menu did not open: ' + step.panel };
        }
      }
      if (!await settle(page)) {
        warnings.push('did not settle after ' + describeStep(step));
      }
    }

    // Park the pointer and drop focus so no :hover / :focus-visible styling
    // leaks into the shot depending on where the last click happened.
    //
    // Both matter for the open-menu shots in particular: opening a
    // menu leaves the pointer on the trigger and focus in it, and the menu items
    // carry a :hover background. (0, 0) is safe to park on — every panel is
    // pinned at least one gap in from both edges it anchors to — and moving
    // there fires no press, so the menu is not dismissed. Neither is blurring:
    // the openers dismiss on outside pointerdown, Escape, scroll and resize,
    // never on focus loss.
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active !== null && typeof active.blur === 'function') {
        active.blur();
      }
    });
    await settle(page);

    // A shot whose whole point is an open menu is worthless if the menu closed,
    // and one with a stray :hover / :focus-visible would flicker between runs —
    // so check rather than trust, on every shot.
    const hoverState = await page.evaluate(() => {
      // Parking at (0, 0) always leaves the pointer over *something* — the html,
      // body and shell containers under that corner are always in `:hover`. Only
      // the things the stylesheet actually restyles on hover can change a pixel,
      // so only those are worth failing over.
      const hoverStyled = 'button, a, input, select, textarea, summary, label,'
        + ' [role="button"], [role="tab"], .demo-btn, .demo-tab, .demo-menu-item';
      const describe = element => element.tagName.toLowerCase()
        + (element.id ? '#' + element.id : '')
        + (element.className ? '.' + String(element.className).trim().replace(/\s+/g, '.') : '');
      return {
        openPanels: document.querySelectorAll('.demo-menu.open').length,
        hovered: Array.from(document.querySelectorAll(hoverStyled))
          .filter(element => element.matches(':hover')).map(describe),
        focusVisible: Array.from(document.querySelectorAll(':focus-visible')).map(describe)
      };
    });
    if (hoverState.hovered.length > 0) {
      warnings.push('hovered elements at shot time: ' + hoverState.hovered.join(', '));
    }
    if (hoverState.focusVisible.length > 0) {
      warnings.push('focus-visible at shot time: ' + hoverState.focusVisible.join(', '));
    }
    if (shot.expectsOpenMenu === true && hoverState.openPanels === 0) {
      return { failed: 'the menu closed before the screenshot' };
    }
    if (shot.expectsOpenMenu !== true && hoverState.openPanels > 0) {
      warnings.push('an unexpected menu was open at shot time');
    }

    await page.screenshot({
      path: outPath,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });

    if (pageErrors.length > 0) {
      warnings.push('page errors: ' + pageErrors.join(' | '));
    }
    return { warnings, notes };
  }
  finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let shots = buildShots(options);
  if (options.filter !== null) {
    shots = shots.filter(shot => shot.name.includes(options.filter));
  }

  if (options.list) {
    for (const shot of shots) {
      console.log(shot.name + '  ' + shot.path);
    }
    console.log(shots.length + ' shots');
    return;
  }

  const outDir = resolve(options.outDir);
  const selfCheckDir = join(outDir, '_selfcheck');
  mkdirSync(outDir, { recursive: true });

  const server = await ensureServer(options);
  console.log((server.spawned ? 'started' : 'reusing') + ' dev server at ' + options.baseUrl);

  const browser = await chromium.launch({ args: chromiumArgs });
  const failures = [];
  const warned = [];
  let captured = 0;

  try {
    for (const shot of shots) {
      const outPath = join(outDir, shot.name + '.png');
      // A shot from a previous run under the same name would otherwise survive
      // a failure here and read as a pass to compare.mjs.
      rmSync(outPath, { force: true });
      const result = await captureShot(browser, options, shot, outPath);
      if (result.failed !== undefined) {
        failures.push(shot.name + ' — ' + result.failed);
        console.log('FAIL ' + shot.name + ' (' + result.failed + ')');
        continue;
      }
      captured++;
      const suffix = result.notes.length > 0 ? ' [' + result.notes.join('; ') + ']' : '';
      if (result.warnings.length > 0) {
        warned.push(shot.name + ' — ' + result.warnings.join('; '));
        console.log('WARN ' + shot.name + ' (' + result.warnings.join('; ') + ')' + suffix);
      }
      else {
        console.log('  ok ' + shot.name + suffix);
      }
    }

    // Determinism self-check: re-capture a couple of shots in the same run and
    // require the PNGs to come out byte-identical. The open-menu shots are in
    // the sample deliberately: they are the ones carrying an interaction whose
    // hover/focus fallout could differ run to run.
    if (options.selfCheck && shots.length > 0) {
      // The sample is chosen for the interactions most likely to differ run to
      // run, not for coverage: the open-menu shots (whose hover/focus fallout
      // is the fragile part), the overflow panel (positioned from a measured
      // rect, and scrolled at 896x414), and a phone `chart-series` shot, whose
      // control is only reachable by opening and dismissing a menu first —
      // three extra state changes before the pixels are taken.
      const repeats = shots.filter(shot =>
        /^(1440x900|390x844)__single-.*chart-group__light$/.test(shot.name)
        || /^320x568__.*__menu-export__light$/.test(shot.name)
        || /^896x414__.*__menu-notes(-tall)?__light$/.test(shot.name)
        || /^(896x414|320x568)__.*__menu-overflow__light$/.test(shot.name)
        || /^390x844__.*__chart-series__light$/.test(shot.name));
      const targets = repeats.length > 0 ? repeats : [shots[0]];
      rmSync(selfCheckDir, { recursive: true, force: true });
      mkdirSync(selfCheckDir, { recursive: true });
      console.log('\nself-check (repeat capture):');
      let allMatch = true;
      for (const shot of targets) {
        const first = join(outDir, shot.name + '.png');
        const second = join(selfCheckDir, shot.name + '.png');
        const result = await captureShot(browser, options, shot, second);
        if (result.failed !== undefined || !existsSync(first)) {
          console.log('  ?? ' + shot.name + ' (could not repeat'
            + (result.failed === undefined ? '' : ': ' + result.failed) + ')');
          allMatch = false;
          continue;
        }
        const same = readFileSync(first).equals(readFileSync(second));
        if (!same) {
          allMatch = false;
        }
        console.log('  ' + (same ? 'IDENTICAL' : 'DIFFERENT') + ' ' + shot.name);
      }
      console.log('  self-check ' + (allMatch ? 'PASSED' : 'FAILED'));
      if (!allMatch) {
        failures.push('the repeat-capture self-check did not come out byte-identical');
      }
    }
  }
  finally {
    await browser.close();
    await server.stop();
  }

  console.log('\ncaptured ' + captured + ' of ' + shots.length + ' shots into ' + outDir);
  if (warned.length > 0) {
    console.log('warnings (' + warned.length + '):');
    for (const entry of warned) { console.log('  ' + entry); }
  }

  // A missing shot is the failure this harness exists to prevent. A state that
  // could not be captured drops out of the comparison entirely and shows up as
  // ONLY-IN-A rather than as a diff — i.e. a hole in the coverage that reads
  // like a pass. So: loud, and non-zero.
  if (failures.length > 0) {
    console.log('\n' + '!'.repeat(72));
    console.log('!! CAPTURE FAILED — ' + failures.length + ' requested shot(s) were NOT captured.');
    console.log('!! This reference set is INCOMPLETE and must not be used as a baseline.');
    for (const entry of failures) { console.log('!!   ' + entry); }
    console.log('!'.repeat(72));
    process.exitCode = 1;
    return;
  }
  console.log('all requested shots captured');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
