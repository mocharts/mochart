# Exporting images

The [@mochart/export](https://github.com/mocharts/mochart/tree/main/packages/mochart-export)
companion package downloads a rendered chart as a standalone SVG or PNG
file. The export captures everything inside the chart svg — title, plot,
axes, and legend, in their current state — with the chart's computed styles
inlined, so the image renders the same outside your page's stylesheets. The
export shows the chart as it is on screen, focus included: the crosshair and
axis focus marks stay unless you pass `showFocusElements: false`, and series
keep their focused or defocused styling either way. The HTML tooltip is never
included. Colors, sizes, and geometry travel with the file; fonts are the
exception, and [Web fonts](#web-fonts) explains what to do about that.

<script setup>
import * as basic from '../examples/basic'
</script>

<LiveChart :config="basic.config" :data="basic.data" :export-buttons="true" />

## Install

```sh
npm install @mochart/export @mochart/core
```

The package is framework-free, like the core library — the same functions
work with every [framework binding](/guide/frameworks/react).

## Downloading a chart

```js
import { exportSVG, exportPNG } from '@mochart/export';

exportSVG(element);
await exportPNG(element);
```

`element` can be the chart's container, the `div.mochart-chart` root itself,
or the chart `<svg>` — the functions find the chart svg from any of them.
With a framework binding, a ref to the element wrapping the chart component
works. The filename is derived from the chart title with whitespace replaced
by underscores (`Monthly Revenue` → `Monthly_Revenue.svg`), falling back to
`export`. `exportSVG` returns `false` (and `exportPNG` resolves `false`) when
no chart svg is found; otherwise they return `true` once the download has
started. The PNG functions can also reject, such as when the browser refuses a
canvas, cannot encode it, or will not rasterize the svg (the tainted-canvas
case under [Web fonts](#web-fonts)). Give them a `catch` as well as checking
the resolved value.

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

The PNG is rasterized through an offscreen canvas at `scale` times the
chart's on-screen pixel size — the default of `2` keeps exports crisp on
high-DPI displays.

### Dark pages

The chart's chrome (axis and legend text, grid lines, …) defaults to
following the host page via `currentColor`
(see [Colors, theming, and dark mode](/guide/theming)), and the export inlines
those resolved colors. The default background matches: with no
`backgroundColor` given, the export paints the effective page background
behind the chart (the nearest opaque ancestor background, with any
translucent ones in front of it composited onto it, and white when there is
none), so a chart on a dark page exports dark-on-dark instead of
light-on-white. Pass an explicit `backgroundColor` to override, or
export `transparent` and let the destination supply the background.

### Web fonts

The chart sets no font of its own, so its text uses whatever font your page
gives it, and the export inlines `font-family` as a *name* — no font data goes
into the file. A font installed on the machine still resolves by name; a web
font the page loaded over the network does not. For a PNG, the rasterizer
loads the svg as an image, and an svg loaded as an image cannot fetch anything
external, so the text falls back to the renderer's default font. For an SVG
file the same applies later, on whatever machine opens it: the named font
resolves only if that machine has it installed.

The result is more than a different typeface. Text is measured on screen with
the live font and written into the markup as coordinates, so the labels keep
the positions, alignment, and truncation that were computed for a font the
file no longer has.

Three ways to handle it:

1. **Render the chart in a font every machine has.** Give the chart text a
   system font stack in your own CSS:

   ```css
   .mochart-chart text { font-family: ui-sans-serif, system-ui, Arial, sans-serif; }
   ```

   Screen and export then agree, and there is nothing to pass to the export.
2. **Accept the substitution**, if the chart's typeface does not matter.
3. **Embed the font** by passing `@font-face` rules as `fontFaceCss`:

   ```js
   await exportPNG(element, {
     fontFaceCss: "@font-face { font-family: 'Inter'; src: url(data:font/woff2;base64,d09GMgAB…) format('woff2'); }"
   });
   ```

The string is injected verbatim into one `<style>` element in the exported
file — a stitched grid gets a single one that covers every tile. Producing it
is the host's job:

- The `src` must be **base64 data**, not a url. A url is an external fetch,
  which is what an image-loaded svg cannot do.
- The `font-family` name must match the family the chart text renders with,
  because that name is what the export inlines.
- Fetching and encoding the font file is yours to do. Only you know which file
  and weights to use, whether the font's license permits shipping it inside an
  exported image, and whether the font server allows reading the bytes with
  `fetch` — a third-party font CDN often does not, so a self-hosted font is
  simplest.
- One full woff2 weight adds tens to hundreds of kilobytes to every exported
  file. Subset it to the glyphs the chart uses.

## Multiple charts in one image

```js
import { exportChartsSVG, exportChartsPNG } from '@mochart/export';

// tile the charts found in the elements into a 2-column grid
exportChartsSVG([elementA, elementB, elementC], { cols: 2 });
await exportChartsPNG([elementA, elementB, elementC], { cols: 2, gap: 16 });
```

The charts are tiled left to right, top to bottom into `cols` columns (rows
follow from the count; `cols` larger than the chart count is capped to it).
Every cell is sized to the largest chart and smaller charts are centered
within their cells, so mixed sizes stay aligned. `gap` adds pixels between
tiles (default `0`). All the single-chart options apply, with the filename and
default background derived from the first chart found. Elements without a
chart svg are skipped; the export returns `false` only when none of the
elements contain one.

## Markup without a download

```js
import { findChartSvg, getChartSvgText, getStitchedChartsSvgText } from '@mochart/export';

const svgElement = findChartSvg(element); // SVGSVGElement | null
const svgMarkup = getChartSvgText(element, { transparent: true }); // string | null
const gridMarkup = getStitchedChartsSvgText([elementA, elementB], { cols: 2 }); // string | null
```

`getChartSvgText` and `getStitchedChartsSvgText` return the same standalone
svg markup the download functions produce — useful for tests, server-side
storage, or piping the markup into another tool.

For TypeScript hosts, the option shapes are exported as `ExportSvgOptions`,
`ExportPngOptions`, `StitchOptions`, and `StitchPngOptions`.

## Accessibility of the exported file

The export is a static image, so the live chart's tab stops and their
`role`, `aria-label`, `aria-expanded`, and `aria-pressed` attributes are
stripped. A chart with an accessible name (its title, or
[`accessibility.chartLabel`](/reference/accessibility#accessibility.chartLabel))
keeps that name on the root svg and is marked `role="img"`; a chart with
[`accessibility.enabled`](/reference/accessibility#accessibility.enabled)
`false` or [`hidden`](/reference/accessibility#accessibility.hidden) `true` has
no name to keep, so the export is marked `aria-hidden="true"` instead. See
[Exports](/guide/accessibility#exports) in the accessibility guide.

## Try it in the demos

Every [demo gallery](/vanilla/demos) has a share menu with these exports
wired up — including the tiled multi-chart export on the Multi tab.
