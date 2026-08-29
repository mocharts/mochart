# Demo screenshot harness

A pixel gate for the six demo ports. `capture.mjs` drives Chromium over a fixed matrix of
demo × mode × tab × viewport and writes one PNG per state; `compare.mjs` diffs two output
directories byte-for-byte.

It exists because the demos share `@mochart/demo-common` — one CSS file, one copy table, one set of
DOM class names — so a change to shared code can silently move layout in five packages you did not
open, and a correct port renders *pixel-identically to vanilla*. Both properties are only checkable
by looking at pixels.

```bash
npm run screenshots -- <out-dir>              # capture
npm run screenshots:compare -- <dir-a> <dir-b> --diff-dir <diff-out>
node scripts/screenshots/capture.mjs --list   # print the matrix without shooting
```

The full run is 147 shots and takes a couple of minutes; `--filter <substr>` narrows it to shots whose
file name contains the substring, for a quick check. There is no `--help` — the option list is the
comment block at the top of `capture.mjs`.

## Verifying a port

Every port shares `demo.css` and the same DOM structure, so point the harness at the port's own dev
server and diff against the vanilla reference:

```bash
npm run dev --workspace @mochart/demo-react       # or whichever port
npm run screenshots -- <out-dir> --base-url http://localhost:5174
npm run screenshots:compare -- scripts/screenshots/refs/current <out-dir>
```

| port | dev server |
|---|---|
| vanilla | 5179 (the harness default) |
| react | 5174 |
| svelte | 5175 |
| vue | 5176 |
| lit | 5177 |
| angular | 5180 |

Vanilla is the only package the harness can start for itself. **An explicit `--base-url` therefore
implies `--no-server`** — otherwise a harness pointed at a dead port would spawn *vanilla* there and
cheerfully diff vanilla against itself, reporting a perfect pass for a port that never loaded. Pass
`--allow-server` if you really do want vanilla started on that URL.

Watch for a **stale Vite pre-bundle** when reusing a long-running dev server: it will not pick up new
exports added to `@mochart/demo-common` (angular failed to boot with "does not provide an export
named `menuZIndex`"). Restart it, or use `vite --force`, before trusting a run against it.

## Determinism

Hard-won, and easy to break:

- Chromium gets raster flags (`--deterministic-mode`, `--disable-partial-raster`, …). Without them
  Skia antialiasing on the notes button's rounded corners flickers ~8 pixels and "0 different"
  becomes a coin flip. Do not remove them.
- `settle()` polls a DOM hash until it stops changing, so animations and layout have finished before
  the shot.
- A requested-but-uncaptured shot **fails loudly and exits 1**. Coverage must never silently vanish —
  a missing shot is the one failure mode that would otherwise read as a pass.
- Font rasterization differs between platforms, so a reference set captured on one machine will not
  match one captured elsewhere. This is why `refs/` is gitignored.

`compare.mjs` reports files present in only one directory separately from the diffed ones. A filtered
capture diffed against a full reference set will show a large "only in A" count — that is expected,
and it is *not* the same thing as a difference.

## Reference sets

Gitignored (`scripts/screenshots/refs`, ~12MB of PNGs). The harness itself is tracked; only the
images are not.

- **`refs/baseline-prework`** — 69 shots from before any of the mobile-fold work changed a line.
  Irreplaceable: it cannot be re-captured, because the code that produced it no longer exists.
- **`refs/current`** — 147 shots of the finished vanilla state. Diff against this after any change to
  shared code, and to verify a port.

**The claim worth preserving:** every shot at 1440×900, 901×800, 700×900, 820×1180 and 641×800 that
exists in both `baseline-prework` and a fresh capture is byte-identical. 641×800 is the deliberate
control — one pixel above the phone tier, so it proves the fold did not leak upward.

Demo ids the matrix uses: `grouped` (bar), `pie` (the slice panel), `candlestick` (the longest notes
in the gallery at 1044 chars — the case that makes a panel's `max-height` bind).

---

# The feature this was built for: the phone overflow fold

Below the phone tier the top bar and every control strip fold their secondary controls into `⋯`
menus. Desktop is unchanged — that is the constraint everything else works around. Shipped 2026-07-30 across all six
ports; this section is the durable rationale and the traps, not a work plan.

## Why

The demos don't scroll — the shell is locked to `100dvh` with `overflow: hidden`. Every row the top
bar or a control strip wraps to is a row of chart height lost. At 390px the top bar carried ~9 tap
targets and wrapped; the single-mode category strip carried 10 buttons plus an input and wrapped two or
three deep. Earlier mobile passes took the cheap wins (Multi hidden on phones, 2nd chart dropped,
`.btn-label` clipped below 900px); what remained was genuinely too many controls for the width.

Result at 390×844: top bar 2 rows → 1, category panel 4 → 1, series 3 → 2, slice 3 → 2, random strip
2 → 1, config footer 5 → 1, data footer 2 → 1. The series panel holds 2 rows even at 320×568.

## The one idea everything rests on: reparent, never duplicate

Controls are built **once**. On a phone their DOM nodes are **moved into** the menu; on desktop they
move back. They are never rendered twice.

This is why `sync()`'s ~16 `setDisabled`/`setPressed`/`setContent` calls needed no changes across
three panels, why there are no duplicate ids or duplicate accessible names, and why the fold is
nearly free. The proof is observable: with an empty category input, Add reports `disabled` **in the
strip** while Reset reports enabled **in the menu** — same elements, no mirroring.

**Any port that renders a control twice and hides one with CSS has missed the design.** The reactive
ports satisfy the same contract differently — each control is rendered in exactly one place (strip or
panel) from the same definition, conditional placement rather than DOM reparenting.

## What folds

- **Top bar** — stays: `Chart | Config | Data`. Folds: mode switcher, notes, theme toggle,
  back-to-gallery, site-root link, plus a "Mode" section header above the Single/Random rows.
- **Category panel** — stays: Add, Remove, the value input. Folds: Reset, Reverse, Select All, play-add,
  play-remove, Stop, Edit Series/Categories.
- **Series panel** — stays: the steppers with their readouts, the JSON input, and **Apply, moved down
  onto the input row** beside the JSON it applies. Folds: Reset, Edit Categories. Readout prefixes shrink
  to `G 3` / `S 0` (`.demo-label-prefix-compact`, `aria-hidden`, full text preserved as the
  accessible name).
- **Slice panel** (pie/donut) — stays: prev/next, readout, Apply, value input. Folds: Reset, play
  slices, Stop.
- **Random strip** — stays: Back, Randomize (the mirrored dice pair; stepping by hand is the mode's
  primary interaction). Folds: Play, Stop, Reuse, Interval — the set-and-forget automation controls.
- **Config / Data footers** — stays: Apply, and the `role="alert"` error span (a message that has to
  be read cannot live behind a tap). Folds: everything else, including the generated docs links.
- **Rotation and sparkline never fold**; transition does. `canFold` in TopBar gates it: a bar folds
  only when it has tabs, notes or a mode switcher. Rotation's and sparkline's bar is just a back link
  and a theme toggle, which fits at every width — folding it would produce a row whose only content
  is a `⋯` holding two rows. Transition's tabs wrap a 320px row without the fold.

Multi mode is hidden on phones. The export/share menu keeps its own trigger everywhere.

## Deliberate decisions — do not silently revisit

- **Disclosures, not ARIA menus.** `aria-expanded` + `aria-controls`, no `aria-haspopup`, no
  `role="menu"`. Not just the cheaper option, the correct one: the panels hold a reparented `<a>`, a
  `role="toolbar"` div and an `<input type="number">`, none of which are valid `menuitem`s — and
  `aria-pressed` (used by five toggles) is invalid on `role="menuitem"`. `Tab` walks items in DOM
  order, `Escape` closes and returns focus, no focus trap. A disclosure isn't a modal.
- **The fold fires at the existing phone tier only** (`≤640px`, or `≤900×≤480`). No new breakpoint.
- **Gated in JS** via `watchPhoneViewport`, not by a media query — CSS only styles the two contexts.
- **44px touch targets, phone tier only.** WCAG 2.2 **2.5.8 (AA) asks 24×24 and was already met**;
  44×44 is **2.5.5 (AAA)** and the iOS/Material minimum. Costs ~24px of chrome, buys back ~119px of
  wrapped rows. They are affordable *because* of the fold; they would not be on their own.
- Notes render as an inline disclosure *inside* the overflow panel, not a nested popover — a panel
  nested in `.demo-menu` dies when the menu closes.

## Gotchas that cost real time

1. **The `.btn-label` specificity trap.** The ≤900px tier clips `.btn-label` with *three-class*
   selectors scoped to the control strips (specificity 0,3,0). An overflow panel is `position: fixed`
   but still a **DOM descendant** of the strip, so those selectors match its contents. A
   `.demo-menu .btn-label` rule at 0,2,0 outside the media query **loses**, and every menu row
   renders as a bare icon. The un-clip must live **inside that same `@media (max-width: 900px)`
   block, after the clippers, at matching specificity**. Move it out to sit "tidily" with the other
   menu CSS and the fold silently breaks below 900px.
   This is also why `menuLabel` is a separate span (`.btn-menu-label`, revealed only inside
   `.demo-menu`): giving an icon-only button a real `label` would render visible text above 900px and
   break "desktop unchanged".
2. **`align: 'end'` anchors to a row, not a trigger.** Both the single-mode strip and the random
   strip put another trigger to the `⋯`'s right. Measuring from the `⋯` leaves the panel short of the
   row's end, and a 320px panel then hangs off the *opposite* edge (observed at `left: -39`). Pass
   `getAnchor` — the single-mode strip anchors to `.chart-controls-menu`, the random strip and both
   editor footers to their full-width container.
3. **Identity bail-outs are required, not an optimisation.** `sync()` runs on every keystroke.
   `replaceChildren` with an identical list still detaches and re-inserts, blurring focus. Both
   `setItems` and `placeControls` compare against the last applied list; `.demo-menu-divider`
   elements come from a per-slot cache or the comparison never matches.
4. **Detaching drops focus even when the node goes straight back.** `withPreservedFocus()` in
   `dom.ts` wraps the moves. Without it, pressing Edit Series from inside the panel left focus on
   `<body>`.
5. **Never add a child to `.editable-chart-container`.** Its children are grid items of a
   `display: contents` grid; a third one starts a new implicit column and unaligns the two charts at
   desktop widths. (Already fixed once, in commit `6ad187d`.) The `⋯` goes inside
   `.chart-controls-menu`, which `sync()` already reparents into the active panel — so the overflow
   follows for free. Phones never render two charts, so a regression here is a *desktop* one:
   verify at ≥1000px with the 2nd chart on.
6. **`.demo-has-overflow` gates the nav-row fold CSS.** `flex-wrap: nowrap` on a row whose surplus
   has nowhere to go pushes controls out of an `overflow: hidden` container with no scrollbar to
   retrieve them. `TopBar` sets the class only when it actually renders a trigger, so the CSS cannot
   land without its markup.
7. **The phone tier is duplicated** between `viewport.ts` and `demo.css`. A dev-only guard compares a
   `--demo-phone` CSS variable against `matchMedia` and console.errors on drift. Never "simplify" the
   JS side to `window.innerWidth <= 640` — `innerWidth` includes the scrollbar and is not what the
   media query measures.
8. **Close-on-scroll and outside-close.** The reflow listener is capture-phase, so it must ignore
   scroll events originating inside an `overflow-y: auto` panel or the menu closes as you scroll it.
   Outside-close is bound to `pointerdown`, not `mousedown` — touch does not synthesise `mousedown`
   if the chart's interaction layer calls `preventDefault()` on `touchstart`.
9. **Inactive tab panes are `inert`.** They sit offset by `margin-left: -100%`; without `inert` you
   can tab into a hidden pane's `⋯`, and opening it measures a trigger a full viewport-width to the
   left, so the panel lands off-screen.

## Per-port mechanisms

Everything reusable lives in `@mochart/demo-common` and needs no per-port work: `menu.ts` (geometry,
dismissal, controller), `demoText.overflowMenu.*` and the `menuLabel` keys, and every CSS rule. What
each port re-expresses is markup and the item lists — the top bar (**6 files each**: `single/`,
`multi/`, `random/`, `transition/`, `rotation/`, `sparkline/` each build
`.mochart-demo-tabs-container` by hand, and they are *not* identical), plus `single/EditableChart.*`,
`random/RandomChartTab.*` and `single/{ConfigTab,DataTab}.*`.

Two menu mechanisms:

| | ports | takes from demo-common |
|---|---|---|
| Framework-owned open state | react & vue `misc/useMenu.ts`, svelte `misc/menu.svelte.ts` | `getMenuPosition` + `watchMenuDismiss` |
| Imperative controller | vanilla, angular & lit `misc/overflow-menu.ts` | those plus `createMenuController` |

Angular and lit are the only `bindTrigger: false` consumers, since both keep a template click
handler — otherwise two handlers fire per press and cancel out.

Single-sourcing the folded controls is expressed five ways, all equivalent: JSX consts (react),
snippets (svelte), `h()` functional components (vue, whose SFC templates cannot single-source a
fragment), `<ng-template>` + `ngTemplateOutlet` (angular), and private methods returning
`TemplateResult` (lit). Content passing likewise: `children` (react), children snippet (svelte),
named slot (vue), `<ng-content>` (angular), and a **thunk property** (lit — it renders into the light
DOM via its shared `LightElement`, where `<slot>` does nothing, so a thunk is the package's
established idiom, cf. `error-tab`'s `.content`).

Vanilla is the reference implementation: read `misc/TopBar.ts`, `misc/OverflowMenu.ts` and
`single/EditableChart.ts`'s `placeControls()`. It collapsed its six top-bar sites into one `TopBar`
builder first, as a separately verified pure refactor — worth repeating in any new port, since it
turns six edits into one.

### Svelte: never call `Menu.close()` from an `$effect` without `untrack`

The desktop notes popover could not be opened at all — it gained `.open`, then lost it in the same
microtask, before paint. `NotesMenu.svelte` closes the popover when the demo changes under it:

```svelte
$effect(() => { void title; void notes; menu.close(); });
```

`Menu.close()` *reads* `open`/`panel`/`trigger`, which are `$state`. In runes mode a read inside an
effect is a subscription, so the effect's real dependency set included `menu.open`: opening the menu
re-ran the effect, which closed it again. It worked before the fold only because `NotesMenu` then had
its own **write-only** local `close()`; extracting the shared `Menu` class is what armed it.

Fixed in the class (`close()`'s body is wrapped in `untrack`) rather than at the call site, because
all three svelte components call `close()` from an effect — `ExportShareMenu` and `OverflowMenu` were
previously safe only by accident, via their `if (disabled || !active)` guard. Writes still notify;
only the reads are hidden. React and vue are immune by construction (neither `useEffect` nor
`watch`'s callback auto-tracks), and the imperative ports have no reactive tracking at all.

### Angular

- **Trigger and panel carry STATIC `class` attributes, and no `aria-expanded`.** The controller
  writes `.open` / `.active` / the `aria-*` / the inline position styles itself; a `[class]` or
  `[style]` binding on the same element is re-applied on the next change-detection pass and wipes
  them. `[disabled]` is safe.
- The old `ChangeDetectorRef.detectChanges()` dance in both menus is **gone** for open/close — that
  never goes through Angular now. It survives only where a signal still drives the template.
- `misc/phone-viewport.ts` wraps `isPhoneViewport`/`watchPhoneViewport` behind `DestroyRef`, so the
  six consumers don't each re-implement teardown.

### Lit

Build the controller in `firstUpdated`, never `connectedCallback` — `@query` is a lazy
`querySelector` over the element's own light-DOM output, so the trigger and panel do not exist until
the first render commits.

## What the pixel runs actually caught

React and lit landed 147/147 on the first complete run. The other three did not:

- **Vue** — the notes-disclosure chevron was wrapped in a positioning span instead of being
  positioned itself (13×9px). De-wrapped in all three reactive ports.
- **Svelte** — captured 142/147, and the 5 missing shots were the runes trap above: the find of the
  whole exercise. A functional DOM probe had passed, because it asserted the trigger *exists*, not
  that clicking it opens anything. The harness caught it because it waits for `.demo-menu.open` to be
  visible before shooting, and fails loudly when it never arrives.
- **Angular** — two defects that *predate* this work: (1) every button had a **duplicate `id`**,
  because a static `id="edit-mode"` attribute binds to `ButtonWithTooltip`'s input *and* renders onto
  the host, so the id existed on both a `display: contents` wrapper and the real `<button>`
  (`getElementById` returned the wrapper). Fixed with `host: { '[attr.id]': 'null' }` — one line,
  ~40 call sites. (2) Tab labels rendered as `" Chart"` / `" Config "`, because Angular collapses a
  template's newline+indent to a single space rather than dropping it. Visually harmless, but it
  broke the harness's exact-match tab selector and cost 30 shots. Fixed by putting the interpolation
  flush against the tags.

Three of five runs turned up something a green functional check had passed over. Run the pixels.

## Known-and-left (pre-existing, not caused by this work)

- The config/data `<textarea>`s and the category/series value `<input>`s have **no accessible name**.
  Identical in all six ports; fixing only vanilla would create divergence. Deserves its own pass.
- Desktop config footer tab order: Apply precedes the reference links in the DOM but renders below
  them once the toolbar wraps. Reordering would cost the byte-identical desktop claim.
- **Nothing in the toolchain catches dead exports.** There is no linter in this repo, and tsc's
  `noUnusedLocals` only sees locals and parameters — a symbol re-exported from a package barrel is
  "used" by definition. `getNotesPanelPosition` survived that way until all six ports had migrated
  off it (deleted 2026-07-30). Dead shared code has to be found by grep.
