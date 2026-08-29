// Checks that the usage-index section registries cover every config section
// the core enhancer emits, so a new section can't silently lose its "Used in"
// links (the drift CONTRIBUTING.md's "Adding a new config section" list warns
// about). Object/list classification and the *Defaults companion map are
// verified against core's `sectionKeyAllMap`. Also checks that every example
// config on the docs site is registered, so a new example page contributes
// its links instead of silently contributing nothing.
// Usage: tsx --conditions=development scripts/checkSectionCoverage.ts

import { enhanceConfig, sectionKeyAllMap } from '@mochart/core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectSectionIds, listSectionIds, allKeySectionMap, registeredExampleConfigs } from '../.vitepress/lib/usageIndex';

const enhanced = enhanceConfig({
  version: '1.0.0',
  categoryAxis: { property: 'x', type: 'string', scale: 'ordinal' },
  series: [{ property: 'y' }]
}) as unknown as Record<string, unknown>;

// top-level enhanced keys that are not config sections
const nonSectionKeys = new Set(['version', 'validation']);
const sectionIds = Object.keys(enhanced).filter((key) => !nonSectionKeys.has(key) && !key.endsWith('ById'));

const problems: string[] = [];

for (const sectionId of sectionIds) {
  const isList = sectionKeyAllMap[sectionId] !== undefined;
  const expected = isList ? listSectionIds : objectSectionIds;
  const other = isList ? objectSectionIds : listSectionIds;
  if (!expected.has(sectionId)) {
    problems.push(`${sectionId} — missing from ${isList ? 'listSectionIds' : 'objectSectionIds'}`);
  }
  if (other.has(sectionId)) {
    problems.push(`${sectionId} — in ${isList ? 'objectSectionIds' : 'listSectionIds'} but is a ${isList ? 'list' : 'object'} section`);
  }
}

for (const id of [...objectSectionIds, ...listSectionIds]) {
  if (!sectionIds.includes(id)) {
    problems.push(`${id} — registered but the enhancer emits no such section`);
  }
}

for (const [sectionId, defaultsKey] of Object.entries(sectionKeyAllMap)) {
  if (allKeySectionMap[defaultsKey] !== sectionId) {
    problems.push(`${defaultsKey} — allKeySectionMap maps it to ${allKeySectionMap[defaultsKey] ?? 'nothing'}, expected ${sectionId}`);
  }
}
for (const defaultsKey of Object.keys(allKeySectionMap)) {
  if (Object.values(sectionKeyAllMap).indexOf(defaultsKey) === -1) {
    problems.push(`${defaultsKey} — in allKeySectionMap but core has no such *Defaults key`);
  }
}

const examplesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const exampleFiles = fs.readdirSync(examplesDir).filter((file) => file.endsWith('.ts')).sort();
const registered = new Set<object>(registeredExampleConfigs);
let exampleCount = 0;
for (const file of exampleFiles) {
  const exported = (await import(path.join(examplesDir, file))) as { config?: object };
  if (exported.config === undefined) {
    continue;
  }
  exampleCount++;
  if (!registered.has(exported.config)) {
    problems.push(`examples/${file} — exports a config but is not in docsExamples, so its properties get no "Used in" link`);
  }
}

if (problems.length > 0) {
  console.error('✗ usage-index registries are out of sync:\n');
  for (const problem of problems) {
    console.error(`    ${problem}`);
  }
  process.exit(1);
}

console.log(`✓ usage index covers all ${sectionIds.length} config sections and all ${exampleCount} example configs`);
