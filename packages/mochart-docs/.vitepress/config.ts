import { defineConfig } from 'vitepress';
import { loadConfigReference } from './lib/model';
import { loadApiReference } from './lib/apiModel';
import { depSourcemaps } from '../../../scripts/dep-sourcemaps';
import { FRAMEWORK_PROPS_PAGE } from '../reference/[section].paths';

// The deployed site nests the demo galleries next to the docs (see
// scripts/build-pages.mjs), so demo links resolve only on the assembled site,
// not under `vitepress dev`.
const rawBase = process.env.PAGES_BASE !== undefined ? process.env.PAGES_BASE : '/';
const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';

const demoLinks = [
  { text: 'Vanilla TypeScript', link: '/vanilla/', target: '_self' },
  { text: 'Angular', link: '/angular/', target: '_self' },
  { text: 'Lit', link: '/lit/', target: '_self' },
  { text: 'React', link: '/react/', target: '_self' },
  { text: 'Svelte', link: '/svelte/', target: '_self' },
  { text: 'Vue', link: '/vue/', target: '_self' }
];

// Markdown links into the demo galleries leave the VitePress site, so they
// need the same treatment as the demoLinks nav entries: target="_self" keeps
// the SPA router from intercepting the click (and 404ing), and because a
// target attribute makes VitePress skip its own href rewriting (.html suffix,
// base prefix), the base is prepended here instead.
const demoLinkPattern = /^\/(angular|lit|react|svelte|vanilla|vue)\//;

function demoLinkTargets(md: import('vitepress').MarkdownRenderer): void {
  const fallback = md.renderer.rules.link_open
    ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token?.attrGet('href');
    if (token !== undefined && typeof href === 'string' && demoLinkPattern.test(href)) {
      token.attrSet('href', (base + href).replace(/\/{2,}/g, '/'));
      token.attrSet('target', '_self');
      return self.renderToken(tokens, idx, options);
    }
    return fallback(tokens, idx, options, env, self);
  };
}

const referenceItems = loadConfigReference().sections.map(section => ({
  text: section.title,
  link: '/reference/' + section.id
}));

const apiReference = loadApiReference();
const apiItems = [
  ...apiReference.pages.map(page => ({
    text: page.title,
    link: '/reference/' + page.id
  })),
  { text: 'Framework props', link: '/reference/' + FRAMEWORK_PROPS_PAGE }
];

export default defineConfig({
  base,
  title: 'mochart',
  description: 'Animated interactive SVG charting library with zero framework dependencies',
  srcExclude: ['README.md'],
  // inline SVG favicon, the same mark the demo galleries use: the site ships no /favicon.ico
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%233e63dd'/%3E%3Crect x='3' y='9' width='2.5' height='4' fill='%23fff'/%3E%3Crect x='6.75' y='6' width='2.5' height='7' fill='%23fff'/%3E%3Crect x='10.5' y='3' width='2.5' height='10' fill='%23fff'/%3E%3C/svg%3E" }]],
  markdown: { config: demoLinkTargets },
  vite: {
    build: {
      sourcemap: true,
      rollupOptions: {
        // vitepress transforms every .md/.vue without a map; nobody source-maps markdown
        onwarn(warning, warn) {
          if (warning.code === 'SOURCEMAP_BROKEN' && warning.plugin === 'vitepress') {
            return;
          }
          warn(warning);
        }
      }
    },
    plugins: [depSourcemaps()]
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '^/(guide|recipes)/' },
      { text: 'Reference', link: '/reference/', activeMatch: '^/reference/' },
      { text: 'Demos', items: demoLinks }
    ],
    sidebar: {
      '/guide/': guideSidebar(),
      '/recipes/': guideSidebar(),
      '/reference/': [
        { text: 'Overview', link: '/reference/' },
        { text: 'API', link: '/reference/api' },
        { text: apiReference.enumerations.title, link: '/reference/' + apiReference.enumerations.id },
        { text: 'Props and callbacks', items: apiItems },
        { text: 'Config sections', items: referenceItems }
      ]
    },
    outline: { level: [2, 3] },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mocharts/mochart' }
    ],
    footer: {
      message: 'Released under the MIT License.'
    }
  }
});

function guideSidebar() {
  return [
    {
      text: 'Guide',
      items: [
        { text: 'Getting started', link: '/guide/getting-started' },
        { text: 'The config model', link: '/guide/config-model' },
        { text: 'Data providers', link: '/guide/data-providers' },
        { text: 'Staged animation', link: '/guide/staged-animation' },
        { text: 'Interaction', link: '/guide/interaction' },
        { text: 'Accessibility', link: '/guide/accessibility' },
        { text: 'Chart states', link: '/guide/chart-states' },
        { text: 'Colors, theming, and dark mode', link: '/guide/theming' },
        { text: 'Exporting images', link: '/guide/export' },
        { text: 'Editing config JSON', link: '/guide/editor' }
      ]
    },
    {
      text: 'Frameworks',
      items: [
        { text: 'Angular', link: '/guide/frameworks/angular' },
        { text: 'Lit', link: '/guide/frameworks/lit' },
        { text: 'React', link: '/guide/frameworks/react' },
        { text: 'Svelte', link: '/guide/frameworks/svelte' },
        { text: 'Vue', link: '/guide/frameworks/vue' }
      ]
    },
    {
      text: 'Recipes',
      items: [
        { text: 'Stacked bars', link: '/recipes/stacked-bars' },
        { text: 'Grouped series', link: '/recipes/grouped-series' },
        { text: 'Dual value axes', link: '/recipes/dual-axes' },
        { text: 'Date axis', link: '/recipes/date-axis' },
        { text: 'Axis bounds', link: '/recipes/axis-bounds' },
        { text: 'Horizontal charts', link: '/recipes/horizontal-bars' },
        { text: 'Positive and negative values', link: '/recipes/positive-negative' },
        { text: 'Thresholds and ranges', link: '/recipes/thresholds-ranges' },
        { text: 'Gradients', link: '/recipes/gradients' },
        { text: 'Patterns', link: '/recipes/patterns' },
        { text: 'Color by value', link: '/recipes/color-by-value' },
        { text: 'Bar caps', link: '/recipes/bar-caps' },
        { text: 'Curves', link: '/recipes/curves' },
        { text: 'Markers and labels', link: '/recipes/markers-labels' },
        { text: 'Tooltip formatting', link: '/recipes/tooltip-formatting' },
        { text: 'Histogram', link: '/recipes/histogram' },
        { text: 'Waterfall', link: '/recipes/waterfall' },
        { text: 'Sparklines', link: '/recipes/sparklines' },
        { text: 'Heatmap', link: '/recipes/heatmap' },
        { text: 'Candlestick', link: '/recipes/candlestick' },
        { text: 'OHLC bars', link: '/recipes/ohlc' },
        { text: 'Error bars', link: '/recipes/error-bars' },
        { text: 'Pie and donut', link: '/recipes/pie' }
      ]
    }
  ];
}
