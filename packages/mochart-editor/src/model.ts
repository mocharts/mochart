/** A JSON value type a config property accepts; 'any' when the validator does not narrow it. */
export type EditorValueType = 'any' | 'array' | 'boolean' | 'number' | 'object' | 'string';

/** What a property's value may be, as read from its validator, for completions and value checks. */
export interface EditorValueModel {
  /** The JSON types the value may take. */
  types: EditorValueType[];
  /** The only values allowed, when the validator lists them (null included when it is allowed). */
  enum?: unknown[];
  /** The smallest number allowed. */
  minimum?: number;
  /** The largest number allowed. */
  maximum?: number;
  /** A named kind of string or number, such as 'color', 'numberFormat' or 'fontFamily'. */
  format?: string;
  /** The value models of an object value's members, by key. */
  properties?: Record<string, EditorValueModel>;
  /** The value model of each element of an array value. */
  items?: EditorValueModel;
}

/** A property whose value is the id of an entry declared elsewhere in the config, such as a series' axis. */
export interface EditorReferenceModel {
  /** The list sections whose entries can be referenced. */
  sections: string[];
  /** The key of the referenced entries whose value is used, usually 'id'. */
  key: string;
  /** A key the referencing entry and the referenced entry must share a value for, such as 'axis' for a series' stack. */
  commonKey?: string;
}

/** A property's default as the reference shows it. */
export type EditorDefaultValue =
  /** A single color. */
  | { kind: 'color'; color: string }
  /** A list of colors, such as a palette. */
  | { kind: 'colors'; colors: string[] }
  /** Any other value, written as text. */
  | { kind: 'literal'; text: string }
  /** No default: nothing fills the property in. */
  | { kind: 'none' };

/** A default that applies only under a condition, such as one chart type. */
export interface EditorConditionalDefault {
  /** The default under that condition. */
  value: EditorDefaultValue;
  /** Human-readable condition under which this default applies. */
  condition: string;
}

/** One config property as the reference documents it. */
export interface EditorPropertyModel {
  /** The property's key in its section. */
  key: string;
  /** What the property does. */
  description: string;
  /** A longer remark, in markdown. */
  details?: string;
  /** The validation rule messages, including uniqueness and reference constraints. */
  rules: string[];
  /** The default, when it does not depend on other settings. */
  default?: EditorDefaultValue;
  /** The defaults that depend on other settings, one per condition. */
  conditionalDefaults?: EditorConditionalDefault[];
  /** What the value may be. */
  editor: EditorValueModel;
  /** Set when the value is the id of an entry declared elsewhere in the config. */
  reference?: EditorReferenceModel;
  /** The documented members of a nested object property. */
  properties?: EditorPropertyModel[];
  /** True when the property has no default and a value must be supplied. */
  required?: boolean;
}

/** One config section, such as legend or series. */
export interface EditorSectionModel {
  /** The section's top-level key. */
  id: string;
  /** The section's display title. */
  title: string;
  /** What the section configures. */
  description: string;
  /** 'object' for a section written as one object, 'array' for a list of entries. */
  shape: 'object' | 'array';
  /** The key of the companion *Defaults section whose values apply to every entry, such as 'seriesDefaults'. */
  allKey?: string;
  /** Per-entry unique properties, such as id, which the *Defaults section cannot set. */
  uniqueKeys?: string[];
  /** Other per-entry properties the *Defaults section cannot supply. */
  allExcludedKeys?: string[];
  /** The section's properties. */
  properties: EditorPropertyModel[];
}

/** The model behind the editor's completions and hover text, generated from @mochart/core's config reference. */
export interface MochartConfigModel {
  /** The @mochart/core version this model was generated from. */
  coreVersion: string;
  /** Each top-level config key. */
  topLevel: {
    /** The top-level key. */
    key: string;
    /** What the key configures. */
    description: string;
    /** The validation rule messages for its value. */
    rules: string[];
    /** The key's default, as text: '{}' for an object section, '[]' for a list section, otherwise ''. */
    defaultText: string;
    /** The id of the section the key opens, when it is one. */
    sectionId?: string;
    /** The key of its companion *Defaults section, when it has one. */
    allKey?: string;
    /** What the *Defaults section configures. */
    allDescription?: string;
    /** The validation rule messages for the *Defaults section. */
    allRules?: string[];
    /** The *Defaults section's default, as text. */
    allDefaultText?: string;
    /** What the value may be. */
    editor: EditorValueModel;
  }[];
  /** Every config section in detail. */
  sections: EditorSectionModel[];
}
