# Security policy

## Reporting a vulnerability

Report privately, never as a public issue:
[open a draft security advisory](https://github.com/mocharts/mochart/security/advisories/new).
That form only exists once **Settings > Code security > Private vulnerability
reporting** is enabled on the repository — enable it before the repo goes
public, or the first report has nowhere private to land.

Useful reports name the affected package and version, and include the config
and data that trigger the problem. Every published package is driven by a
config object and rows of data, so a config that reproduces it is the whole
repro.

Expect an acknowledgement within a week. A confirmed issue is fixed in a patch
release of the affected package and the advisory is published alongside it,
crediting the reporter unless they would rather not be named.

## Supported versions

The nine published packages release from this repo together — `@mochart/core`,
`@mochart/movalid`, `@mochart/editor`, `@mochart/export`, and the five
framework bindings (`@mochart/react`, `@mochart/svelte`, `@mochart/vue`,
`@mochart/lit`, `@mochart/angular`). Only the latest version of each is
supported; there are no maintenance branches.

## Scope

In scope: anything in those nine packages that turns caller config or data into
something it should not be — script execution, escaping the chart's container,
or reaching outside the page — whether through the rendered DOM or an exported
SVG or PNG.

Out of scope: the demo galleries and the documentation site, which are deployed
as illustrations rather than products, and advisories against development-only
dependencies, which the scheduled [audit
workflow](.github/workflows/audit.yml) reports without failing.
