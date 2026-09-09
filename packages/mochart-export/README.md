# @mochart/export

SVG and PNG image export for the
[@mochart/core](https://github.com/mocharts/mochart) charting library. Give it any
element containing a rendered chart and it downloads the chart as a
standalone image — computed styles inlined, the on-screen focus state kept
unless `showFocusElements: false`, and an optional solid background painted
beneath the chart.

Docs: [mochart.org](https://mochart.org) — start with the
[export guide](https://mochart.org/guide/export).

The export captures everything inside the chart svg (title, plot, axes,
legend); the HTML tooltip is never included. Fonts are the one thing that does
not travel with the file — see [web fonts](#web-fonts). Several charts can
also be tiled into a single image — see
[multiple charts in one image](#multiple-charts-in-one-image).

## Install

```sh
npm install @mochart/export @mochart/core
```

## Usage

```js
import { exportSVG, exportPNG } from '@mochart/export';

// element can be the chart's container, the div.mochart-chart root itself,
// or the chart <svg> element
exportSVG(element);
await exportPNG(element);
```

Both functions look up the chart svg inside `element`, derive the filename
from the chart title (falling back to `export`), and trigger a browser
download. `exportSVG` returns `false` (and `exportPNG` resolves `false`)
when no chart svg is found. The PNG functions can also reject, such as when the
browser refuses a canvas, cannot encode it, or will not rasterize the svg (see
[Web fonts](#web-fonts)). Attach a `catch` as well.

### Options

```js
exportSVG(element, {
  filename: 'my-chart',      // exact filename (no extension); overrides the title
  filenamePrefix: 'acme-',   // prefix for the title-derived filename
  transparent: true,         // keep the background transparent
  backgroundColor: '#f5f5f5',  // background when not transparent (defaults to the page background behind the chart)
  fontFaceCss: '@font-face{…}', // font data to embed in the file (see Web fonts)
  showFocusElements: false   // strip the crosshair and axis focus marks (default true keeps them as shown)
});

await exportPNG(element, {
  // all of the svg options, plus:
  scale: 3 // rasterization scale relative to the on-screen size (default 2)
});
```

## Web fonts

The chart itself sets no font, so its text uses whatever font the page gives
it. The export inlines `font-family` as a *name*; no font data goes into the
file. A font that is installed on the machine still resolves by name, but a
web font the page loaded over the network does not:

- **PNG.** The rasterizer loads the svg as an image, and an svg loaded as an
  image cannot fetch anything external. Only fonts installed on the machine
  running the export are available; a web font is replaced by the renderer's
  default.
- **SVG.** The same applies wherever the file is later opened, on whatever
  machine opens it.

The substitution is not only cosmetic. Text is measured on screen with the
live font and written into the markup as coordinates, so labels keep the
positions, alignment, and truncation computed for a font that is no longer
there.

Three ways to handle it:

1. **Render the chart in a font every machine has.** Give the chart text a
   system font stack in your own CSS — `.mochart-chart text { font-family:
   ui-sans-serif, system-ui, Arial, sans-serif }`. Screen and export then
   agree, and there is nothing to pass to the export.
2. **Accept the substitution**, if the chart's typeface does not matter.
3. **Embed the font** with `fontFaceCss`.

```js
await exportPNG(element, {
  fontFaceCss: "@font-face { font-family: 'Inter'; src: url(data:font/woff2;base64,d09GMgAB…) format('woff2'); }"
});
```

The string is injected verbatim into one `<style>` element in the exported
file — a stitched grid gets a single one that covers every tile. What it has
to contain is up to the host:

- The `src` must be **base64 data**, not a url. A url is an external fetch,
  which is exactly what the image-loaded svg cannot do.
- The `font-family` name must match the family the chart text is rendered
  with, since that is the name the export inlines.
- Fetching and encoding the font file is the host's job. Only the host knows
  which file and weights to use, whether the font's license permits shipping
  it inside an exported image, and whether the font server allows reading the
  bytes with `fetch` (a third-party font CDN often does not — a self-hosted
  font is simplest).
- A single full woff2 weight adds tens to hundreds of kilobytes to every
  exported file. Subset it to the glyphs the chart uses.

## Multiple charts in one image

```js
import { exportChartsSVG, exportChartsPNG } from '@mochart/export';

// tile the charts found in the elements into a 2-column grid
exportChartsSVG([elementA, elementB, elementC], { cols: 2 });
await exportChartsPNG([elementA, elementB, elementC], { cols: 2, gap: 16 });
```

The charts are tiled left to right, top to bottom into `cols` columns (rows
follow from the count). Every cell is sized to the largest chart and smaller
charts are centered within their cells, so mixed sizes stay aligned.

All the single-chart options apply — the filename is derived from the first
chart found — plus:

```js
exportChartsSVG(elements, {
  cols: 2, // required: number of grid columns
  gap: 16  // pixels between tiles, both axes (default 0)
});

await exportChartsPNG(elements, {
  // all of the stitch options, plus:
  scale: 3 // rasterization scale relative to the tiled grid's size (default 2)
});
```

Elements without a chart svg are skipped; the export returns `false` (PNG:
resolves `false`) only when none of the elements contain one.

## Lower-level helpers

```js
import { findChartSvg, getChartSvgText, getStitchedChartsSvgText } from '@mochart/export';

const svgElement = findChartSvg(element); // SVGSVGElement | null
const svgMarkup = getChartSvgText(element, { transparent: true }); // string | null
const gridMarkup = getStitchedChartsSvgText([elementA, elementB], { cols: 2 }); // string | null
```

`getChartSvgText` and `getStitchedChartsSvgText` return the standalone svg
markup without triggering a download — useful for tests or for piping the
markup elsewhere.

For TypeScript hosts, the option shapes are exported as `ExportSvgOptions`,
`ExportPngOptions`, `StitchOptions`, and `StitchPngOptions`.

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.
