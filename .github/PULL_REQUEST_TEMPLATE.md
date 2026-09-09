## What this changes

<!-- A line or two, plus the issue it closes if there is one. -->

## Gates

CI runs these in this order and stops at the first failure
([CONTRIBUTING](https://github.com/mocharts/mochart/blob/main/CONTRIBUTING.md#getting-started)):

- [ ] `npm run lint`
- [ ] `npm run deadcode`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:e2e` (needs `npx playwright install chromium` once per
      machine)

## Whichever of these apply

- [ ] Config or chart-prop change: regenerated with
      `npm run generate-docs -w @mochart/core`,
      `npm run generate-jsdoc -w @mochart/core` and `npm run gen -w @mochart/docs`
      — the JSDoc on `src/types/config.ts` is generated, not hand-edited
- [ ] Golden snapshot diffs read like code, and every rendering change in them
      was intended
- [ ] A demo UI change landed in all six galleries, with the logic in
      `@mochart/demo-common` and the copy in its `demoText`
- [ ] A new public export or `ChartHandle` method is mentioned on a docs page
- [ ] A bumped package version was stamped with
      `npm run stamp-version -w @mochart/core`
- [ ] A config format change bumped `CONFIG_VERSION` and added a
      `src/config/migration/` step
