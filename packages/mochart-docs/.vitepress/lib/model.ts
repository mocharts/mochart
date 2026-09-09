// Loads the config-reference model emitted by @mochart/core's generator
// (npm run gen in this package). Types mirror
// packages/mochart/scripts/configReferenceModel.ts — kept local so the
// VitePress config and loaders don't pull the core config modules into their
// module graph.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DefaultValue =
  | { kind: 'color'; color: string }
  | { kind: 'colors'; colors: string[] }
  | { kind: 'literal'; text: string }
  | { kind: 'none' };

export interface ConditionalDefaultValue {
  value: DefaultValue;
  condition: string;
}

/** `lead` names the shape, `keys` its members, `tail` whatever the rule allows besides it. */
export interface ShapeRuleDoc {
  lead: string;
  keys: string[];
  tail?: string;
}

export interface PropertyDoc {
  key: string;
  description: string;
  details?: string;
  rules: string[];
  /** The shape rule without its members' own rules, for the members documented below it. */
  shapeRule?: ShapeRuleDoc;
  default?: DefaultValue;
  conditionalDefaults?: ConditionalDefaultValue[];
  /** The members of a nested object property, documented the same way. */
  properties?: PropertyDoc[];
  /** True when `properties` documents the members of each array element rather than of an object value. */
  itemShape?: boolean;
  /** True when the property has no default and a value must be supplied. */
  required?: boolean;
}

export interface SectionDoc {
  id: string;
  title: string;
  description: string;
  allKey?: string;
  allDescription?: string;
  shape: 'object' | 'array';
  shapeRule?: ShapeRuleDoc;
  /** Top-level properties a value must be supplied for. */
  requiredKeys?: string[];
  properties: PropertyDoc[];
}

export interface TopLevelKeyDoc {
  key: string;
  description: string;
  rules: string[];
  defaultText: string;
  sectionId?: string;
  allKey?: string;
  allDescription?: string;
  allRules?: string[];
  allDefaultText?: string;
}

export interface ConfigReferenceModel {
  topLevel: TopLevelKeyDoc[];
  sections: SectionDoc[];
}

export const modelPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'mochart', 'generated', 'config-reference.json'
);

export function loadConfigReference(): ConfigReferenceModel {
  if (!fs.existsSync(modelPath)) {
    throw new Error(
      'config-reference.json not found at ' + modelPath +
      ' — run "npm run gen -w @mochart/docs" (or generate-docs in @mochart/core) first.'
    );
  }
  return JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as ConfigReferenceModel;
}
