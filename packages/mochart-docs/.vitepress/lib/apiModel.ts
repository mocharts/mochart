// Loads the api-reference model emitted by @mochart/core's generator (npm run
// gen in this package). Types mirror packages/mochart/scripts/apiReferenceModel.ts
// — kept local for the same reason as model.ts: the VitePress config and
// loaders should not pull core modules into their module graph.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ApiGroupLink {
  title: string;
  link: string;
}

export interface ApiPropertyDoc {
  key: string;
  type: string;
  optional: boolean;
  description: string;
  payloads: ApiGroupLink[];
}

export interface ApiGroupDoc {
  id: string;
  title: string;
  interfaceName: string;
  description: string;
  extendsGroups: ApiGroupLink[];
  properties: ApiPropertyDoc[];
}

export interface ApiPageDoc {
  id: string;
  title: string;
  lead: string;
  groups: ApiGroupDoc[];
}

export interface EnumerationUse {
  label: string;
  link: string;
}

export interface EnumerationDoc {
  name: string;
  description: string;
  values: string[];
  usedBy: EnumerationUse[];
}

export interface EnumerationsPageDoc {
  id: string;
  title: string;
  lead: string;
  entries: EnumerationDoc[];
}

export interface ApiReferenceModel {
  pages: ApiPageDoc[];
  enumerations: EnumerationsPageDoc;
}

export const apiModelPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'mochart', 'generated', 'api-reference.json'
);

export function loadApiReference(): ApiReferenceModel {
  if (!fs.existsSync(apiModelPath)) {
    throw new Error(
      'api-reference.json not found at ' + apiModelPath +
      ' — run "npm run gen -w @mochart/docs" (or generate-docs in @mochart/core) first.'
    );
  }
  return JSON.parse(fs.readFileSync(apiModelPath, 'utf-8')) as ApiReferenceModel;
}
