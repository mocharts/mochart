// Links from the demo galleries into the documentation site's config
// reference. The deployed site nests each gallery beside the docs
// (<docsBase><slug>/, see scripts/build-pages.mjs), so the docs base is the
// gallery's router base path minus its slug segment. Under a dev server the
// links resolve to the site root and 404 — same trade-off as the docs site's
// links back to the demos.

const referenceSectionIds = [
  'accessibility',
  'animation',
  'chart',
  'colorPalette',
  'clipIndicator',
  'crosshair',
  'categoryAxis',
  'legend',
  'linearGradients',
  'patterns',
  'pie',
  'plot',
  'radialGradients',
  'valueAxes',
  'series',
  'seriesGroups',
  'seriesStacks',
  'title',
  'tooltip'
];

const allKeySectionMap: Record<string, string> = {
  linearGradientDefaults: 'linearGradients',
  patternDefaults: 'patterns',
  radialGradientDefaults: 'radialGradients',
  valueAxisDefaults: 'valueAxes',
  seriesDefaults: 'series',
  seriesGroupDefaults: 'seriesGroups',
  seriesStackDefaults: 'seriesStacks'
};

interface DemoWindowConfig {
  routerBasePath?: string;
}

function getRouterBasePath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  const config = (window as unknown as { __config?: DemoWindowConfig }).__config;
  return config?.routerBasePath ?? '/';
}

/** The documentation site's base path: the gallery base minus its slug. */
export function getDocsBaseUrl(basePath: string = getRouterBasePath()): string {
  const normalized = basePath.endsWith('/') ? basePath : basePath + '/';
  const match = normalized.match(/^(.*\/)[^/]+\/$/);
  return match !== null ? match[1]! : '/';
}

/**
 * The reference section ids a config actually uses (in reference order),
 * with `*Defaults` keys mapped onto their list section.
 */
export function getReferenceSectionIds(config: Record<string, unknown> | null | undefined): string[] {
  if (config === null || config === undefined) {
    return [];
  }
  const present = new Set<string>();
  for (const key of Object.keys(config)) {
    if (referenceSectionIds.includes(key)) {
      present.add(key);
    }
    else if (allKeySectionMap[key] !== undefined) {
      present.add(allKeySectionMap[key]!);
    }
  }
  return referenceSectionIds.filter(id => present.has(id));
}

/** URL of one section's page in the generated config reference. */
export function getReferenceSectionUrl(sectionId: string, basePath?: string): string {
  return getDocsBaseUrl(basePath) + 'reference/' + sectionId;
}
