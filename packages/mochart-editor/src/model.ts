export type EditorValueType = 'any' | 'array' | 'boolean' | 'number' | 'object' | 'string';

export interface EditorValueModel {
  types: EditorValueType[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  properties?: Record<string, EditorValueModel>;
  items?: EditorValueModel;
}

export interface EditorReferenceModel {
  sections: string[];
  key: string;
  commonKey?: string;
}

export type EditorDefaultValue =
  | { kind: 'color'; color: string }
  | { kind: 'colors'; colors: string[] }
  | { kind: 'literal'; text: string }
  | { kind: 'none' };

export interface EditorConditionalDefault {
  value: EditorDefaultValue;
  /** Human-readable condition under which this default applies. */
  condition: string;
}

export interface EditorPropertyModel {
  key: string;
  description: string;
  details?: string;
  rules: string[];
  default?: EditorDefaultValue;
  conditionalDefaults?: EditorConditionalDefault[];
  editor: EditorValueModel;
  reference?: EditorReferenceModel;
  /** The documented members of a nested object property. */
  properties?: EditorPropertyModel[];
  /** True when the property has no default and a value must be supplied. */
  required?: boolean;
}

export interface EditorSectionModel {
  id: string;
  title: string;
  description: string;
  shape: 'object' | 'array';
  allKey?: string;
  /** Per-entry unique properties — not settable on the all config. */
  uniqueKeys?: string[];
  allExcludedKeys?: string[];
  properties: EditorPropertyModel[];
}

export interface MochartConfigModel {
  /** The @mochart/core version this model was generated from. */
  coreVersion: string;
  topLevel: {
    key: string;
    description: string;
    rules: string[];
    defaultText: string;
    sectionId?: string;
    allKey?: string;
    allDescription?: string;
    allRules?: string[];
    allDefaultText?: string;
    editor: EditorValueModel;
  }[];
  sections: EditorSectionModel[];
}
