# @mochart/editor

A framework-neutral, strict JSON editor with optional Mochart config intelligence.
It powers the JSON editing tabs in the Mochart demos.

Docs: [mochart.org](https://mochart.org) — start with the
[editor guide](https://mochart.org/guide/editor).

## Install

```sh
npm install @mochart/editor @mochart/core
```

`@mochart/core` is a peer dependency: the config diagnostics run against your
app's copy of the library, so they always agree with the chart you render.

Completions and hover documentation work differently. They come from a config
model generated from `@mochart/core` when this package is built, so they
describe the config surface of the core release the editor was built against.
Pair the editor with a newer core and a section that core added validates
cleanly but has no completions and no hover text. The model records the core
version it was generated from — read it as `mochartConfigEditorModel.coreVersion`
— and `createMochartConfigSupport()` logs one `console.warn` naming both
versions when the installed core reports a different major or minor version. A
patch difference is not reported, because a patch release cannot add or remove
config properties. Installing the `@mochart/editor` release built against your
core version clears the warning.

```ts
import { createJsonEditor, createMochartConfigSupport } from '@mochart/editor';
import '@mochart/editor/editor.css';

const editor = createJsonEditor(document.querySelector('#editor')!, {
  value: JSON.stringify(config, null, 2),
  ariaLabel: 'Mochart configuration',
  ariaDescribedBy: 'config-editor-help',
  support: createMochartConfigSupport(),
  onChange(value) {
    // Keep application state in control of the current value.
  },
  onDiagnostics(diagnostics) {
    // Includes JSON syntax and Mochart validation diagnostics.
  }
});

editor.format();
editor.setValue(nextValue);
editor.setTheme('dark');
editor.showFocusRange(diagnostic.from, diagnostic.to);
editor.destroy();
```

The Mochart support provides:

- completions for top-level, section, and nested properties;
- enum, boolean, and configured-ID value completions;
- hover documentation, defaults, and validation rules;
- syntax and path-aware Mochart validation diagnostics.

Keys repeated within one object are syntax errors on the later occurrence,
because `JSON.parse` would keep only the last value; `format()` refuses such
text rather than dropping the earlier copy. The `@mochart/editor/json` entry
exposes the same rule without the editor: `parseJson(text)` throws a
`JsonDuplicateKeyError` (a `SyntaxError` naming every repeat) where
`JSON.parse` would succeed, and `findDuplicateJsonKeys(text)` lists them as
`DuplicateJsonKey` records (`key`, `path`, and the `from`/`to` offsets of the
later name token); `duplicateJsonKeyMessage(duplicate)` renders one as the
editor's message, and `formatJsonPath(path)` renders any `JsonPath` as
`series[0].property`.

Pass `theme: 'dark'` for the bundled dark syntax treatment, then use
`setTheme('light' | 'dark')` to change it without replacing the document or
undo history. Both themes use CSS custom properties, so hosts can override the
editor surface, focus, border, gutter, selection, and selection-match colors. The editable element receives
`aria-invalid` as diagnostics change, and `ariaDescribedBy` can connect it to
keyboard instructions or other help text.

Run `npm run dev:editor` from the repository root for the isolated editor and
live-chart playground.

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.
