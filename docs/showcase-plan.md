# @mochart/showcase plan

A brand-new, mobile-first vanilla TypeScript demo app that showcases every
capability of `@mochart/core`, organized by *feature* rather than by demo mode.
It lives alongside the existing galleries (`@mochart/demo-vanilla` and the
framework demos stay untouched) as `packages/mochart-showcase`, dev port 5181.

Decisions (2026-08-02):

- **New package alongside** the existing demos; whether it later replaces them
  on the deployed site is deferred.
- **Curate + reuse content**: a new feature-organized manifest local to the
  package. Reuse `@mochart/demo-data` demos that showcase well; author new
  local demos for the gaps (animation player, interaction callbacks, style
  states, chart states, currentColor chrome, validation); skip test fixtures.
- **Standalone vanilla**: imports demo-common where it already fits (seeded
  random generators, theme controller, docs links); new UI logic stays local.
  The tiny router/DOM-factory idiom is copied from demo-vanilla, not shared.
- **Deploy under a new slug** (`/showcase`) eventually: the build-pages/CI
  wiring is deliberately NOT part of the initial build (awaiting design
  review).

## Architecture

- Plain DOM factory components (`el()` helpers), tiny history router, no
  framework. Fresh mobile-first stylesheet (`--sc-*` tokens, VitePress-synced
  dark mode via demo-common `initTheme`, `chart-dark.css` for chart chrome).
- Icons are inline SVG (no Font Awesome dependency).
- Routes: `/` gallery · `/d/:slug` demo page · `/wall` desktop multi-chart.
- **Gallery**: sections of cards with live mini-chart thumbnails
  (`createDefaultChart`, animation off, mounted on first IntersectionObserver
  hit, pointer-events disabled).
- **Demo page**: chart up top (always visible), control strip (seed stepper,
  play, reset), tabs Config · Data · About below; ≥1000px the tabs move into a
  side-by-side right panel. Share/export/theme in the app bar.
- **Editing**: first real consumer of `@mochart/editor`:
  `createMochartConfigSupport()` for the config tab (completions, hover docs,
  movalid diagnostics), plain strict-JSON editor for the data tab. Valid JSON
  applies live; a mochart-invalid config renders the chart's own config-error
  state (that's a feature showcase, not a failure).
- **Deterministic randomize**: `?seed=N` in the URL; data for seed N comes from
  demo-common's `generateDemoDataProvider` (chart-type generators + generic
  seeded generator). Stepping the seed is the transition showcase; Play loops
  it. No seed param → curated dataset (which is what data editing edits).
- **Share**: `#s=` hash payload `{v, slug, seed?, config?, data?}`,
  deflate+base64url via fflate (same technique as demo-common shareState, own
  showcase-local shape). Export via `@mochart/export` + theme-aware background.
- **Wall** (`/wall?d=a,b,…&seed=N`): desktop-only grid of charts with a global
  seed stepper/play so everything transitions together; picker limited to
  demos with random specs.

## Special demos

Implemented as manifest flags handled by the demo page:

- `player`: staged-animation player: stacked-bar base, speed control
  (scales `animationConfig` durations) so expand → change → contract is
  legible in slow motion.
- `rotation`: config-morph player cycling demo-common's `rotationConfigs`.
- `states`: segmented Loading / Error / Empty / Data switcher driving the
  chart's state props and factories.
- `callbacks`: live event log under the chart (`onChartClick`, `onFocus`,
  `onSeriesFilter`, `onChartMouseEnter/Leave`).
- `sparklines`: its own page body: intro with inline sparklines + metrics
  table (demo-common `sparklines` models).
- `easing`: a select of every `animation.easing` value, written into the
  config (and `focusEasing`) so a seed step replays the value change with it.

## Curated sections

1. **Bars, lines & areas**: stacked, grouped, stacked-grouped, range, curved,
   scatter, bubble, bar caps (picket), horizontal bars (all reused).
2. **Chart-type helpers**: histogram, waterfall, heatmap, candlestick,
   hollow candlestick, OHLC, error bars, pie, donut, gauge (reused) +
   sparklines (special).
3. **Scales & axes**: multiple axes, threshold line, rotated ticks,
   truncated text, clipped values (reused) + date/time axis (new local).
4. **Animation**: player (new special), rotation (special), easing (new
   special).
5. **Interaction**: callbacks (new special), focus styles (new local),
   tooltip & crosshair (new local), tooltip controls, axis filtering,
   positive/negative currency (reused).
6. **Styling & theming**: gradients, patterns, color property, stacked
   labels, christmas tree bars (reused) + currentColor chrome (new local).
7. **Data handling**: missing values, missing stacked values (reused), chart
   states (new special).
8. **Config & validation**: editor playground (new local).

## Status

- [x] Plan agreed (this document)
- [x] Scaffold + shell + stylesheet (2026-08-02)
- [x] Gallery with live thumbnails
- [x] Demo page + editors + seed/share/export
- [x] Specials (player, rotation, states, callbacks, sparklines)
- [x] Wall mode
- [x] Full curation (36 demos across 8 sections; 45 after the 2026-09-09
      refresh added patterns, bar caps, horizontal bars, clipped values,
      easing, tooltip & crosshair, tooltip controls, axis filtering and
      missing stacked values)
- [x] Verified: typecheck, prod build, zero console errors across all routes ×
      phone/tablet/desktop, scripted interaction pass (seed/legend/share
      round-trip/export/states/rotation), dark mode
- [ ] Design review, gate for what follows
- [ ] Deploy wiring (`scripts/build-pages.mjs` slug + CI): HELD
- [ ] e2e smoke tests: HELD with deploy wiring

Implementation notes: two core-integration gotchas are load-bearing:
`buildMochartConfig` wires back-references into the config object it is given
(never rebuild from the same object; the showcase always hands it a
`structuredClone`), and the chart notifies `onFocus`/`onSeriesFilter` from
inside `update()` (handlers must bail when state is unchanged or they recurse).
