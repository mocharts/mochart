// Link preview tags for the site. The docs pages get these from the vitepress
// head config, which injects per-page; the galleries are separate vite builds
// with their own HTML shell, so socialTags() injects into theirs. Both read the
// card and the origin from here.
export const siteName = 'mochart';

export const card = {
  file: 'og-image.png',
  width: '1200',
  height: '630',
  alt: 'mochart: animated interactive SVG charts, beside a stacked bar chart drawn by the library'
};

// The develop deploy sets SITE_ORIGIN to dev.mochart.org; every other build is the live site.
export function resolveOrigin() {
  const fromEnv = process.env.SITE_ORIGIN;
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : 'https://mochart.org';
}

// scripts/og-image renders the card into the docs' public/, so it lands at the site root.
export function cardUrl(siteRoot: string) {
  return resolveOrigin() + siteRoot + card.file;
}

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
      // build-pages gives each gallery a <site root>/<slug>/ base.
      const siteRoot = base.replace(/[^/]+\/$/, '');
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      const tags = [
        meta({ name: 'description', content: description }),
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: siteName }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:image', content: cardUrl(siteRoot) }),
        meta({ property: 'og:image:width', content: card.width }),
        meta({ property: 'og:image:height', content: card.height }),
        meta({ property: 'og:image:alt', content: card.alt }),
        meta({ name: 'twitter:card', content: 'summary_large_image' })
      ];
      if (title !== undefined) {
        tags.push(meta({ property: 'og:title', content: title }));
      }
      // Only a site build names a sub-path; a standalone build has no public URL to point at.
      if (base !== '/') {
        tags.push(meta({ property: 'og:url', content: resolveOrigin() + base }));
      }
      return tags;
    }
  };
}
