// Writes the framework-props model the docs site renders, from the binding
// packages' prop declarations plus the core api-reference model. Exits
// non-zero when the two are out of sync (see bindingReferenceModel.ts for
// what counts as drift), so the docs build and `npm test` catch it. A failing
// run writes nothing, leaving the previous model in place.
//
// Usage: tsx scripts/generateBindings.ts [outputPath]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBindingReference, type CoreApiModel } from './bindingReferenceModel';

const docsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreApiModelPath = path.join(docsDir, '..', 'mochart', 'generated', 'api-reference.json');
const outputPath = process.argv[2] ?? path.join(docsDir, 'generated', 'binding-reference.json');

if (!fs.existsSync(coreApiModelPath)) {
  console.error(`✗ ${coreApiModelPath} not found — run the core generator first`);
  process.exit(1);
}

const coreModel = JSON.parse(fs.readFileSync(coreApiModelPath, 'utf-8')) as CoreApiModel;

// checked before anything is written: a failing run must leave the previous artifact in place
const { model, integrityErrors } = buildBindingReference(coreModel);

if (integrityErrors.length > 0) {
  console.error('framework binding props are out of sync with the core props:');
  for (const error of integrityErrors) {
    console.error('  - ' + error);
  }
  // nothing is written on failure, so name what the docs build is left with
  console.error(fs.existsSync(outputPath)
    ? `✗ nothing written — ${outputPath} still holds the previous model`
    : `✗ nothing written — ${outputPath} does not exist yet, so the docs build has no model to render`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(model, null, 2) + '\n');

const propCount = model.bindings.reduce(
  (total, binding) => total + binding.groups.reduce((sum, group) => sum + group.properties.length, 0),
  0
);
console.log(`✓ ${propCount} props across ${model.bindings.length} bindings documented`);
