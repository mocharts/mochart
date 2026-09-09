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

export interface EditorPropertyModel {
  key: string;
  description: string;
  details?: string;
  rules: string[];
  default?: { kind: string; text?: string; color?: string; colors?: string[] };
  conditionalDefaults?: { value: { kind: string; text?: string }; condition: string }[];
  editor: EditorValueModel;
  reference?: EditorReferenceModel;
  /** The documented members of a nested object property. */
  properties?: EditorPropertyModel[];
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
