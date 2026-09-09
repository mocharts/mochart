# @mochart/demo-angular

Angular demo gallery for [@mochart/core](../mochart/README.md), built on
[@mochart/angular](../mochart-angular/README.md) (private, not published).

See it running live at [mochart.org/angular/demos](https://mochart.org/angular/demos).

The full-featured demo app: browse every demo chart in three modes —
single edits one chart's config and data as JSON, multi steps a
configurable grid of charts through dataset sizes together, and random
generates whole seeded random datasets — plus the transition, rotation,
and sparkline showcases. The JSON demo
configs and datasets are shared from
[@mochart/demo-data](../mochart-demo-data/README.md); [@mochart/demo-basic](../mochart-demo-basic/README.md)
is a smaller no-framework harness of the same demos that hosts the e2e suite.

It is a plain Vite app like the other galleries — `@analogjs/vite-plugin-angular`
provides the Angular AOT compilation, routing comes from `@angular/router`,
and change detection is zoneless.

## Install

This repo uses npm workspaces; install once from the repo root:

```sh
npm install
```

## Run

From the repo root:

```sh
npm run dev -w @mochart/demo-angular       # vite dev server on http://localhost:5180
npm run build -w @mochart/demo-angular     # production build to dist/
npm run preview -w @mochart/demo-angular   # preview the production build on http://localhost:4180
```

Or run the same scripts with `npm run dev` etc. from this directory.
