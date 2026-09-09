# @mochart/demo-common

Shared framework-agnostic logic for the mochart demo galleries (private, not
published).

Every demo app — [@mochart/demo-vanilla](../mochart-demo-vanilla/README.md),
[@mochart/demo-angular](../mochart-demo-angular/README.md),
[@mochart/demo-lit](../mochart-demo-lit/README.md),
[@mochart/demo-react](../mochart-demo-react/README.md),
[@mochart/demo-svelte](../mochart-demo-svelte/README.md), and
[@mochart/demo-vue](../mochart-demo-vue/README.md) — implements the same
gallery in a different UI framework. This package holds the logic they all
share, so each demo package contains only its framework-specific wiring. The
JSON demo configs and datasets live separately in
[@mochart/demo-data](../mochart-demo-data/README.md).

Like `@mochart/demo-data`, this is a source-only TypeScript package: its
`exports` point straight at `src/index.ts` and the consuming demo's bundler
compiles it (no build step).

## Contents

`src/` holds 24 modules behind the `src/index.ts` barrel, grouped below by the
part of a demo they serve.

### Editing a demo's config and data

The Config and Data tabs of single mode, plus the validation that decides what
reaches the chart.

| Module | What it provides |
| --- | --- |
| `mochartDemoConfig.ts` | `buildMochartDemoConfig` — builds the derived config bundle (built mochart config, defaults, with/without-defaults views, validation) the editors work with. |
| `configEditing.ts` | Single-demo Config tab helpers: format/parse config JSON, with/without-defaults views, and the Invert / Slow section toggles. |
| `dataEditing.ts` | Single-demo Data tab helpers: format/parse data JSON, filtered-view round-tripping, and apply-time validation (`getConfigDataError` is also the chart path's data check). |
| `unusedDataProperties.ts` | The Data tab's "Unused" filter: collect the data properties a chart config actually reads, filter rows to them, and restore hidden properties after edits. |
| `json.ts` | `parseJson` re-exported from [@mochart/editor](../mochart-editor/README.md), plus `getJsonError` / `getJsonErrorMessage` — the message a failed parse shows, naming the repeated key when that is the cause and reporting plain invalid JSON otherwise. |
| `jsonEditorContent.ts` | `createJsonEditorContent` — a CodeMirror-backed drop-in for the demos' JSON textareas, loading [@mochart/editor](../mochart-editor/README.md) lazily so it stays out of the main chunk. |

### Demo modes and showcase pages

The model each mode and showcase page renders, so the six ports stay mechanical.

| Module | What it provides |
| --- | --- |
| `gallery.ts` | `getGallerySections` — the gallery landing route's model: curated demos, the standalone showcase pages, and the feature-coverage test demos in their collapsed section. |
| `multiCharts.ts` | Multi demo: rotating per-chart data providers. |
| `randomGenerator.ts` | Seeded random chart data generator (`generateChartDataProvider`) behind the random demo mode. Reached through `generateDemoDataProvider`, not exported from the package root. |
| `randomConfig.ts` | Validation and formatting for the random generator's config editor. |
| `chartTypeGenerators.ts` | `generateDemoDataProvider`, random mode's entry point for every demo: it dispatches to a chart-type generator when the demo's manifest entry names one in its `generator` field, and to `randomGenerator.ts` otherwise. The chart-type generators randomize the inputs to the core chart helpers and re-run the helper, so a generated dataset is always valid for its type. The generator ids are listed in `chartTypeGenerators`, and `buildChartTypeDemoSnapshots` exposes the same canonical inputs to the snapshot script. |
| `pieDemo.ts` | Pie-mode helpers. A pie's slices are series over a single data row, so the cartesian demos' category editing has nothing to work on; these back the pie UI instead — the single-mode slice panel, the multi-mode filtering stepper, and folding a chart's reported filtering back into the user's own map. |
| `transition.ts` | Transition demo: default config, data providers, and the transition-config editor's format/apply helpers. |
| `rotationConfigs.ts` | Rotation demo: the generated grid of tick-label rotation configs and its dataset. |
| `sparklines.ts` | Sparkline showcase page: the inline and metrics-table `SparklineMetric` lists, each pairing a `createSparklineConfig` preset with a seeded per-step data generator. |

### Shell, copy and shared browser plumbing

Cross-cutting concerns every mode uses, and the pieces that keep the six ports
mechanical.

| Module | What it provides |
| --- | --- |
| `demoText.ts` | Every user-facing string the demos render: tab titles, button labels, tooltips, aria-labels, captions and inline error messages. All demo copy lives here — add and edit it in this module rather than in a port, and the file's header comment explains the per-button `{ label, tooltip, aria }` convention and the narrower phone-menu-only `menuLabel`. |
| `theme.ts` | `initTheme` — the light/dark controller, synced two-way with the docs site by reading and writing the same `localStorage` key VitePress keeps its appearance choice in. `getChartExportOptions` supplies the current theme's chart-export background. |
| `viewport.ts` | The viewport-width tiers the ports share with `demo.css`, and the mode policy that follows from them: `isPhoneViewport`, `watchPhoneViewport`, `getAvailableDemoModes`/`isDemoModeAvailable` (Multi is not offered on phones) and `phoneFallbackDemoMode`. |
| `menu.ts` | The popover machinery behind the export/share dropdown, the notes panel and the phone overflow menus. Three layers, because the ports do not all need the same amount: `getMenuPosition` (pure geometry), `watchMenuDismiss` (outside-click / Escape / viewport-moved as one subscription), and `createMenuController` (the whole open/close dance against a trigger and panel element). |
| `tabs.ts` | The Chart/Config/Data strip as ARIA tabs, the contract all six ports implement: the `DemoTab` shape, the `demoTabId` / `demoTabPanelId` pairing their `aria-labelledby` and `aria-controls` point at, and the id of the hidden note describing the Chart tab's pending badge. |
| `shareState.ts` | Shareable per-mode view state in the URL hash: `buildShareUrl`/`encodeShareState` for the share menu, `consumeShareState`/`consumeSingleShareState` for the view that receives the link. The payload is JSON, deflate-compressed and base64url-encoded. |
| `docsLinks.ts` | Links from a demo into the documentation site's config reference: `getReferenceSectionIds` (the reference sections a config actually uses) and `getReferenceSectionUrl`. |
| `errorDataProvider.ts` | `createErrorDataProvider` — a provider stub that only reports an error, for demonstrating the chart's error state. |
| `types.ts` | Shared demo types (`MochartDemoConfig`, `DemoMode`, `FocusData`, …); also re-exports the `@mochart/demo-data` types. |

Apart from `randomGenerator.ts`, every module's public surface is re-exported
from the package root, and that is how the demos import it:

```ts
import { buildMochartDemoConfig, collectUsedDataProperties } from '@mochart/demo-common';
```

A handful of helpers are used only within the package and are deliberately left
out of the barrel (`dataEditing`'s JSON-shape predicates, `viewport`'s raw
breakpoint constants, and similar); import them from their module if a port ever
needs one.

## Stylesheets

Two subpath exports, both plain CSS with no build step:

| Export | File | What it is |
| --- | --- | --- |
| `@mochart/demo-common/demo.css` | `css/demo.css` | The demo shell's whole stylesheet: design tokens, layout, the `demo-*` component classes, and the responsive tiers `viewport.ts` mirrors. It imports `@mochart/core/mochart.css` and `chart-dark.css`, so a demo needs only this one import — every port's `main/index.ts` has it. |
| `@mochart/demo-common/chart-dark.css` | `css/chart-dark.css` | Dark-theme restyling for the chart's own structural colors. Chart chrome follows the host page's `color` on its own, so this file covers the tooltip surface only. Imported by `demo.css` and, separately, by the docs site for its live examples. |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run generate-demos -w @mochart/demo-common` | Runs `scripts/generateChartTypeDemos.ts`, which rebuilds the chart-type demos' static config and data JSON in `@mochart/demo-data` from the canonical inputs in `src/chartTypeGenerators.ts`, so the baked snapshots and the random-mode generators cannot drift structurally. Run it after changing those inputs or the core chart helpers; `test/snapshotSync.test.ts` pins the committed JSON to its output. |

`typecheck`, `lint` and `test` are the usual per-package scripts.
