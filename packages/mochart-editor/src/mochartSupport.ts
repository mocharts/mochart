import { acceptCompletion, autocompletion, pickedCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { hoverTooltip, keymap, type EditorView } from '@codemirror/view';
import { getDefaults, getVersionString, validateConfigDetailed } from '@mochart/core';
import type { Diagnostic } from '@codemirror/lint';
import model from './mochartConfigModel.generated.js';
import type { EditorPropertyModel, EditorSectionModel, EditorValueModel } from './model.js';
import { afterClosingPropertyQuote, containingObject, existingObjectKeys, isPropertyPosition, keyRangeForPath, memberIndentation, objectPath, pathAt, propertyNameAt, rangeForPath } from './jsonTree.js';
import { defineSupport } from './support.js';
import type { JsonPath } from './types.js';

const sections = new Map<string, EditorSectionModel>();
for (const section of model.sections) {
  sections.set(section.id, section);
  if (section.allKey) sections.set(section.allKey, section);
}

function sectionForPath(path: JsonPath): EditorSectionModel | null {
  return typeof path[0] === 'string' ? sections.get(path[0]) ?? null : null;
}

function topLevelProperties(): EditorPropertyModel[] {
  return model.topLevel.flatMap(property => {
    const primary = {
      key: property.key,
      description: property.description,
      editor: property.editor,
      rules: property.rules,
      default: { kind: 'literal', text: property.defaultText }
    } satisfies EditorPropertyModel;
    if (!property.allKey) return [primary];
    return [
      primary,
      {
        key: property.allKey,
        description: property.allDescription ?? property.description,
        editor: { types: ['object'] },
        rules: property.allRules ?? [],
        default: { kind: 'literal', text: property.allDefaultText }
      } satisfies EditorPropertyModel
    ];
  });
}

const rootProperties = topLevelProperties();

// Fallback for a nested value the docs model does not describe.
function nestedProperty(key: string, editor: EditorValueModel): EditorPropertyModel {
  return {
    key,
    description: `Configure ${key}`,
    rules: [],
    editor
  };
}

/** The documented members of a property, or the bare value shape when it has none. */
function nestedProperties(property: EditorPropertyModel | null): EditorPropertyModel[] {
  if (property?.properties && property.properties.length > 0) return property.properties;
  return Object.entries(property?.editor.properties ?? {}).map(([key, editor]) => nestedProperty(key, editor));
}

function nestedPropertyFor(property: EditorPropertyModel | null, key: string): EditorPropertyModel | null {
  const documented = property?.properties?.find(candidate => candidate.key === key);
  if (documented) return documented;
  const editor = property?.editor.properties?.[key];
  return editor ? nestedProperty(key, editor) : null;
}

function propertyForPath(path: JsonPath): EditorPropertyModel | null {
  const keys = path.filter((segment): segment is string => typeof segment === 'string');
  if (keys.length === 1) return rootProperties.find(property => property.key === keys[0]) ?? null;
  const section = sectionForPath(path);
  if (!section || keys.length < 2) return null;
  let property = section.properties.find(candidate => candidate.key === keys[1]) ?? null;
  for (const key of keys.slice(2)) {
    property = nestedPropertyFor(property, key);
    if (!property) return null;
  }
  return property;
}

function propertiesForObject(path: JsonPath): EditorPropertyModel[] {
  if (path.length === 0) return rootProperties;
  const keys = path.filter((segment): segment is string => typeof segment === 'string');
  const section = sectionForPath(path);
  if (!section) return [];
  if (keys.length === 1) {
    // unique properties cannot be set on an all config, so don't offer them
    const excludedKeys = [...(section.uniqueKeys ?? []), ...(section.allExcludedKeys ?? [])];
    return path[0] === section.allKey && excludedKeys.length > 0
      ? section.properties.filter(property => !excludedKeys.includes(property.key))
      : section.properties;
  }
  let property = section.properties.find(candidate => candidate.key === keys[1]) ?? null;
  for (const key of keys.slice(2)) property = nestedPropertyFor(property, key);
  return nestedProperties(property);
}

function placeholder(value: EditorValueModel): string {
  const allowed = value.enum?.filter(candidate => candidate !== undefined);
  if (allowed && allowed.length > 0) return JSON.stringify(allowed[0]);
  if (value.types.includes('boolean')) return 'false';
  if (value.types.includes('number')) return '0';
  if (value.types.includes('array')) return '[]';
  if (value.types.includes('object')) return '{}';
  return '""';
}

function defaultText(property: EditorPropertyModel): string {
  if (property.default?.kind === 'literal' && property.default.text) {
    try {
      return JSON.stringify(JSON.parse(property.default.text));
    }
    catch {
      // Documentation defaults can use JavaScript object notation. The editor
      // inserts only strict JSON, so fall back to a type-aware placeholder.
    }
  }
  if (property.default?.kind === 'color' && property.default.color) return JSON.stringify(property.default.color);
  return placeholder(property.editor);
}

// the model stores a default as text, a single color, a color list, or only per-condition values
function defaultLines(property: EditorPropertyModel): string[] {
  const { default: value, conditionalDefaults } = property;
  if (value?.text) return ['Default: ' + value.text];
  if (value?.color) return ['Default: ' + JSON.stringify(value.color)];
  if (value?.colors) return ['Default: ' + JSON.stringify(value.colors)];
  if (conditionalDefaults && conditionalDefaults.length > 0) {
    return conditionalDefaults.filter(entry => entry.value.text).map(entry => 'Default ' + entry.condition + ': ' + entry.value.text);
  }
  return [];
}

function propertyInfo(property: EditorPropertyModel): string {
  const lines = [property.description];
  if (property.details) lines.push(property.details);
  if (property.rules.length > 0) lines.push('Rules: ' + property.rules.join('; '));
  lines.push(...defaultLines(property));
  return lines.join('\n\n');
}

function valueAtPath(document: unknown, path: JsonPath): unknown {
  let value = document;
  for (const segment of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string | number, unknown>)[segment];
  }
  return value;
}

function referencedValues(document: unknown, property: EditorPropertyModel, path: JsonPath): unknown[] {
  if (!property.reference || document === null || typeof document !== 'object') return [];
  const config = document as Record<string, unknown>;
  const values: unknown[] = [];
  const target = valueAtPath(document, path.slice(0, -1));
  const commonValue = property.reference.commonKey && target && typeof target === 'object'
    ? (target as Record<string, unknown>)[property.reference.commonKey]
    : undefined;
  for (const sectionKey of property.reference.sections) {
    const raw = config[sectionKey];
    const entries = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
    for (const entry of entries) {
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        if (property.reference.commonKey && commonValue !== undefined &&
            record[property.reference.commonKey] !== commonValue) continue;
        const value = record[property.reference.key];
        if (value !== undefined) values.push(value);
      }
    }
  }
  return values;
}

// Insertions carry their own quotes, so the change must swallow the quotes at
// the cursor: the typed opening quote before the match and the rest of the
// token — including its auto-closed/closing quote — after it.
function applyJsonText(text: string) {
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    const start = view.state.sliceDoc(from - 1, from) === '"' ? from - 1 : from;
    const tail = /^[\w-]*"?/.exec(view.state.sliceDoc(to, to + 80))?.[0] ?? '';
    view.dispatch({
      changes: { from: start, to: to + tail.length, insert: text },
      selection: { anchor: start + text.length },
      userEvent: 'input.complete',
      annotations: pickedCompletion.of(completion)
    });
  };
}

// Property insertions keep the one-member-per-line layout of a formatted
// config: a break + indent when the line already has content, a separating
// comma when a member follows, and the selection over the placeholder value.
function applyProperty(key: string, value: string) {
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    const { state } = view;
    const keyText = JSON.stringify(key);
    // inside the name of a member that already has its colon and value: rename the key, keep the value
    const name = propertyNameAt(state, from);
    if (name && name.hasColon) {
      view.dispatch({
        changes: { from: name.from, to: name.to, insert: keyText },
        selection: { anchor: name.from + keyText.length },
        userEvent: 'input.complete',
        annotations: pickedCompletion.of(completion)
      });
      return;
    }
    const start = state.sliceDoc(from - 1, from) === '"' ? from - 1 : from;
    // a closing quote is only swallowed when a typed opening quote pairs with it
    const tail = (start < from ? /^[\w-]*"?/ : /^[\w-]*/).exec(state.sliceDoc(to, to + 80))?.[0] ?? '';
    let end = to + tail.length;

    const object = containingObject(state, from);
    const multiline = object !== null &&
      state.doc.lineAt(object.from).number !== state.doc.lineAt(object.to).number;
    const indent = object ? memberIndentation(state, object) : '';
    const line = state.doc.lineAt(start);
    const prefix = multiline && /\S/.test(state.sliceDoc(line.from, start)) ? state.lineBreak + indent : '';

    let suffix = '';
    const sameLineMember = /^[ \t]*"/.exec(state.sliceDoc(end, end + 80));
    if (sameLineMember && multiline) {
      end += sameLineMember[0].length - 1;
      suffix = ',' + state.lineBreak + indent;
    }
    else if (/^\s*"/.test(state.sliceDoc(end, end + 80))) {
      suffix = ',';
    }

    const valueStart = start + prefix.length + keyText.length + 2;
    const selection = value === '{}' || value === '[]' || value === '""'
      ? { anchor: valueStart + 1 }
      : { anchor: valueStart, head: valueStart + value.length };
    view.dispatch({
      changes: { from: start, to: end, insert: prefix + keyText + ': ' + value + suffix },
      selection,
      userEvent: 'input.complete',
      annotations: pickedCompletion.of(completion)
    });
  };
}

function valueOptions(property: EditorPropertyModel, document: unknown, path: JsonPath): Completion[] {
  const values = [...(property.editor.enum ?? []), ...referencedValues(document, property, path)]
    .filter(value => value !== undefined);
  if (property.editor.types.includes('boolean')) values.push(true, false);
  return values
    .filter((value, index) => values.findIndex(candidate => Object.is(candidate, value)) === index)
    .map(value => ({
      label: JSON.stringify(value),
      apply: applyJsonText(JSON.stringify(value)),
      type: typeof value === 'boolean' ? 'keyword' : 'constant',
      detail: property.reference ? 'configured id' : undefined
    }));
}

function completionSource(context: CompletionContext) {
  const object = containingObject(context.state, context.pos);
  if (!object) return null;
  const containerPath = objectPath(context.state, object);
  const word = context.matchBefore(/"?[\w-]*/);
  // stay closed until a quote or word character is typed (or Ctrl-Space):
  // an eager popup swallows the Enter after a trailing comma
  if (!context.explicit && !word?.text) return null;
  // the quote just stepped over closes a finished key; a popup here would splice a member into it
  if (afterClosingPropertyQuote(context.state, context.pos)) return null;
  // the match span starts after any typed quote so it filters against the bare
  // labels; applyJsonText re-swallows the quote when inserting
  const from = word ? word.from + (word.text.startsWith('"') ? 1 : 0) : context.pos;
  if (isPropertyPosition(context.state, context.pos, object)) {
    const existing = new Set(existingObjectKeys(context.state, object));
    const properties = propertiesForObject(containerPath);
    return {
      from,
      options: properties.filter(property => !existing.has(property.key)).map(property => ({
        label: property.key,
        apply: applyProperty(property.key, defaultText(property)),
        type: 'property',
        detail: property.editor.types.join(' | '),
        info: propertyInfo(property)
      })),
      validFor: /^[\w-]*$/
    };
  }

  const path = pathAt(context.state, context.pos);
  const property = propertyForPath(path);
  if (!property) return null;
  let document: unknown;
  try {
    document = JSON.parse(context.state.doc.toString());
  }
  catch {
    document = null;
  }
  const options = valueOptions(property, document, path);
  return options.length > 0 ? { from, options } : null;
}

function hoverSource(view: import('@codemirror/view').EditorView, position: number) {
  const property = propertyForPath(pathAt(view.state, position));
  if (!property) return null;
  return {
    pos: position,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'mochart-editor-hover';
      const title = document.createElement('strong');
      title.textContent = property.key;
      const description = document.createElement('div');
      description.textContent = propertyInfo(property);
      dom.append(title, description);
      return { dom };
    }
  };
}

function semanticDiagnostics(view: import('@codemirror/view').EditorView): Diagnostic[] {
  let config: unknown;
  try {
    config = JSON.parse(view.state.doc.toString());
  }
  catch {
    return [];
  }
  try {
    const defaults = getDefaults(config);
    return validateConfigDetailed(config, defaults).diagnostics.flatMap(diagnostic => {
      // Invalid-property reports range each offending key name, not the whole container.
      if (diagnostic.invalidProperties && diagnostic.invalidProperties.length > 0) {
        return diagnostic.invalidProperties.map(key => ({
          ...keyRangeForPath(view.state, diagnostic.path, key),
          severity: diagnostic.severity,
          message: diagnostic.message,
          source: 'mochart',
          path: [...diagnostic.path, key]
        } as Diagnostic));
      }
      return [{
        ...rangeForPath(view.state, diagnostic.path),
        severity: diagnostic.severity,
        message: diagnostic.message,
        source: 'mochart',
        path: diagnostic.path
      } as Diagnostic];
    });
  }
  catch {
    // a throw would escape the linter and silently freeze diagnostics on the previous pass
    return [{
      from: 0,
      to: view.state.doc.length,
      severity: 'error',
      message: 'config could not be validated',
      source: 'mochart',
      path: []
    } as Diagnostic];
  }
}

let warnedModelSkew = false;

// A patch release cannot add or remove config properties, so only major.minor can stale the model.
function configSurfaceVersion(version: string) {
  const [major = '', minor = ''] = version.split('.');
  return major + '.' + minor;
}

// Completions come from the build-time model; diagnostics come from the installed core.
function warnOnModelSkew(modelVersion: string, coreVersion: string) {
  if (warnedModelSkew) return;
  if (configSurfaceVersion(modelVersion) === configSurfaceVersion(coreVersion)) return;
  warnedModelSkew = true;
  console.warn(
    `@mochart/editor: completions and hover come from a config model generated from @mochart/core ${modelVersion}, ` +
    `but the installed @mochart/core is ${coreVersion}. Config properties added or removed since ${modelVersion} ` +
    'have no completions and no hover text; validation diagnostics still come from the installed core. ' +
    'Install the @mochart/editor release built against this core version.'
  );
}

/**
 * Internal behavior-test seam. This module is not a package export, so these
 * implementation details do not become part of @mochart/editor's public API.
 */
export const mochartSupportTesting = {
  completionSource,
  hoverSource,
  semanticDiagnostics,
  warnOnModelSkew,
  resetModelSkewWarning() {
    warnedModelSkew = false;
  }
};

/** Add MochartConfig completions, hover documentation, and validation. */
export function createMochartConfigSupport() {
  warnOnModelSkew(model.coreVersion, getVersionString());
  return defineSupport('mochart-config', {
    extensions: [
      autocompletion({ override: [completionSource] }),
      keymap.of([{ key: 'Tab', run: acceptCompletion }]),
      hoverTooltip(hoverSource, { hoverTime: 300 })
    ],
    diagnostics: semanticDiagnostics
  });
}

export { model as mochartConfigEditorModel };
