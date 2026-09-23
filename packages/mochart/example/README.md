# mochart examples

Static HTML examples that use mochart without any build tooling of their own.
They load the self-contained bundles from `../dist`, so build the library first:

```sh
npm run build -w @mochart/core
```

- **example.html**: classic `<script>` tag using `dist/mochart.iife.js` (global `mochart`).
  Works when opened directly from the filesystem (`file://`).
- **example-esm.html**: `<script type="module">` importing from `dist/mochart.js`,
  using the imperative `createChart` API. ES modules require HTTP, so serve the
  package directory, e.g.:

  ```sh
  npx serve packages/mochart
  # then open http://localhost:3000/example/example-esm.html
  ```
- **example-histogram.html**, **example-waterfall.html**, **example-sparkline.html**,
  **example-heatmap.html** — the `createHistogram`, `createWaterfall`,
  `createSparklineConfig` and `createHeatmap` helpers.
  Same setup as example-esm.html (serve over HTTP).
