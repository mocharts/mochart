# Contributing to mochart

This guide covers how the repo fits together for people changing mochart
itself — especially the two generated-documentation pipelines: the config
metadata one, whose sources feed validation, the reference pages, and IDE
hovers all at once, and the props one, read straight from the chart type
declarations. For using the library, start at the
[documentation site](packages/mochart-docs/README.md) or the
[core README](packages/mochart/README.md).

## Getting started

```sh
npm install     # runs prepare → build:libs, which builds every library dist
npm run dev     # demo gallery dev server (@mochart/demo-vanilla)
npm run dev:docs  # documentation site dev server (port 5181)
```

Every pull request is gated on the root scripts below. CI runs them in this
order and stops at the first failure, so running them in the same order locally
is the quickest way to reproduce a red build:

```sh
npm run lint          # eslint over the whole repo
npm run deadcode      # knip: unused exports, files and dependencies
npm run typecheck     # every workspace that has a typecheck script
npm run check:publish # every package's publishConfig exports map is dist-only
npm test              # tests in every workspace that has them
npm run test:e2e      # Playwright suites (demo-basic, then demo-vanilla)
```

`test:e2e` needs browsers once per machine:
`npx playwright install chromium firefox webkit`. Chromium runs every spec;
Firefox and WebKit run only the `@smoke` subset. On Linux add `--with-deps`
for WebKit's extra system libraries, as CI does.

CI then runs `build:pages` twice, once per base path; the checks that step
carries are listed under [CI guardrails, in one
place](#ci-guardrails-in-one-place).

The library packages ship built `dist/` output that is gitignored, so a fresh
clone must `npm install` before anything imports `@mochart/core` by its
default export condition (dev servers use the `development` condition and run
from `src/`). Target one workspace with `-w`, e.g.
`npm test -w @mochart/core`. `lint` and `deadcode` exist only at the root;
narrow them with a path (`npx eslint packages/mochart`) or a workspace
(`npx knip --workspace packages/mochart`) instead.

## The config metadata pipeline

Every config section has **three sources of truth** in `packages/mochart/src/config/`:

| Source | Directory | Feeds |
| --- | --- | --- |
| Validators | `validation/` | runtime validation, reference "Validation" text |
| Defaults (incl. conditional) | `defaults/` | runtime defaulting, reference "Default" text |
| Descriptions + optional `getDetails()` | `docs/` | reference prose, generated JSDoc |

Everything documentation-shaped is **generated from those sources**, so they
can never drift from the code:

- `scripts/configReferenceModel.ts` assembles the structured model;
  `scripts/generator.ts` (`npm run generate-docs -w @mochart/core`) emits
  `generated/config-reference.json`. It **exits
  non-zero when the three sources disagree** on a section's keys — at every
  level of nesting, and inside the shape of an array's elements, whose
  defaults come from the `itemDefaults` the section descriptor declares. The
  same script emits the API model described
  [below](#the-props-callbacks-and-framework-props-pipeline), and writes
  nothing at all when either model fails its checks.
- `scripts/generateJsdoc.ts` (`npm run generate-jsdoc -w @mochart/core`)
  rewrites the JSDoc on the config interfaces in `src/types/config.ts` from
  the same model. `test/config/jsdocSync.test.ts` fails whenever the file is
  out of date — regenerate rather than hand-edit those comments.
- The docs site renders its config reference from
  `generated/config-reference.json` at build time, and adds per-property
  "Used in" links from a build-time scan of the docs examples and demo
  configs.

### Adding a config property, end to end

1. Add the validator in `src/config/validation/<section>.ts`.
2. Add the default in `src/config/defaults/<section>.ts` (conditional
   defaults live there too; a property that intentionally has no default must
   be whitelisted in `scripts/configReferenceModel.ts`).
3. Add the description in `src/config/docs/<section>.ts` — and a `getDetails()`
   entry if one line isn't enough.
4. Add the typed property to the matching interface in `src/types/config.ts`
   (just the type — its JSDoc is generated).
5. Implement the behavior, then run
   `npm run generate-docs -w @mochart/core` and
   `npm run generate-jsdoc -w @mochart/core`.
6. `npm test -w @mochart/core` — the parity checks and the JSDoc sync test
   confirm the sources agree, and the golden tests catch rendering changes.

### Adding a new config section

Beyond the three sources and the type, a new section must be registered in a
few generated-docs consumers (each is a simple list):

- `scripts/configReferenceModel.ts` — the `getSectionSources()` descriptor
  list (and `sectionKeyAllMap` handling if it has a companion `*Defaults` section).
- `scripts/generateJsdoc.ts` — `sectionInterfaceMap`.
- `packages/mochart-demo-common/src/docsLinks.ts` — the section id list that
  drives the demo Config tab's reference links (enforced by that package's
  `docsLinks.test.ts` coverage guard).
- `packages/mochart-docs/.vitepress/lib/usageIndex.ts` — the object/list
  section id sets (enforced by the docs `scripts/checkSectionCoverage.ts`
  check in its test script).

## The props, callbacks, and framework-props pipeline

Chart props, callbacks, and callback payloads are generated too, from a
different single source: the **JSDoc on the exported interfaces in
`packages/mochart/src/types/chart.ts`**. Unlike the config JSDoc, these
comments are hand-written — they are what ships in the `.d.ts` and what editors
show on hover, so the hovers and the reference pages cannot disagree.

- `packages/mochart/scripts/apiReferenceModel.ts` reads those interfaces into
  `generated/api-reference.json`. Its `pageSources` list declares the pages
  (`/reference/props`, `/reference/callbacks`) and their groups, one group per
  interface, and carries each group's lead prose.
- `packages/mochart/scripts/generator.ts` builds the config model and the API
  model and writes **either both or neither**, so a run that fails its checks
  leaves the previous artifacts in place rather than half-regenerated ones.
- `packages/mochart-docs/scripts/generateBindings.ts` reads the five binding
  packages' prop declarations — the `types.ts` prop interfaces, Angular's
  `@Input`/`@Output` members, and Vue's runtime prop objects in `props.ts` —
  together with `api-reference.json`, into
  `packages/mochart-docs/generated/binding-reference.json`, the model behind
  `/reference/framework-props`. Each binding prop's description is inherited
  from the core prop it maps to, so the prose has one home; a binding prop
  needs its own JSDoc only when it has no core counterpart — the container
  props a binding owns itself, such as `className`, `class`, `style`,
  `dataTestId`, and Lit's `chartRef`.
- All three models render through one dynamic route,
  `packages/mochart-docs/reference/[section].md`.

All three JSON models are gitignored build artifacts. `npm run gen -w @mochart/docs`
rebuilds all three, and the docs `dev`, `build`, and `test` scripts each run it
first — so these generators gate the docs build *and* root `npm test`.
`generator.ts` can also render the model as one standalone html page, by passing
an output path as its first argument; nothing in the repo asks for it.

### What fails the generators

Besides the config key parity above, each of these is reported as an integrity
error naming the interface, prop, or package at fault:

- an interface exported from `types/chart.ts` that no page group covers — add
  a group to `pageSources`, or an entry to `internalInterfaces` with the
  reason it needs no page (and delete the `internalInterfaces` entry when the
  interface goes away);
- a member of a documented interface with no JSDoc description;
- a binding prop that neither maps to a core prop nor documents itself;
- a core prop with no counterpart in one of the bindings, unless that
  binding's `expectedMissing` gives a reason — and a stale `expectedMissing`
  entry, for a prop the binding has now or that core no longer has, fails the
  same way;
- Vue's `props.ts` and `types.ts` declaring different prop keys.

`packages/mochart-docs/scripts/checkApiCoverage.ts` is the backstop the
generators cannot be — it catches a member quietly moving to an interface
nothing documents. It requires that every public export of `@mochart/core`,
`@mochart/export`, and `@mochart/editor` (resolved through the TypeScript
checker, so no export syntax hides one) is named on some guide, reference, or
recipe page; that every `ChartHandle` method appears as a call, `` `method( ``,
so a rename breaks the check; that every prop-interface member reached the
api-reference model; and that the non-JS surface — the optional stylesheet
subpath exports and the script-tag IIFE artifact — is mentioned as well.
Exports declared under `src/types/` are exempt: that surface is the generated
config reference and the shipped `.d.ts`. A name that should stay
undocumented goes in the script's `undocumented` map with a reason.

### Adding a chart prop, callback, or payload field, end to end

1. Add the member to its interface in `packages/mochart/src/types/chart.ts`
   **with a JSDoc description** — the generator fails without one, and that
   comment is the only place the description is written.
2. A new payload or props interface also needs a group in `pageSources`
   (`packages/mochart/scripts/apiReferenceModel.ts`), with the title, page,
   and description the reference should show — or an `internalInterfaces`
   entry saying why it is not documented.
3. Implement the behavior in core.
4. Give all five bindings a counterpart, or a reason not to. The mapper
   recognizes the same name, an Angular output that drops the `on` prefix
   (`onChartClick` → `chartClick`, or `onFocus` → `focusChange` where the bare
   name would shadow a DOM event), and a state factory turned placeholder
   prop (`getLoadingComponent` → `loadingComponent`, or `loadingTemplate` in
   Lit). Anything else has to be listed in that binding's `expectedMissing`
   in `packages/mochart-docs/scripts/bindingReferenceModel.ts`, with the
   reason. Vue declares its props twice, in `src/props.ts` and `src/types.ts`,
   and both must carry the key.
5. A new public export or `ChartHandle` method also needs a mention on a docs
   page — a prop or callback does not, since its reference page is generated.
6. Run `npm run gen -w @mochart/docs`, then `npm test -w @mochart/docs` for
   the coverage checks and `npm test -w @mochart/core` for the rest.

### Adding a public export

1. Export the name from `packages/mochart/src/index.ts` (or the export or
   editor package's entry).
2. Name it on a docs page. `packages/mochart-docs/reference/api.md` is the
   hand-written home for the exported surface: a function or class gets its
   own entry there, a constant joins the constants table, and a recipe or
   guide mention counts too. A literal union type declared in
   `src/config/core/constants.ts` (`MarkerShape`, `DomainChange`, …) is
   instead documented by the generated `/reference/enumerations` page: give it
   a description in `packages/mochart/scripts/enumerationsModel.ts` — the
   generator fails without one — and its values and uses are read from the
   source. A name that should stay undocumented goes in the `undocumented`
   map of `packages/mochart-docs/scripts/checkApiCoverage.ts` with a reason.
3. Run `npm test -w @mochart/docs`; `checkApiCoverage.ts` fails on any export
   no page names, and on any stale `undocumented` entry.

## Golden snapshot tests

`packages/mochart/test/golden/` renders **every demo config** from
`@mochart/demo-data` through the public `createChart()` API in jsdom, drives
the staged animations on a fake clock, and compares normalized DOM against
checked-in snapshots (initial mount, static update, mid-tween, and settled
states). They are the primary regression oracle for renderer changes:

```sh
npm test -w @mochart/core                 # includes the golden suite
npx vitest run -u                          # (in packages/mochart) update snapshots
```

Review golden diffs like code — an unexpected snapshot change usually means
an unintended rendering change.

## The config fuzzer

`packages/mochart/test/fuzz/` sweeps every leaf config property across its
candidate values on a spread of base configs, checking each result against
four oracles: nothing throws or fails to settle, no `NaN` or negative extent
reaches a rendered attribute, building config B directly matches updating to
it from config A, and the inputs come back unmutated. It is not part of the
gate — reach for it after changing config validation, defaults, or renderer
state:

```sh
npm run fuzz -w @mochart/core                      # the full sweep, hours long
npm run fuzz -w @mochart/core -- --sections=legend # one section, seconds
```

The report lands in `packages/mochart/.fuzz/` (gitignored, rewritten as the
run goes, so a long run can be read while it works). See
[test/fuzz/README.md](packages/mochart/test/fuzz/README.md) for the oracles
in full.

## The demo galleries

Six feature-equivalent galleries (vanilla + five framework ports) share their
logic through `@mochart/demo-common` and their configs/datasets through
`@mochart/demo-data`:

- All user-facing copy lives in demo-common's `demoText` — edit it there
  only.
- A feature added to one gallery's UI is expected in all six (see the share
  button or Config-tab docs links for the pattern: shared logic in
  demo-common, one thin component per framework).
- Demo blurbs live as `description` fields in `demo-data/src/demos.json`.
- There are two Playwright suites, and root `npm run test:e2e` runs both.
  `@mochart/demo-basic` holds the core one and is a minimal harness rather
  than a gallery, not deployed; `@mochart/demo-vanilla` has its own, covering
  the editor, export, share menu and phone layout.

## The documentation site

`packages/mochart-docs` is a VitePress site (see its README for structure).
Points worth knowing when contributing:

- Example configs in `examples/` power the live charts and are validated in
  CI with the library's own `validateConfig`/`getDataErrors`
  (`npm test -w @mochart/docs`) — a broken example fails the build.
- The config reference pages and their "Used in" links are generated, as are
  the props, callbacks, enumerated-values, and framework-props pages; edit
  the sources (above), not the pages. Two reference pages are still written
  by hand: `reference/api.md` (the exported functions and classes) and
  `reference/index.md` (the overview, whose section table reads the config
  model).
- VitePress fails the build on dead internal links. Links into the demo
  galleries (`/vanilla/…`) resolve only on the assembled site and are
  exempted in `.vitepress/config.ts`; demo deep links need a trailing slash
  so VitePress doesn't append `.html`, and anchors into non-VitePress pages
  need `target="_self"` so its SPA router doesn't intercept them.

## Site assembly and deployment

`npm run build:pages` (scripts/build-pages.mjs) assembles `site/`: the docs
site at the root, each gallery at `/<slug>/`, a demo deep-link redirect
injected into the docs 404.html (GitHub Pages has no rewrites), and a
`_redirects` file for Cloudflare Pages. `PAGES_BASE` sets the base path
(defaults to `/mochart/`; CI builds a `/` variant for Cloudflare). Deploys
are gated behind the `ENABLE_PAGES_DEPLOY` / `ENABLE_CLOUDFLARE_DEPLOY`
repository variables — see `.github/workflows/ci.yml`.

## CI guardrails, in one place

| Check | Where it runs |
| --- | --- |
| ESLint rules | `eslint .` → `npm run lint` |
| Unused exports, files and dependencies | `knip` → `npm run deadcode` |
| Types, per workspace | `tsc` / `svelte-check` / `vue-tsc` / `ngc` → `npm run typecheck` |
| Publish manifests are dist-only | `npm run check:publish` |
| Config sources key parity | generator exits 1 → `npm run gen` → root `npm test`, `build:pages` |
| API model integrity: page groups and prop JSDoc | generator exits 1 → `npm run gen` → root `npm test`, `build:pages` |
| Framework binding props against core props | `generateBindings.ts` exits 1 → `npm run gen` → root `npm test`, `build:pages` |
| Public API mentioned in a docs page | `checkApiCoverage.ts` → root `npm test` |
| Usage-index section registries | `checkSectionCoverage.ts` → root `npm test` |
| Generated JSDoc freshness | `test/config/jsdocSync.test.ts` → root `npm test` |
| Stamped `src/version.ts` freshness | `stampVersion.ts --check` on core `prebuild` → `npm ci`; `test/config/versionSync.test.ts` → root `npm test` |
| Docs example validity | `checkExamples.ts` → root `npm test` |
| Golden rendering snapshots | core vitest → root `npm test` |
| Dead docs links | VitePress build → `build:pages` |
| Demo behavior | Playwright e2e → `npm run test:e2e` |

The first two are worth a word on scope:

- **Lint** (`eslint.config.mjs`, one flat config for the whole monorepo) is
  configured to catch bugs, not style: there are no formatting rules, and every
  disabled rule carries a comment explaining why it is off. Type-aware rules
  run on plain `.ts`/`.tsx`; `.svelte` and `.vue` files get their framework
  plugin's syntactic rules only, because `svelte-check`/`vue-tsc` in
  `typecheck` already cover their types. `npm run lint:fix` applies the
  autofixable subset, and a deliberately unused binding is spelled with a
  leading `_`.
- **Dead code** is knip over every workspace: it reports exports, types and
  files that nothing in the repo reaches, and declared dependencies nothing
  imports. Reachability starts from the `entry` patterns in `knip.json`, which
  is where an export that is public API but has no in-repo consumer belongs.

## Config format versioning

Configs may carry a `version`; when present, strict validation requires it to
equal `CONFIG_VERSION` (`src/config/core/constants.ts`), and omitting it means
"the current format". If a change to the config format bumps it, add a
migration step to `src/config/migration/` so `migrateConfig` upgrades older
configs, and update the version in the demo configs and docs examples.

The package version is a separate thing: `scripts/stampVersion.ts` copies it
from `package.json` into the tracked `src/version.ts`. The core build only
*checks* that copy, so an install never dirties a tracked file — after bumping
`package.json`, run `npm run stamp-version -w @mochart/core`.
