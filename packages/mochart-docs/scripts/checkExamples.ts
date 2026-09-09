// Validates every example config/dataset used by the docs pages with the same
// validators the library applies at runtime, so a broken example fails CI
// instead of rendering a config-error state on the site.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getDefaults,
  validateConfig,
  enhanceConfig,
  getDataErrors,
  ArrayOfObjectsDataProvider
} from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

type DataErrorsProvider = Parameters<typeof getDataErrors>[1];

interface ExampleModule {
  config: MochartInputConfig;
  data: Record<string, unknown>[];
  altData?: Record<string, unknown>[];
}

const examplesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const exampleFiles = fs.readdirSync(examplesDir).filter(file => file.endsWith('.ts')).sort();

let failures = 0;

function fail(name: string, messages: string[]) {
  failures++;
  console.error(`✗ ${name}`);
  for (const message of messages) {
    console.error(`    ${message}`);
  }
}

for (const file of exampleFiles) {
  const name = file.replace(/\.ts$/, '');
  const module = (await import(path.join(examplesDir, file))) as ExampleModule;
  if (module.config === undefined || module.data === undefined) {
    fail(name, ['example must export `config` and `data`']);
    continue;
  }

  const validation = validateConfig(module.config, getDefaults(module.config));
  if (!validation.valid || validation.warnings.length > 0) {
    fail(name, [
      ...validation.errors,
      ...validation.warnings.map(warning => `warning: ${warning}`)
    ]);
    continue;
  }

  const mochartConfig = enhanceConfig(module.config);
  const datasets: [string, Record<string, unknown>[]][] = [['data', module.data]];
  if (module.altData !== undefined) {
    datasets.push(['altData', module.altData]);
  }
  const dataMessages: string[] = [];
  for (const [label, dataset] of datasets) {
    const provider = new ArrayOfObjectsDataProvider(dataset);
    const dataErrors = getDataErrors(mochartConfig, provider as unknown as DataErrorsProvider);
    dataMessages.push(...dataErrors.map(error => `${label}: ${error}`));
  }
  if (dataMessages.length > 0) {
    fail(name, dataMessages);
    continue;
  }

  console.log(`✓ ${name}`);
}

if (failures > 0) {
  console.error(`\n${failures} example(s) failed validation`);
  process.exit(1);
}
console.log(`\nall ${exampleFiles.length} examples valid`);
