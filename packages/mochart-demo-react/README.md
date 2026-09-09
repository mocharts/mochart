# @mochart/demo-react

React demo gallery for [@mochart/core](../mochart/README.md), built on
[@mochart/react](../mochart-react/README.md) (private, not published).

See it running live at [mochart.org/react/demos](https://mochart.org/react/demos).

The full-featured demo app: browse every demo chart in three modes —
single edits one chart's config and data as JSON, multi steps a
configurable grid of charts through dataset sizes together, and random
generates whole seeded random datasets — plus the transition, rotation,
and sparkline showcases. The JSON demo
configs and datasets are shared from
[@mochart/demo-data](../mochart-demo-data/README.md); [@mochart/demo-basic](../mochart-demo-basic/README.md)
is a smaller no-framework harness of the same demos that hosts the e2e suite.

## Install

This repo uses npm workspaces; install once from the repo root:

```sh
npm install
```

## Run

From the repo root:

```sh
npm run dev -w @mochart/demo-react       # vite dev server on http://localhost:5174
npm run build -w @mochart/demo-react     # production build to dist/
npm run preview -w @mochart/demo-react   # preview the production build on http://localhost:4174
```

Or run the same scripts with `npm run dev` etc. from this directory.
