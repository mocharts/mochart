// Assembles the GitHub Pages site in site/: builds the @mochart/docs
// VitePress site as the site root, builds every demo gallery with a sub-path
// base and copies each dist into site/<slug>/, then injects the demo
// deep-link redirect into the docs' 404.html (GitHub Pages has no rewrites,
// so 404.html stashes the requested URL in sessionStorage and redirects to
// the demo's index.html, which restores it; non-demo paths keep the docs 404).
//
// Usage: node scripts/build-pages.mjs
// The base path defaults to /mochart/ and can be overridden with PAGES_BASE.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLibsFresh } from './ensure-libs-fresh.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const siteDir = join(rootDir, 'site');

ensureLibsFresh();

const rawBase = process.env.PAGES_BASE !== undefined ? process.env.PAGES_BASE : '/mochart/';
const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';

const demos = [
  { slug: 'angular', pkg: '@mochart/demo-angular', title: 'Angular', detail: 'angular router, zoneless', historyRouting: true },
  { slug: 'lit', pkg: '@mochart/demo-lit', title: 'Lit', detail: 'lit-html directive router', historyRouting: true },
  { slug: 'react', pkg: '@mochart/demo-react', title: 'React', detail: 'react-router 7', historyRouting: true },
  { slug: 'svelte', pkg: '@mochart/demo-svelte', title: 'Svelte', detail: 'svelte 5 runes router', historyRouting: true },
  { slug: 'vanilla', pkg: '@mochart/demo-vanilla', title: 'Vanilla TypeScript', detail: 'no framework, history router', historyRouting: true },
  { slug: 'vue', pkg: '@mochart/demo-vue', title: 'Vue', detail: 'vue reactivity router', historyRouting: true }
];

function demoRedirectScript() {
  const historySlugs = demos.filter((demo) => demo.historyRouting).map((demo) => demo.slug);
  return `<script>
    // Deep link into a history-routed demo: stash the requested URL and load
    // the demo's index.html, which restores it via history.replaceState.
    // Non-demo paths fall through to the docs site's own 404 page.
    (function () {
      var base = ${JSON.stringify(base)};
      var historyDemos = ${JSON.stringify(historySlugs)};
      var path = location.pathname;
      if (path.indexOf(base) === 0) {
        var slug = path.slice(base.length).split('/')[0];
        if (historyDemos.indexOf(slug) !== -1) {
          sessionStorage.setItem('mochart:redirect', path + location.search + location.hash);
          location.replace(base + slug + '/');
        }
      }
    })();
  </script>`;
}

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir);

// The docs site is the site root; its config reads PAGES_BASE itself.
execSync('npm run build -w @mochart/docs', {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PAGES_BASE: base }
});
cpSync(join(rootDir, 'packages', 'mochart-docs', '.vitepress', 'dist'), siteDir, { recursive: true });

for (const demo of demos) {
  // Package directories keep the unscoped mochart-* names.
  const pkgDir = demo.pkg.replace('@mochart/', 'mochart-');
  // VITE_SITE_ROOT tells each demo where the docs site root lives so it can
  // render a "back to the Mochart site" link; standalone builds leave it unset
  // and the link is not rendered.
  execSync(`npm run build -w ${demo.pkg} -- --base=${base}${demo.slug}/`, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, VITE_SITE_ROOT: base }
  });
  cpSync(join(rootDir, 'packages', pkgDir, 'dist'), join(siteDir, demo.slug), { recursive: true });
}

// Cloudflare Pages honors _redirects with 200 rewrites, so deep links into the
// history-routed demos get real 200 responses there. GitHub Pages ignores the
// file and falls back to the 404.html script injected below.
function redirectsFile() {
  return demos.filter((demo) => demo.historyRouting)
    .map((demo) => `${base}${demo.slug}/* ${base}${demo.slug}/index.html 200`)
    .join('\n') + '\n';
}

const notFoundPath = join(siteDir, '404.html');
const notFoundHtml = readFileSync(notFoundPath, 'utf8');
if (!notFoundHtml.includes('</head>')) {
  throw new Error('docs 404.html has no </head> to inject the demo redirect into');
}
writeFileSync(notFoundPath, notFoundHtml.replace('</head>', demoRedirectScript() + '</head>'));

writeFileSync(join(siteDir, '_redirects'), redirectsFile());
// Without this GitHub Pages runs the site through Jekyll, which drops files.
writeFileSync(join(siteDir, '.nojekyll'), '');

console.log(`site assembled in site/ with base ${base}`);
