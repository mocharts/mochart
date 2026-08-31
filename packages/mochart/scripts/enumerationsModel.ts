// Builds the enumerated-values page of the api-reference model: every literal union type in
// src/config/core/constants.ts, the values it covers, and the config members typed with it.
// The values come from the constants module and the uses from src/types/config.ts, so the
// page cannot drift from either; the one hand-written part is the description table below,
// and a union without one — or a stale one — is an integrity error that fails the generator.

import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

import * as constants from '../src/config/core/constants';
import type { ConfigReferenceModel, PropertyDoc } from './configReferenceModel';
import { sectionInterfaceMap } from './generateJsdoc';
import { parseInterfaces, readSourceFile, type ParsedInterface } from './tsSource';

const packageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const constantsPath = path.join(packageDir, 'src', 'config', 'core', 'constants.ts');
const configTypesPath = path.join(packageDir, 'src', 'types', 'config.ts');

export interface EnumerationUse {
  /** Dotted config path, e.g. `series.renderer`. */
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

export interface EnumerationsResult {
  page: EnumerationsPageDoc;
  integrityErrors: string[];
}

export const ENUMERATIONS_PAGE_ID = 'enumerations';

// Union name → one-line description, in the order the page lists them.
const descriptions: Record<string, string> = {
  ChartType: 'The chart family: cartesian (`\'xy\'`) or pie.',
  DataType: 'The data type of the category axis values.',
  Scale: 'How the category axis spaces its categories.',
  AxisSide: 'Which side of the plot an axis is drawn on: the start (left or bottom) or the end.',
  Anchor: 'Where a tick label is anchored relative to its tick.',
  ThresholdTitleSide: 'Which side of a threshold line its title sits on.',
  Position: 'Whether the title or legend sits above or below the plot.',
  Align: 'Horizontal alignment.',
  TooltipValueAlign: 'Which edge of the tooltip its values are aligned to: left puts the label and value in one run of text, right floats the values to the far edge.',
  VerticalAlign: 'Vertical alignment.',
  RendererType: 'How a series draws its values.',
  CurveType: 'The interpolation curve for line and area series.',
  MissingValueMode: 'How a line or area series treats categories with no value.',
  CapType: 'The shape of the outer end of a bar.',
  LabelPosition: 'Where a series value label sits relative to its shape.',
  MarkerShape: 'The symbol drawn at each series value.',
  MarkerSizeScale: 'How marker area scales with the marker size property.',
  ColorMode: 'The keywords a series style color accepts in place of a CSS color, resolved against the palette.',
  ColorInterpolation: 'The color space a series color scale interpolates in.',
  PatternType: 'The fill pattern a `patterns` entry draws.',
  PieLabelType: 'What a pie slice label shows.',
  PieTooltipValueType: 'What a pie tooltip row shows: the slice value, its percent or both, without the series title the row already carries.',
  DomainChange: 'How an axis domain change animates relative to the value change.',
  AnimationEasing: 'How an animation\'s progress is paced over its duration.',
  Auto: 'The `\'auto\'` keyword, accepted by members that otherwise take a number, a format string, or another enumeration.'
};

const lead =
  'Many config members take one of a fixed set of string values — `renderer: \'bar\'`,' +
  ' `curve.type: \'monotoneX\'` — and each member\'s reference page lists its own. This page' +
  ' lists them by the TypeScript type they form. Every type here is exported from' +
  ' `@mochart/core`, so code that builds configs can name one in its own signature —' +
  ' `function setRenderer(renderer: RendererType)` — instead of indexing into a config' +
  ' type as `SeriesConfig[\'renderer\']`. The few exported value constants (`AUTO`,' +
  ' `TYPE_NUMBER`, …) are on the [API page](/reference/api#constants).';

/** `export type Name = typeof A | typeof B | Other` declarations, keyed by name. */
function parseUnionTypes(): Map<string, ts.TypeNode> {
  const { sourceFile } = readSourceFile(constantsPath);
  const unions = new Map<string, ts.TypeNode>();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      unions.set(statement.name.text, statement.type);
    }
  }
  return unions;
}

/** The literal values a union type covers, resolving `typeof CONST` through the constants module and other unions by name. */
function resolveValues(node: ts.TypeNode, unions: Map<string, ts.TypeNode>, errors: string[], owner: string): string[] {
  if (ts.isUnionTypeNode(node)) {
    return node.types.flatMap(member => resolveValues(member, unions, errors, owner));
  }
  if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) {
    const value = (constants as Record<string, unknown>)[node.exprName.text];
    if (typeof value !== 'string') {
      errors.push(`${owner} refers to ${node.exprName.text}, which is not a string constant`);
      return [];
    }
    return [value];
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    const referenced = unions.get(node.typeName.text);
    if (referenced === undefined) {
      errors.push(`${owner} refers to ${node.typeName.text}, which is not a union in constants.ts`);
      return [];
    }
    return resolveValues(referenced, unions, errors, owner);
  }
  errors.push(`${owner} has a member the enumerations builder cannot resolve: ${node.getText()}`);
  return [];
}

/** Type aliases declared in types/config.ts whose definition names a union, e.g. `SeriesColor` → `ColorMode`. */
function parseAliasMentions(unionNames: string[]): Map<string, string[]> {
  const { sourceFile } = readSourceFile(configTypesPath);
  const mentions = new Map<string, string[]>();
  for (const statement of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue;
    const text = statement.type.getText(sourceFile);
    const named = unionNames.filter(name => new RegExp(`\\b${name}\\b`).test(text));
    if (named.length > 0) mentions.set(statement.name.text, named);
  }
  return mentions;
}

function findProperty(properties: PropertyDoc[], keys: string[]): PropertyDoc | undefined {
  const [first, ...rest] = keys;
  const property = properties.find(candidate => candidate.key === first);
  if (property === undefined || rest.length === 0) return property;
  return findProperty(property.properties ?? [], rest);
}

/** Members of `parsed` and everything it extends, own members first. */
function allMembers(parsed: ParsedInterface, interfaces: Map<string, ParsedInterface>): ParsedInterface['members'] {
  const inherited = parsed.extendsNames.flatMap(name => {
    const base = interfaces.get(name);
    return base === undefined ? [] : allMembers(base, interfaces);
  });
  return [...parsed.members, ...inherited];
}

/** Split a type-argument list at top-level commas, so `Exclude<A, B>, C` yields two entries. */
function splitTypeArguments(argumentText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of argumentText) {
    if (character === '<' || character === '(') depth++;
    else if (character === '>' || character === ')') depth--;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    }
    else {
      current += character;
    }
  }
  parts.push(current.trim());
  return parts;
}

/** Apply generic-argument substitutions to a member's type text, by parameter name. */
function substituteTypeParameters(type: string, substitutions: Record<string, string>): string {
  let result = type;
  for (const [parameter, argument] of Object.entries(substitutions)) {
    result = result.replace(new RegExp(`\\b${parameter}\\b`, 'g'), argument);
  }
  return result;
}

interface ResolvedMemberInterface {
  parsed: ParsedInterface;
  /** Type parameter name -> argument text, for a generic instantiation. */
  substitutions: Record<string, string>;
}

/**
 * The interface a member's type names: a plain reference (optionally an array or nullable), a generic
 * instantiation of one (with the arguments captured for substitution), or an alias wrapping exactly one.
 */
function memberInterface(type: string, interfaces: Map<string, ParsedInterface>, aliasTexts: Map<string, string>): ResolvedMemberInterface | undefined {
  const name = type.replace(/\[\]$/, '').replace(/\s*\|\s*null$/, '').trim();
  const direct = interfaces.get(name);
  if (direct !== undefined) {
    return { parsed: direct, substitutions: {} };
  }
  const genericMatch = /^([A-Za-z0-9_]+)<(.*)>$/.exec(name);
  if (genericMatch !== null) {
    const generic = interfaces.get(genericMatch[1]!);
    if (generic !== undefined && generic.typeParameters.length > 0) {
      const argumentTexts = splitTypeArguments(genericMatch[2]!);
      const substitutions: Record<string, string> = {};
      generic.typeParameters.forEach((parameter, index) => {
        if (argumentTexts[index] !== undefined) {
          substitutions[parameter] = argumentTexts[index];
        }
      });
      return { parsed: generic, substitutions };
    }
  }
  const aliasText = aliasTexts.get(name);
  if (aliasText !== undefined) {
    const mentioned = [...interfaces.keys()].filter(candidate => new RegExp(`\\b${candidate}\\b`).test(aliasText));
    if (mentioned.length === 1) {
      return { parsed: interfaces.get(mentioned[0]!)!, substitutions: {} };
    }
  }
  return undefined;
}

/** Type aliases declared in types/config.ts, name -> declaration text. */
function parseAliasTexts(): Map<string, string> {
  const { sourceFile } = readSourceFile(configTypesPath);
  const texts = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      texts.set(statement.name.text, statement.type.getText(sourceFile));
    }
  }
  return texts;
}

export function buildEnumerations(configModel: ConfigReferenceModel): EnumerationsResult {
  const integrityErrors: string[] = [];
  const unions = parseUnionTypes();
  const unionNames = [...unions.keys()];

  for (const name of unionNames) {
    if (!(name in descriptions)) {
      integrityErrors.push(`${name} is a union type in config/core/constants.ts but has no description in scripts/enumerationsModel.ts`);
    }
  }
  for (const name of Object.keys(descriptions)) {
    if (!unions.has(name)) {
      integrityErrors.push(`enumerationsModel.ts describes ${name}, which config/core/constants.ts no longer declares`);
    }
  }

  const interfaces = parseInterfaces(configTypesPath);
  const aliasTexts = parseAliasTexts();
  const aliasMentions = parseAliasMentions(unionNames);
  const usesByUnion = new Map<string, EnumerationUse[]>(unionNames.map(name => [name, []]));

  const mentionedUnions = (type: string): string[] => {
    const direct = unionNames.filter(name => new RegExp(`\\b${name}\\b`).test(type));
    const viaAlias = [...aliasMentions.entries()]
      .filter(([alias]) => new RegExp(`\\b${alias}\\b`).test(type))
      .flatMap(([, names]) => names);
    return [...new Set([...direct, ...viaAlias])];
  };

  // `stack` holds the interfaces on the current path, so a self-referential shape cannot recurse forever.
  const visit = (parsed: ParsedInterface, sectionId: string, pathKeys: string[], stack: string[], substitutions: Record<string, string>) => {
    for (const member of allMembers(parsed, interfaces)) {
      const keys = [...pathKeys, member.key];
      const memberType = substituteTypeParameters(member.type, substitutions);
      const nested = memberInterface(memberType, interfaces, aliasTexts);
      if (nested !== undefined) {
        if (!stack.includes(nested.parsed.name)) visit(nested.parsed, sectionId, keys, [...stack, nested.parsed.name], nested.substitutions);
        continue;
      }
      for (const name of mentionedUnions(memberType)) {
        const label = sectionId + '.' + keys.join('.');
        const section = configModel.sections.find(candidate => candidate.id === sectionId);
        if (section === undefined || findProperty(section.properties, keys) === undefined) {
          integrityErrors.push(`${name} is used by ${label}, which the config reference model does not document`);
          continue;
        }
        const uses = usesByUnion.get(name) ?? [];
        // an interface redeclaring an inherited member (valueAxes.max) is one use
        if (!uses.some(use => use.label === label)) uses.push({ label, link: '/reference/' + sectionId + '#' + label });
      }
    }
  };
  for (const [sectionId, interfaceName] of Object.entries(sectionInterfaceMap)) {
    const parsed = interfaces.get(interfaceName);
    if (parsed === undefined) {
      integrityErrors.push(`interface ${interfaceName} for section ${sectionId} not found in types/config.ts`);
      continue;
    }
    visit(parsed, sectionId, [], [parsed.name], {});
  }

  const entries: EnumerationDoc[] = Object.keys(descriptions)
    .filter(name => unions.has(name))
    .map(name => {
      const values = resolveValues(unions.get(name) as ts.TypeNode, unions, integrityErrors, name);
      const usedBy = usesByUnion.get(name) ?? [];
      if (values.length === 0) integrityErrors.push(`${name} resolves to no values`);
      if (usedBy.length === 0) integrityErrors.push(`${name} is used by no config member in types/config.ts`);
      return { name, description: descriptions[name] ?? '', values: [...new Set(values)], usedBy };
    });

  return {
    page: { id: ENUMERATIONS_PAGE_ID, title: 'Enumerated values', lead, entries },
    integrityErrors
  };
}
