# @mochart/demo-data

Shared demo configs, datasets, and random-generation specs for the mochart
demo apps (private, not published).

Every demo app — [@mochart/demo-vanilla](../mochart-demo-vanilla/README.md),
[@mochart/demo-angular](../mochart-demo-angular/README.md),
[@mochart/demo-lit](../mochart-demo-lit/README.md),
[@mochart/demo-react](../mochart-demo-react/README.md),
[@mochart/demo-svelte](../mochart-demo-svelte/README.md),
[@mochart/demo-vue](../mochart-demo-vue/README.md), and
[@mochart/demo-basic](../mochart-demo-basic/README.md) — shows the same
gallery of demo charts. This package is the single source of the JSON behind
them, so adding or editing a demo here updates every app at once. Its
framework-agnostic counterpart is
[@mochart/demo-common](../mochart-demo-common/README.md), which holds the
shared demo *logic*.

Like `@mochart/demo-common`, this is a source-only TypeScript package: its
`exports` point straight at `src/index.ts` and the consuming demo's bundler
compiles it (no build step). The loader uses Vite's `import.meta.glob`, so it
requires a Vite (or compatible) bundler.

## Contents

| Path | What it holds |
| --- | --- |
| `src/demos.json` | The manifest: each demo's id, title, and which config/data/random files it uses. `demos` is the curated gallery; `testDemos` are the feature-coverage demos exercising less common config options, shown in a separate section. |
| `src/config/*.json` | Chart configs, one per demo. |
| `src/config/test/*.json` | Chart configs for the test demos: edge cases such as degenerate domains, missing values and crowded axes. All are valid configs. |
| `src/data/*.json` | Datasets (arrays of data objects), shared across demos. |
| `src/random/*.json` | Random-generation specs for the random demo mode. |
| `src/types.ts` | `Demo`, `DemoData`, `DemoConfig`, `DataObject`, `RandomConfig`, `DemoManifestEntry`. |

## Usage

The default export is the assembled collection — every manifest entry joined
with its config/data/random JSON:

```ts
import demoData from '@mochart/demo-data';

const { demoIds, demoObjectMap, testDemoIds } = demoData;
// { id, title, description, notes, config, data, random, generator }
const stacked = demoObjectMap['stacked'];
```

The raw manifest is also exported for tooling that only needs the file list
(the Playwright e2e suite reads it this way):

```ts
import demosJson from '@mochart/demo-data/demos.json';
```

## Adding a demo

1. Add a config JSON to `src/config/` (and, if needed, a dataset to
   `src/data/` and a random spec to `src/random/`).
2. Add an entry to the `demos` array in `src/demos.json` referencing the
   files by basename.

Every demo app picks it up on the next dev-server reload.
