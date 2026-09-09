// Builds the framework-props model: what each binding package calls the props
// documented in the core api reference, and which props are binding-specific.
//
// Descriptions are inherited from the core model by mapping each binding prop
// back to its core counterpart (`loadingComponent` → `getLoadingComponent`,
// Angular's `chartClick` output → `onChartClick`), so the prose has exactly
// one home; a binding prop only needs its own JSDoc when it has no core
// counterpart (`className`, `class`, `style`). Integrity errors — reported by
// scripts/generateBindings.ts, which fails the docs build and `npm test` —
// cover the three ways this drifts:
//
//   1. a binding prop that neither maps to core nor documents itself;
//   2. a core prop missing from a binding (how `onSliceClick` went unnoticed),
//      unless the binding lists it in `expectedMissing` with a reason;
//   3. Vue's runtime prop declarations disagreeing with its prop types.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  jsDocText,
  parseInterfaces,
  readSourceFile,
  typeText,
  type ParsedMember
} from '../../mochart/scripts/tsSource';

/** A parsed member plus what the reader knows that its name does not. */
type SourceMember = ParsedMember & { kindHint?: BindingPropKind };

const packagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export type BindingPropKind = 'entry' | 'prop' | 'callback' | 'placeholder';

export interface BindingPropDoc {
  key: string;
  kind: BindingPropKind;
  type: string;
  optional: boolean;
  description: string;
  /** The core prop this one mirrors, when there is one. */
  coreKey?: string;
  /** Anchor for `coreKey` in the core reference. */
  coreLink?: string;
  /** True when the binding spells the core prop differently. */
  renamed: boolean;
}

export interface BindingGroupDoc {
  id: string;
  title: string;
  description: string;
  properties: BindingPropDoc[];
}

export interface BindingNote {
  coreKey: string;
  coreLink: string;
  /** Why this binding has no counterpart for the core prop. */
  reason: string;
}

export interface BindingDoc {
  id: string;
  title: string;
  packageName: string;
  guideLink: string;
  /** How props are surfaced, e.g. 'component props' or 'inputs and outputs'. */
  surface: string;
  groups: BindingGroupDoc[];
  /** Core props this binding deliberately lacks, and why. */
  notes: BindingNote[];
}

export interface BindingMappingRow {
  coreKey: string;
  coreLink: string;
  /** Binding id → the name that binding uses, or null when it has none. */
  names: Record<string, string | null>;
}

export interface BindingReferenceModel {
  bindings: BindingDoc[];
  mapping: BindingMappingRow[];
}

export interface BindingReferenceResult {
  model: BindingReferenceModel;
  integrityErrors: string[];
}

/** The core api-reference model, as far as this builder reads it. */
export interface CoreApiModel {
  pages: {
    id: string;
    groups: {
      id: string;
      properties: { key: string; description: string }[];
    }[];
  }[];
}

// Core groups holding props (as opposed to payload shapes), in the order the
// mapping table lists them.
const corePropGroups = ['defaultChartProps', 'managedChartProps', 'props', 'callbacks', 'factories'];

interface BindingSource {
  id: string;
  title: string;
  packageName: string;
  directory: string;
  guideLink: string;
  surface: string;
  /** Interface-based bindings read prop types; Angular reads its decorators. */
  style: 'interfaces' | 'angular';
  /** Core props this binding deliberately lacks → why. */
  expectedMissing: Record<string, string>;
}

const bindingSources: BindingSource[] = [
  {
    id: 'react',
    title: 'React',
    packageName: '@mochart/react',
    directory: 'mochart-react',
    guideLink: '/guide/frameworks/react',
    surface: 'component props on `Chart` and `DefaultChart`',
    style: 'interfaces',
    expectedMissing: {
      style: 'the binding has its own style prop, applied to the container div it renders rather than forwarded to core'
    }
  },
  {
    id: 'svelte',
    title: 'Svelte',
    packageName: '@mochart/svelte',
    directory: 'mochart-svelte',
    guideLink: '/guide/frameworks/svelte',
    surface: 'component props on `Chart` and `DefaultChart`',
    style: 'interfaces',
    expectedMissing: {
      style: 'the binding has its own style prop, applied to the container div it renders rather than forwarded to core'
    }
  },
  {
    id: 'vue',
    title: 'Vue',
    packageName: '@mochart/vue',
    directory: 'mochart-vue',
    guideLink: '/guide/frameworks/vue',
    surface: 'component props on `Chart` and `DefaultChart`',
    style: 'interfaces',
    expectedMissing: {
      style: 'class and style are fallthrough attrs in Vue, so they land on the container div automatically'
    }
  },
  {
    id: 'lit',
    title: 'Lit',
    packageName: '@mochart/lit',
    directory: 'mochart-lit',
    guideLink: '/guide/frameworks/lit',
    surface: 'directive props on `chart()` and `defaultChart()`',
    style: 'interfaces',
    expectedMissing: {
      style: 'the directive has its own style prop, applied to the container div it renders rather than forwarded to core'
    }
  },
  {
    id: 'angular',
    title: 'Angular',
    packageName: '@mochart/angular',
    directory: 'mochart-angular',
    guideLink: '/guide/frameworks/angular',
    surface: 'inputs and outputs on `<mochart-chart>` and `<mochart-default-chart>`',
    style: 'angular',
    expectedMissing: {
      style: 'class and style are set on the component element itself, which is the chart container'
    }
  }
];

const categoryTitles: Record<BindingPropKind, { title: string; description: string }> = {
  entry: {
    title: 'Entry-point props',
    description:
      'The config and data source. The `Chart` entry point takes `mochartConfig`' +
      ' and `dataProvider`; the `DefaultChart` one takes `config` and `data`.' +
      ' Both are required on the entry point that declares them.'
  },
  prop: {
    title: 'Chart props',
    description: 'Sizing, container styling, state, and the controlled focus and filter props.'
  },
  callback: {
    title: 'Callbacks',
    description: 'The chart callbacks, reporting the payloads documented in the core reference.'
  },
  placeholder: {
    title: 'State placeholders',
    description: 'What renders in each non-chart state, in place of the core state factories.'
  }
};

const entryKeys = new Set(['config', 'data', 'mochartConfig', 'dataProvider']);

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function classifyKey(key: string, hint: BindingPropKind | undefined): BindingPropKind {
  if (entryKeys.has(key)) return 'entry';
  if (/^(Component|Template)$/.test(key)) return 'prop';
  if (/(Component|Template)$/.test(key)) return 'placeholder';
  if (/^on[A-Z]/.test(key)) return 'callback';
  // Angular's callbacks are outputs, named without the `on` prefix, so the
  // reader tells us what a name cannot.
  return hint ?? 'prop';
}

// Bindings strip `style` and apply it to the container div they render, so the
// same-named core prop (inline style on core's root element) is not its counterpart.
const bindingOwnKeys = new Set(['style']);

/** The core prop a binding prop mirrors, following each binding's renaming rules. */
function coreKeyFor(key: string, coreKeys: Set<string>): string | undefined {
  if (bindingOwnKeys.has(key)) {
    return undefined;
  }
  if (coreKeys.has(key)) {
    return key;
  }
  // Angular drops the `on` prefix for outputs: chartClick → onChartClick.
  const asCallback = 'on' + upperFirst(key);
  if (coreKeys.has(asCallback)) {
    return asCallback;
  }
  // An Angular `xChange` output mirrors a core `onX` callback when the bare
  // name would shadow a native DOM event: focusChange → onFocus.
  if (key.endsWith('Change')) {
    const asChangeCallback = 'on' + upperFirst(key.slice(0, -'Change'.length));
    if (coreKeys.has(asChangeCallback)) {
      return asChangeCallback;
    }
  }
  // Placeholders replace the core factories: loadingComponent (or lit's
  // loadingTemplate) → getLoadingComponent.
  const placeholder = /^(.*)(Component|Template)$/.exec(key);
  if (placeholder !== null) {
    const asFactory = 'get' + upperFirst(placeholder[1] ?? '') + 'Component';
    if (coreKeys.has(asFactory)) {
      return asFactory;
    }
  }
  return undefined;
}

function readInterfaceBinding(source: BindingSource): SourceMember[] {
  const interfaces = parseInterfaces(path.join(packagesDir, source.directory, 'src', 'types.ts'));
  const members: SourceMember[] = [];
  for (const name of ['ChartProps', 'DefaultChartProps', 'BaseChartProps', 'ChartCallbackProps']) {
    const parsed = interfaces.get(name);
    if (parsed === undefined) {
      continue;
    }
    for (const member of parsed.members) {
      if (!members.some(existing => existing.key === member.key)) {
        members.push(member);
      }
    }
  }
  return members;
}

/** Angular's props are `@Input()` fields and `@Output()` emitters on classes. */
function readAngularBinding(source: BindingSource): SourceMember[] {
  const members: SourceMember[] = [];
  for (const file of ['base-chart.ts', 'chart.ts', 'default-chart.ts']) {
    const { text, sourceFile } = readSourceFile(path.join(packagesDir, source.directory, 'src', file));
    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) {
        continue;
      }
      for (const member of statement.members) {
        if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
          continue;
        }
        const decorators = (ts.getDecorators(member) ?? []).map(decorator => decorator.getText(sourceFile));
        const isInput = decorators.some(decorator => decorator.startsWith('@Input'));
        const isOutput = decorators.some(decorator => decorator.startsWith('@Output'));
        if (!isInput && !isOutput) {
          continue;
        }
        const declaredType = typeText(member.type, sourceFile);
        members.push({
          key: member.name.text,
          kindHint: isOutput ? 'callback' : undefined,
          // Outputs declare no type annotation; their initializer names it.
          type: declaredType === 'unknown' && member.initializer !== undefined
            ? outputTypeFromInitializer(member.initializer, sourceFile)
            : declaredType,
          // an Output is always optional to a host: subscribing to it is opt-in
          optional: isOutput || member.questionToken !== undefined,
          description: jsDocText(text, member)
        });
      }
    }
  }
  return members;
}

/** Factory call or constructor, the host-visible type is `EventEmitter<T>` either way. */
function outputTypeFromInitializer(initializer: ts.Expression, sourceFile: ts.SourceFile): string {
  if (ts.isNewExpression(initializer) || ts.isCallExpression(initializer)) {
    const typeArguments = initializer.typeArguments;
    const args = typeArguments && typeArguments.length > 0
      ? '<' + typeArguments.map(typeArgument => typeArgument.getText(sourceFile)).join(', ') + '>'
      : '';
    return 'EventEmitter' + args;
  }
  return initializer.getText(sourceFile);
}

/** Vue declares props twice: runtime objects in props.ts, types in types.ts. */
function vueRuntimePropKeys(): string[] {
  const { sourceFile } = readSourceFile(path.join(packagesDir, 'mochart-vue', 'src', 'props.ts'));
  const keys: string[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      // Only the exported prop objects; the file also holds shared prop
      // fragments (`callbackProp` and friends) whose keys are Vue prop options.
      const isPropObject = ts.isIdentifier(declaration.name)
        && ['baseChartProps', 'chartProps', 'defaultChartProps'].includes(declaration.name.text);
      if (!isPropObject || declaration.initializer === undefined || !ts.isObjectLiteralExpression(declaration.initializer)) {
        continue;
      }
      for (const property of declaration.initializer.properties) {
        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
          keys.push(property.name.text);
        }
      }
    }
  }
  return keys;
}

export function buildBindingReference(coreModel: CoreApiModel): BindingReferenceResult {
  const integrityErrors: string[] = [];

  const coreDescriptions = new Map<string, string>();
  const coreLinks = new Map<string, string>();
  const orderedCoreKeys: string[] = [];
  for (const page of coreModel.pages) {
    for (const group of page.groups) {
      if (!corePropGroups.includes(group.id)) {
        continue;
      }
      for (const property of group.properties) {
        if (!coreDescriptions.has(property.key)) {
          coreDescriptions.set(property.key, property.description);
          coreLinks.set(property.key, '/reference/' + page.id + '#' + group.id + '.' + property.key);
          orderedCoreKeys.push(property.key);
        }
      }
    }
  }
  const coreKeys = new Set(orderedCoreKeys);
  if (coreKeys.size === 0) {
    integrityErrors.push('the core api-reference model has no prop groups — run the core generator first');
  }

  const bindings: BindingDoc[] = [];
  const namesByCoreKey = new Map<string, Record<string, string | null>>();
  for (const coreKey of orderedCoreKeys) {
    namesByCoreKey.set(coreKey, Object.fromEntries(bindingSources.map(source => [source.id, null])));
  }

  for (const source of bindingSources) {
    const members = source.style === 'angular' ? readAngularBinding(source) : readInterfaceBinding(source);
    if (members.length === 0) {
      integrityErrors.push(`${source.packageName}: no props found — did its source layout change?`);
    }

    const properties: BindingPropDoc[] = members.map(member => {
      const coreKey = coreKeyFor(member.key, coreKeys);
      const inherited = coreKey === undefined ? '' : coreDescriptions.get(coreKey) ?? '';
      const description = member.description !== '' ? member.description : inherited;
      if (description === '') {
        integrityErrors.push(
          `${source.packageName}: ${member.key} maps to no core prop and has no JSDoc —` +
          ' document it in the binding, or name it after the core prop it mirrors'
        );
      }
      if (coreKey !== undefined) {
        const names = namesByCoreKey.get(coreKey);
        if (names !== undefined) {
          names[source.id] = member.key;
        }
      }
      const doc: BindingPropDoc = {
        key: member.key,
        kind: classifyKey(member.key, member.kindHint),
        type: member.type,
        optional: member.optional,
        description,
        renamed: coreKey !== undefined && coreKey !== member.key
      };
      if (coreKey !== undefined) {
        doc.coreKey = coreKey;
        doc.coreLink = coreLinks.get(coreKey);
      }
      return doc;
    });

    const covered = new Set(properties.map(property => property.coreKey).filter(Boolean));
    for (const coreKey of orderedCoreKeys) {
      if (covered.has(coreKey) || coreKey in source.expectedMissing) {
        continue;
      }
      integrityErrors.push(
        `${source.packageName}: core prop ${coreKey} has no counterpart —` +
        ' add it to the binding, or to its expectedMissing with a reason'
      );
    }
    for (const [coreKey, reason] of Object.entries(source.expectedMissing)) {
      if (covered.has(coreKey)) {
        integrityErrors.push(
          `${source.packageName}: expectedMissing lists ${coreKey} ("${reason}"), but the binding has it now`
        );
      }
      else if (!coreKeys.has(coreKey)) {
        integrityErrors.push(`${source.packageName}: expectedMissing lists ${coreKey}, which is not a core prop`);
      }
    }

    const groups: BindingGroupDoc[] = (['entry', 'prop', 'callback', 'placeholder'] as BindingPropKind[])
      .map(kind => ({
        id: source.id + '.' + kind,
        title: categoryTitles[kind].title,
        description: categoryTitles[kind].description,
        properties: properties.filter(property => property.kind === kind)
      }))
      .filter(group => group.properties.length > 0);

    const notes = Object.entries(source.expectedMissing)
      .filter(([coreKey]) => !covered.has(coreKey))
      .map(([coreKey, reason]) => ({ coreKey, coreLink: coreLinks.get(coreKey) ?? '', reason }));

    bindings.push({
      id: source.id,
      title: source.title,
      packageName: source.packageName,
      guideLink: source.guideLink,
      surface: source.surface,
      groups,
      notes
    });
  }

  const vueTypeKeys = new Set(readInterfaceBinding(bindingSources.find(source => source.id === 'vue')!).map(member => member.key));
  const vueRuntimeKeys = new Set(vueRuntimePropKeys());
  for (const key of vueRuntimeKeys) {
    if (!vueTypeKeys.has(key)) {
      integrityErrors.push(`@mochart/vue: props.ts declares ${key}, which its types.ts does not`);
    }
  }
  for (const key of vueTypeKeys) {
    if (!vueRuntimeKeys.has(key)) {
      integrityErrors.push(`@mochart/vue: types.ts declares ${key}, which its props.ts does not`);
    }
  }

  const mapping: BindingMappingRow[] = orderedCoreKeys.map(coreKey => ({
    coreKey,
    coreLink: coreLinks.get(coreKey) ?? '',
    names: namesByCoreKey.get(coreKey) ?? {}
  }));

  return { model: { bindings, mapping }, integrityErrors };
}
