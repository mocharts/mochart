# Releasing

How the nine public `@mochart/*` packages get to npm. Versioning and changelogs
are handled by [Changesets](https://github.com/changesets/changesets); publishing
runs in GitHub Actions ([`ci.yml`](.github/workflows/ci.yml), `release-*` jobs)
via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers), so no
npm token exists anywhere.

## Overview

- **Published packages** (everything under `packages/` that is not `private`):
  `@mochart/movalid`, `@mochart/core`, `@mochart/editor`, `@mochart/export`,
  `@mochart/react`, `@mochart/svelte`, `@mochart/vue`, `@mochart/lit`,
  `@mochart/angular`.
- **Fixed versioning**: all nine share one version number
  ([`.changeset/config.json`](.changeset/config.json) `fixed` group). A release
  bumps and republishes all of them, and rewrites the internal `^` ranges
  (including the bindings' `@mochart/core` peer range) to the new version.
- **Publishing goes through pnpm**, never `npm publish` or `changeset publish`:
  pnpm swaps in each package's `publishConfig.exports` at pack time, which
  strips the monorepo-only `development` export condition. `npm run
  check:publish` guards this and `scripts/publish-libs.mjs` does the
  publishing. Both `changeset publish` and `changeset pack` would use `npm`
  in this npm-workspaces repo, so they are not used.
- **Tags** are per package (`@mochart/core@1.2.0`, …), created by
  `changeset git-tag`; the action turns them into one GitHub Release per
  package with that package's changelog section as the body.

## Making a change that should appear in the release notes

```sh
npx changeset
```

Pick any one of the fixed-group packages (they all move together), choose the
bump (`patch` / `minor` / `major`), and write a one-line summary. Commit the
generated `.changeset/*.md` with the code. Changes without a changeset still
ship in the next release; they just get no line in the changelog.

For a fix that only touches one binding, name that binding; its changelog gets
the line and the others get "Updated dependencies".

## Cutting a release

1. Push (or merge) to `main`. Once the CI matrix is green the `release-mode`
   job runs `changesets/action/select-mode`, and when changesets are pending
   the `release-version` job opens or refreshes a **"Version Packages"** PR
   containing the bumps, changelog entries, `packages/mochart/src/version.ts`
   stamp and lockfile refresh (`npm run release:version`).
2. Review and merge that PR. GitHub does not run CI on the PR itself (it is
   opened with the workflow token), which is fine: the merge commit runs the
   full matrix before anything is published.
3. On the merge push, `release-mode` reports `publish` (a version is not on the
   registry yet) and `release-publish` runs `npm run release:publish`:
   `check:publish` → `publish-libs.mjs` (in dependency order, skipping versions
   already on npm, so a re-run resumes where it stopped) → `changeset git-tag`.
   The action then pushes the tags and creates the GitHub Releases.

The whole `release-*` chain is gated behind the repository variable
`ENABLE_NPM_RELEASE=true` (Settings → Secrets and variables → Actions →
Variables). Delete or change the variable to pause releases.

Repository setting required once: Settings → Actions → General → **Allow GitHub
Actions to create and approve pull requests**.

### If the publish job fails

- **`check:publish` failed** — a package's `publishConfig.exports` drifted from
  its `exports`; fix the manifest.
- **`stampVersion: src/version.ts is out of date`** — the version PR was edited
  by hand after generation; run `npm run stamp-version -w @mochart/core`.
- **npm 403 / OIDC error** — the trusted publisher on npmjs.com for that
  package must be `mocharts/mochart`, workflow `ci.yml`, no environment, with
  `npm publish` in its allowed actions. Also
  the job needs npm ≥ 11.5 (the job prints `npm --version`; Node 24 bundles a
  compatible one).
- **A package published, the rest did not** — just re-run the job; published
  versions are skipped and tags are created only where missing.

## Dry run

The **Release dry run** workflow (`workflow_dispatch`, [`release-dry-run.yml`](.github/workflows/release-dry-run.yml))
packs all nine packages the way publishing would, checks each tarball
(dist-only exports, README/LICENSE/CHANGELOG present, every exported path in
the tarball) and installs them into a scratch project to import each one under
Node. The tarballs are uploaded as the `release-tarballs` artifact for
installing into a real project. Locally:

```sh
npm run pack:libs -- --smoke     # tarballs land in pack/
node scripts/publish-libs.mjs --dry-run   # full pnpm publish --dry-run per package
```

## Pre-releases

```sh
npx changeset pre enter next     # subsequent versions are 1.1.0-next.0, … on the `next` dist-tag
npx changeset pre exit
```

`publish-libs.mjs` reads `.changeset/pre.json` and passes the tag to
`pnpm publish --tag`. Merge the pre-mode toggle like any other change; the
Version Packages PR follows.

## Adding a new published package

A package that is not on npm yet cannot be trusted-published, so its first
version is a manual publish (`npm run publish:libs` after adding it to
`scripts/publish-libs.mjs`, `scripts/pack-libs.mjs`, `build:libs`, and the
`fixed` group in `.changeset/config.json`; the publish authenticates with the
account's 2FA in the browser). Then register the trusted publisher for it on
npmjs.com: package Settings → Trusted Publisher → GitHub Actions, owner
`mocharts`, repository `mochart`, workflow filename `ci.yml`, environment
blank, with `npm publish` in the allowed actions. It also needs `publishConfig.exports`,
`repository.directory`, `files` including `CHANGELOG.md`, and a `CHANGELOG.md`
starting with `# <package name>`.
