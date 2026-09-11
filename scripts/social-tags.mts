// Link previews for the deployed galleries: VitePress injects these tags into the
// docs pages itself, but each gallery is a separate vite build with its own shell.
const defaultOrigin = 'https://mochart.org';
const siteName = 'mochart';
const imageAlt = 'mochart: animated interactive SVG charts, beside a stacked bar chart drawn by the library';

type Tag = { tag: string; attrs: Record<string, string>; injectTo: 'head' };

const meta = (attrs: Record<string, string>): Tag => ({ tag: 'meta', attrs, injectTo: 'head' });

// Structurally typed, not `Plugin`: vitepress bundles vite 5 while the rest of the repo is on 8.
export function socialTags(description: string) {
  let base = '/';
  return {
    name: 'social-tags',
    configResolved(config: { base: string }) {
      base = config.base;
    },
    transformIndexHtml(html: string) {
      // The develop deploy sets SITE_ORIGIN to dev.mochart.org; every other build is the live site.
      const fromEnv = process.env.SITE_ORIGIN;
      const origin = fromEnv !== undefined && fromEnv !== '' ? fromEnv : defaultOrigin;
      // build-pages gives each gallery a <site root>/<slug>/ base, and the card sits at the site root.
      const siteRoot = base.replace(/[^/]+\/$/, '');
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      const tags = [
        meta({ name: 'description', content: description }),
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: siteName }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:image', content: origin + siteRoot + 'og-image.png' }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ property: 'og:image:alt', content: imageAlt }),
        meta({ name: 'twitter:card', content: 'summary_large_image' })
      ];
      if (title !== undefined) {
        tags.push(meta({ property: 'og:title', content: title }));
      }
      // Only a site build names a sub-path; a standalone build has no public URL to point at.
      if (base !== '/') {
        tags.push(meta({ property: 'og:url', content: origin + base }));
      }
      return tags;
    }
  };
}
