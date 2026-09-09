// Loads the framework-props model emitted by scripts/generateBindings.ts
// (npm run gen). The model types live with the builder; only the loading side
// is here, so the VitePress config stays free of parsing code.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BindingReferenceModel } from '../../scripts/bindingReferenceModel.ts';

export type {
  BindingDoc,
  BindingGroupDoc,
  BindingReferenceModel
} from '../../scripts/bindingReferenceModel.ts';

export const bindingModelPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'generated', 'binding-reference.json'
);

export function loadBindingReference(): BindingReferenceModel {
  if (!fs.existsSync(bindingModelPath)) {
    throw new Error(
      'binding-reference.json not found at ' + bindingModelPath +
      ' — run "npm run gen -w @mochart/docs" first.'
    );
  }
  return JSON.parse(fs.readFileSync(bindingModelPath, 'utf-8')) as BindingReferenceModel;
}
