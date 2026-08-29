// Flat ESLint config for the whole monorepo — one config, 20 workspaces.
//
// Scope, deliberately: this catches BUGS, not style. There are no formatting
// rules (indent/quotes/semi/spacing) because the repo already has a consistent
// hand-maintained style, and turning a formatter on retroactively would bury
// every real finding under thousands of whitespace diffs. If we ever want
// formatting enforced, that is a separate decision and probably a separate tool.
//
// Type-aware rules (the `no-floating-promises` family) run on plain .ts/.tsx
// only. Svelte and Vue files get their framework plugin's syntactic rules but
// not type-aware ones: wiring the project service through `.svelte`/`.vue`
// needs per-package `extraFileExtensions` and is slow, and `svelte-check` /
// `vue-tsc` in `npm run typecheck` already cover those files' types.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import vue from 'eslint-plugin-vue';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    // Build output, caches and generated code. Everything here is either
    // gitignored or machine-written; linting it reports on code nobody edits.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/generated/**',
      '**/coverage/**',
      '**/.svelte-kit/**',
      '**/.vitepress/cache/**',
      '**/.vitepress/dist/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'site/**',
      'scripts/screenshots/refs/**'
    ]
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // Type-aware rules for plain TypeScript. `projectService` picks each
  // package's own tsconfig automatically, which is what makes one root config
  // work across 20 workspaces with different compiler settings.
  //
  // Note this does NOT extend `recommendedTypeChecked`: that set is dominated
  // by the `no-unsafe-*` family, which fires on every value flowing out of an
  // `any`. This repo parses untrusted JSON in the config editors and the
  // validator, so those rules produced ~990 findings that all restate one fact
  // we already know. The individually-listed rules below are the ones that
  // find bugs rather than describe the type system.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    // The 18 vite/vitest/playwright configs sit outside their own package's
    // tsconfig `include`, so the project service cannot type them. They still
    // get the syntactic rules, and a dropped await in a build config fails the
    // build loudly rather than silently.
    ignores: ['**/*.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // A dropped await on a rejected promise is an unhandled rejection that
      // surfaces far from its cause. The highest-value rule in the config.
      '@typescript-eslint/no-floating-promises': 'error',
      // An async callback passed where a void one is expected — the same bug
      // wearing a different hat (e.g. an async event handler nobody awaits).
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Both OFF after triaging every one of their 32 findings: all sit on
      // deliberate coercion of a genuinely-unknown value, and none could
      // produce the bug the rule describes. The config editors and the
      // validator stringify values parsed from user JSON, where `unknown` is
      // the honest type and `String(x)` is the intended narrowing; the rules
      // also flag `"" + pathGenerator`, which is d3's own documented way to
      // read a path generator's output.
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      // Kept ON: its 3 findings in the demos were a real type-honesty problem
      // (a hook declaring `close(): void` for what is actually a `this`-less
      // arrow), fixed at the declaration. The test-only exception is below.
      '@typescript-eslint/unbound-method': 'error'
    }
  },

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // tsc's noUnusedLocals misses several of these cases (caught errors,
      // rest-sibling omits), and most packages don't enable it at all.
      // `_`-prefixed names are the documented escape hatch.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      // `any` is deliberate where it appears: JSON parsed from the config
      // editors, and DOM event payloads narrowed by hand. 362 findings that
      // are all the same known decision is not a signal.
      '@typescript-eslint/no-explicit-any': 'off',
      // The demos log to the console on purpose — invalid config warnings are
      // part of what they demonstrate.
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // `destructuring: 'all'` (rather than the default 'any') only complains
      // when EVERY binding in a pattern could be const. With 'any', a
      // `let { x, y, height } = bounds` where x and y are later reassigned can
      // only be satisfied by splitting one destructure into two statements,
      // which is worse code than the thing being reported.
      'prefer-const': ['error', { destructuring: 'all' }],
      // OFF: all 17 findings are the "declare, then overwrite before reading"
      // idiom in core (e.g. Chart.ts's tooltip state destructure). Redundant,
      // never wrong, and unpicking them means refactoring chart logic that the
      // golden-snapshot tests pin. Worth revisiting as its own cleanup.
      'no-useless-assignment': 'off'
    }
  },

  // React — the hooks rules catch genuine bugs (conditional hooks, stale
  // closures in deps) that no type checker sees.
  {
    files: ['packages/mochart-react/**/*.{ts,tsx}', 'packages/mochart-demo-react/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      // Off because it is wrong here, not because it is inconvenient. ~100 of
      // its 102 findings were `ref={menu.triggerRef}` — handing a ref object to
      // the `ref` prop, which is the entire purpose of a ref. The rule treats
      // any property read off a custom hook's returned object as a ref *access*
      // during render, and `useMenu()` returns its refs bundled in one object.
      // The two genuine hits were the documented "latest value" and
      // "derive-from-prop-change" patterns, both sanctioned by the React docs.
      'react-hooks/refs': 'off',
      // OFF for now, but unlike `refs` these 5 findings are worth revisiting.
      // They are real "reset state when a prop/tab changes" effects — the
      // pattern React would rather see done during render. Rewriting them is a
      // behavioural refactor of components the screenshot gate pins, so it
      // belongs in its own pass, not in a lint rollout.
      'react-hooks/set-state-in-effect': 'off'
    }
  },

  // Svelte 5 (runes). The plugin's own parser handles `.svelte`; the TS parser
  // is delegated to for `<script lang="ts">` blocks.
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    extends: [svelte.configs.recommended],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    },
    rules: {
      // Core `prefer-const` is actively WRONG on runes: `$props()`, `$state()`
      // and `$derived()` must be declared with `let`, because the compiler
      // reassigns them to propagate reactivity. `const` would break the
      // component. The plugin's replacement understands runes and still
      // catches the ordinary cases.
      'prefer-const': 'off',
      'svelte/prefer-const': ['error', { destructuring: 'all' }],
      // OFF, and this one was measured rather than assumed: deleting a single
      // flagged `svelte-ignore state_referenced_locally` and re-running
      // svelte-check produced a real compiler warning at that exact position.
      // The directives are load-bearing; ESLint simply cannot reproduce the
      // compiler's analysis, so every finding here is a false positive.
      'svelte/no-unused-svelte-ignore': 'off',
      // `{' · '}` is a deliberate string literal, not a useless mustache — it
      // pins the exact spacing that raw template text would collapse, and the
      // demos are gated on pixel-identical rendering.
      'svelte/no-useless-mustaches': 'off',
      // Wants `SvelteMap` from svelte/reactivity. The one flagged Map is an
      // internal slot registry in a non-reactive adapter; making it reactive
      // would be cargo-culting the rule.
      'svelte/prefer-svelte-reactivity': 'off'
    }
  },

  // Vue 3 SFCs, script-setup. `flat/essential` is the error-prevention tier;
  // the `flat/recommended` tier above it is almost entirely template
  // formatting (attribute-per-line, bracket placement) and contributed 715
  // warnings about whitespace, which is out of scope per the note at the top.
  {
    files: ['**/*.vue'],
    extends: [vue.configs['flat/essential']],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    },
    rules: {
      // The demos deliberately use single-word component names that mirror the
      // other five ports (ChartTab, DataTab) — renaming them for the linter
      // would break the cross-port symmetry the screenshot gate depends on.
      'vue/multi-word-component-names': 'off'
    }
  },

  // Plain JS and .mjs build scripts get no TS rules.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },

  // Tests: vitest globals, and assertions legitimately produce expressions
  // that look unused.
  {
    files: ['**/test/**', '**/*.test.ts', '**/*.spec.ts', '**/e2e/**'],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // `expect(obj.method).toBeInstanceOf(Function)` is an assertion ABOUT the
      // method reference, so detaching it from its receiver is the point.
      '@typescript-eslint/unbound-method': 'off'
    }
  }
);
