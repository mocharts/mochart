// Regenerates JSDoc on the config interfaces in src/types/config.ts from the config-reference
// model, so hovers, the shipped .d.ts, and the reference docs share one source. Covered
// properties' JSDoc is replaced; properties without a model entry are left untouched.
// Usage: tsx scripts/generateJsdoc.ts [--check] — --check exits 1 on drift
// (the same ratchet is enforced by test/config/jsdocSync.test.ts).

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  buildConfigReference,
  type ConditionalDefaultValue,
  type DefaultValue,
  type PropertyDoc,
  type SectionDoc,
  type TopLevelKeyDoc
} from './configReferenceModel';

const packageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const typesPath = path.join(packageDir, 'src', 'types', 'config.ts');

const WRAP_COLUMN = 80;

interface MemberDoc {
  description: string;
  details?: string;
  /** Lines describing the default(s), already formatted (no tag). */
  defaultLines: string[];
  /** Set when the default can be a single @default tag. */
  defaultTag?: string;
}

// --- Model → per-interface member docs --------------------------------------

export const sectionInterfaceMap: Record<string, string> = {
  accessibility: 'AccessibilityConfig',
  animation: 'AnimationConfig',
  chart: 'ChartConfig',
  colorPalette: 'ColorPaletteConfig',
  clipIndicator: 'ClipIndicatorConfig',
  crosshair: 'CrosshairConfig',
  categoryAxis: 'CategoryAxisConfig',
  legend: 'LegendConfig',
  linearGradients: 'LinearGradientConfig',
  patterns: 'PatternConfig',
  pie: 'PieConfig',
  plot: 'PlotConfig',
  radialGradients: 'RadialGradientConfig',
  valueAxes: 'ValueAxisConfig',
  series: 'SeriesConfig',
  seriesGroups: 'SeriesGroupConfig',
  seriesStacks: 'SeriesStackConfig',
  title: 'TitleConfig',
  tooltip: 'TooltipConfig'
};

/** Interfaces that are the value of nested config properties rather than a section, documented from
 * one representative use of the shape. Defaults are left off: each using property documents its own. */
interface SharedInterfaceSource {
  interfaceName: string;
  sectionId: string;
  /** Dotted path to a use of the shape, e.g. `backgroundStyle` or `series.normal`. */
  propertyKey: string;
  /** The members this interface declares. Omit to take all of them; set it when the interface extends another. */
  members?: string[];
  /** Set for an array-element shape, whose entry defaults are the same wherever the shape is used. */
  includeDefaults?: boolean;
}

const sharedInterfaceSources: SharedInterfaceSource[] = [
  { interfaceName: 'StrokeStyle', sectionId: 'chart', propertyKey: 'backgroundStyle', members: ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'] },
  { interfaceName: 'Style', sectionId: 'chart', propertyKey: 'backgroundStyle', members: ['fillColor', 'fillOpacity'] },
  { interfaceName: 'StrokeStyleState', sectionId: 'categoryAxis', propertyKey: 'axisLine.style.normal', members: ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDashArray'] },
  { interfaceName: 'StyleState', sectionId: 'categoryAxis', propertyKey: 'tickLabel.textStyle.normal', members: ['fillColor', 'fillOpacity'] },
  { interfaceName: 'ColorPaletteStates', sectionId: 'colorPalette', propertyKey: 'shape' },
  { interfaceName: 'ColorPalette', sectionId: 'colorPalette', propertyKey: 'shape.normal' },
  { interfaceName: 'SeriesCurve', sectionId: 'series', propertyKey: 'curve' },
  { interfaceName: 'SeriesColorScale', sectionId: 'series', propertyKey: 'colorScale' },
  { interfaceName: 'SeriesColorScaleBase', sectionId: 'series', propertyKey: 'colorScale.base' },
  { interfaceName: 'SeriesBarConfig', sectionId: 'series', propertyKey: 'bar', includeDefaults: true },
  { interfaceName: 'SeriesCapConfig', sectionId: 'series', propertyKey: 'cap', includeDefaults: true },
  { interfaceName: 'SeriesErrorBarConfig', sectionId: 'series', propertyKey: 'errorBar', includeDefaults: true },
  { interfaceName: 'SeriesLabelConfig', sectionId: 'series', propertyKey: 'label', includeDefaults: true },
  { interfaceName: 'SeriesLabelBaseSideConfig', sectionId: 'series', propertyKey: 'label.aboveBase', includeDefaults: true },
  { interfaceName: 'SeriesMarkerConfig', sectionId: 'series', propertyKey: 'marker', includeDefaults: true },
  { interfaceName: 'SeriesStackOuterCapConfig', sectionId: 'seriesStacks', propertyKey: 'outerCap', includeDefaults: true },
  { interfaceName: 'ClipIndicatorHatchConfig', sectionId: 'clipIndicator', propertyKey: 'hatch' },
  { interfaceName: 'LegendItemConfig', sectionId: 'legend', propertyKey: 'item', includeDefaults: true },
  { interfaceName: 'SeriesIconBorderStyle', sectionId: 'legend', propertyKey: 'icon.borderStyle', includeDefaults: true },
  { interfaceName: 'TitleAffixConfig', sectionId: 'title', propertyKey: 'prefix' },
  { interfaceName: 'PieLabelConfig', sectionId: 'pie', propertyKey: 'label', includeDefaults: true },
  { interfaceName: 'PieTooltipConfig', sectionId: 'pie', propertyKey: 'tooltip', includeDefaults: true },
  { interfaceName: 'CrosshairLineConfig', sectionId: 'crosshair', propertyKey: 'categoryLine', includeDefaults: true },
  { interfaceName: 'PieCenterLabelConfig', sectionId: 'pie', propertyKey: 'centerLabel', includeDefaults: true },
  { interfaceName: 'PieCenterTotalConfig', sectionId: 'pie', propertyKey: 'centerTotal', includeDefaults: true },
  { interfaceName: 'TooltipDropShadowConfig', sectionId: 'tooltip', propertyKey: 'dropShadow', includeDefaults: true },
  { interfaceName: 'ThresholdConfig', sectionId: 'valueAxes', propertyKey: 'thresholds', includeDefaults: true },
  { interfaceName: 'ThresholdTitleConfig', sectionId: 'valueAxes', propertyKey: 'thresholds.title', includeDefaults: true },
  { interfaceName: 'AxisBaseLineConfig', sectionId: 'valueAxes', propertyKey: 'baseLine', includeDefaults: true },
  { interfaceName: 'ValueAxisTick', sectionId: 'valueAxes', propertyKey: 'ticks', includeDefaults: true },
  { interfaceName: 'GradientStop', sectionId: 'linearGradients', propertyKey: 'stops', includeDefaults: true }
];

/** Nested axis groups shared by the category axis and the value axes: members both axes have are
 * documented on the shared interface (with both defaults where they differ, like AxisConfigBase);
 * members only one axis has go on that axis's own extension of it. */
interface SharedAxisInterface {
  interfaceName: string;
  propertyKey: string;
  categoryInterfaceName?: string;
  valueInterfaceName?: string;
}

const sharedAxisInterfaces: SharedAxisInterface[] = [
  { interfaceName: 'AxisLineConfig', propertyKey: 'axisLine' },
  { interfaceName: 'AxisFocusRangeConfig', propertyKey: 'focusRange' },
  { interfaceName: 'AxisFocusTickMarkConfig', propertyKey: 'focusTickMark' },
  { interfaceName: 'AxisGridLineConfig', propertyKey: 'gridLine' },
  { interfaceName: 'AxisTickMarkConfig', propertyKey: 'tickMark' },
  { interfaceName: 'AxisTickLabelConfig', propertyKey: 'tickLabel', categoryInterfaceName: 'CategoryAxisTickLabelConfig', valueInterfaceName: 'ValueAxisTickLabelConfig' },
  { interfaceName: 'AxisTitleConfig', propertyKey: 'title' }
];

/** Interfaces several config sections share — extended by them, or (with propertyKey) held under one of
 * their nested properties — documented from those sections: the first supplies the prose, and any
 * section wording it differently has its wording documented alongside. */
interface SharedSectionInterface {
  interfaceName: string;
  /** The sections that share it, in the order their prose is documented. */
  sections: { id: string; name: string }[];
  members: string[];
  /** Dotted path to the nested property holding the shape; omit when the sections extend the interface. */
  propertyKey?: string;
}

const sharedSectionInterfaces: SharedSectionInterface[] = [
  {
    interfaceName: 'SeriesIconConfig',
    sections: [{ id: 'legend', name: 'legend' }, { id: 'tooltip', name: 'tooltip' }],
    propertyKey: 'icon',
    members: ['showColors', 'showShapes', 'showPlaceholders', 'size', 'spacing',
      'borderStyle', 'filteredColor', 'unfilteredColor']
  }
];

function findPropertyDoc(properties: Map<string, PropertyDoc> | undefined, propertyKey: string): PropertyDoc | undefined {
  const [head, ...rest] = propertyKey.split('.');
  let property = properties?.get(head!);
  for (const step of rest) {
    property = property?.properties?.find(member => member.key === step);
  }
  return property;
}

function defaultValueText(value: DefaultValue): string | undefined {
  switch (value.kind) {
    case 'color':
      return "'" + value.color + "'";
    case 'colors':
      return '[' + value.colors.map(color => "'" + color + "'").join(', ') + ']';
    case 'literal':
      return value.text;
    case 'none':
      return undefined;
  }
}

function conditionalDefaultLines(conditionals: ConditionalDefaultValue[]): string[] {
  const lines = ['Default:'];
  for (const conditional of conditionals) {
    const text = defaultValueText(conditional.value);
    lines.push('- `' + (text ?? 'none') + '` — ' + conditional.condition);
  }
  return lines;
}

function toMemberDoc(property: PropertyDoc, includeDefault = true): MemberDoc {
  const doc: MemberDoc = {
    description: upperFirst(property.description) + '.',
    defaultLines: []
  };
  if (property.details !== undefined) {
    doc.details = property.details;
  }
  if (!includeDefault) {
    return doc;
  }
  if (property.conditionalDefaults) {
    doc.defaultLines = conditionalDefaultLines(property.conditionalDefaults);
  }
  else {
    const text = defaultValueText(property.default ?? { kind: 'none' });
    if (text !== undefined) {
      doc.defaultTag = text;
    }
  }
  return doc;
}

function mergedAxisMemberDoc(categoryProperty: PropertyDoc, seriesProperty: PropertyDoc): MemberDoc {
  const doc: MemberDoc = {
    description: upperFirst(categoryProperty.description) + '.',
    defaultLines: []
  };
  const details = categoryProperty.details ?? seriesProperty.details;
  if (details !== undefined) {
    doc.details = details;
  }
  const categoryText = categoryProperty.conditionalDefaults
    ? undefined
    : defaultValueText(categoryProperty.default ?? { kind: 'none' });
  const seriesText = seriesProperty.conditionalDefaults
    ? undefined
    : defaultValueText(seriesProperty.default ?? { kind: 'none' });
  if (categoryProperty.conditionalDefaults || seriesProperty.conditionalDefaults) {
    if (categoryProperty.conditionalDefaults) {
      doc.defaultLines.push('Category axis defaults:');
      doc.defaultLines.push(...conditionalDefaultLines(categoryProperty.conditionalDefaults).slice(1));
    }
    else if (categoryText !== undefined) {
      doc.defaultLines.push('Category axis default: `' + categoryText + '`.');
    }
    if (seriesProperty.conditionalDefaults) {
      doc.defaultLines.push('Value axis defaults:');
      doc.defaultLines.push(...conditionalDefaultLines(seriesProperty.conditionalDefaults).slice(1));
    }
    else if (seriesText !== undefined) {
      doc.defaultLines.push('Value axis default: `' + seriesText + '`.');
    }
  }
  else if (categoryText === seriesText) {
    if (categoryText !== undefined) {
      doc.defaultTag = categoryText;
    }
  }
  else {
    if (categoryText !== undefined) {
      doc.defaultLines.push('Category axis default: `' + categoryText + '`.');
    }
    if (seriesText !== undefined) {
      doc.defaultLines.push('Value axis default: `' + seriesText + '`.');
    }
  }
  return doc;
}

/** The first section's prose, then any section wording it differently, then the default: one tag when the sections agree, a line each when they do not. */
function sharedSectionMemberDoc(entries: { name: string; property: PropertyDoc }[]): MemberDoc {
  const first = entries[0]!;
  const doc: MemberDoc = {
    description: upperFirst(first.property.description) + '.',
    defaultLines: []
  };
  const detailLines: string[] = [];
  const details = entries.map(entry => entry.property.details).find(detail => detail !== undefined);
  if (details !== undefined) {
    detailLines.push(details);
  }
  for (const entry of entries.slice(1)) {
    if (entry.property.description !== first.property.description) {
      detailLines.push('In ' + entry.name + ': ' + entry.property.description + '.');
    }
  }
  if (detailLines.length > 0) {
    doc.details = detailLines.join(' ');
  }
  const texts = entries.map(entry => entry.property.conditionalDefaults
    ? undefined
    : defaultValueText(entry.property.default ?? { kind: 'none' }));
  const allSimple = entries.every(entry => !entry.property.conditionalDefaults);
  if (allSimple && texts.every(text => text === texts[0])) {
    if (texts[0] !== undefined) {
      doc.defaultTag = texts[0];
    }
    return doc;
  }
  for (const [index, entry] of entries.entries()) {
    if (entry.property.conditionalDefaults) {
      doc.defaultLines.push(entry.name + ' defaults:');
      doc.defaultLines.push(...conditionalDefaultLines(entry.property.conditionalDefaults).slice(1));
    }
    else if (texts[index] !== undefined) {
      doc.defaultLines.push(entry.name + ' default: `' + texts[index] + '`.');
    }
  }
  return doc;
}

/** The two public config interfaces, documented from the top-level key descriptions rather than from a
 * section: the enhanced config carries the sections themselves, the input config also their `*Defaults`. */
const TOP_LEVEL_INTERFACES = { enhanced: 'MochartConfig', input: 'MochartInputConfig' };

function topLevelMemberDocs(topLevel: TopLevelKeyDoc[], includeAllKeys: boolean): Map<string, MemberDoc> {
  const memberDocs = new Map<string, MemberDoc>();
  for (const key of topLevel) {
    // version is hand-documented on each interface: the enhanced config says it is carried through
    // rather than defaulted, which the one model description cannot say for both
    if (key.key !== 'version') {
      memberDocs.set(key.key, { description: key.description, defaultLines: [] });
    }
    if (includeAllKeys && key.allKey !== undefined && key.allDescription !== undefined) {
      memberDocs.set(key.allKey, { description: key.allDescription, defaultLines: [] });
    }
  }
  return memberDocs;
}

function buildInterfaceDocs(sections: SectionDoc[], topLevel: TopLevelKeyDoc[], warnings: string[]): Map<string, Map<string, MemberDoc>> {
  const bySection = new Map<string, Map<string, PropertyDoc>>();
  for (const section of sections) {
    bySection.set(section.id, new Map(section.properties.map(property => [property.key, property])));
  }

  for (const sectionId of bySection.keys()) {
    if (sectionInterfaceMap[sectionId] === undefined) {
      warnings.push(sectionId + ': config section has no interface in sectionInterfaceMap');
    }
  }

  const interfaceDocs = new Map<string, Map<string, MemberDoc>>();
  for (const [sectionId, interfaceName] of Object.entries(sectionInterfaceMap)) {
    const properties = bySection.get(sectionId);
    if (!properties) {
      warnings.push(interfaceName + ': mapped from ' + sectionId + ', which is not a config section');
      continue;
    }
    const memberDocs = new Map<string, MemberDoc>();
    for (const [key, property] of properties) {
      memberDocs.set(key, toMemberDoc(property));
    }
    interfaceDocs.set(interfaceName, memberDocs);
  }

  interfaceDocs.set(TOP_LEVEL_INTERFACES.enhanced, topLevelMemberDocs(topLevel, false));
  interfaceDocs.set(TOP_LEVEL_INTERFACES.input, topLevelMemberDocs(topLevel, true));

  // AxisConfigBase holds the properties shared by the category axis and the
  // value axes; where their defaults differ, both are documented.
  const categoryProperties = bySection.get('categoryAxis');
  const seriesProperties = bySection.get('valueAxes');
  if (categoryProperties && seriesProperties) {
    const memberDocs = new Map<string, MemberDoc>();
    for (const [key, categoryProperty] of categoryProperties) {
      const seriesProperty = seriesProperties.get(key);
      if (seriesProperty) {
        memberDocs.set(key, mergedAxisMemberDoc(categoryProperty, seriesProperty));
      }
    }
    interfaceDocs.set('AxisConfigBase', memberDocs);

    for (const shared of sharedAxisInterfaces) {
      const categoryMembers = findPropertyDoc(categoryProperties, shared.propertyKey)?.properties ?? [];
      const valueMembers = findPropertyDoc(seriesProperties, shared.propertyKey)?.properties ?? [];
      const valueByKey = new Map(valueMembers.map(member => [member.key, member]));
      const sharedDocs = new Map<string, MemberDoc>();
      const categoryDocs = new Map<string, MemberDoc>();
      for (const categoryMember of categoryMembers) {
        const valueMember = valueByKey.get(categoryMember.key);
        if (valueMember) {
          sharedDocs.set(categoryMember.key, mergedAxisMemberDoc(categoryMember, valueMember));
        }
        else {
          categoryDocs.set(categoryMember.key, toMemberDoc(categoryMember));
        }
      }
      const valueDocs = new Map<string, MemberDoc>();
      for (const valueMember of valueMembers) {
        if (!categoryMembers.some(member => member.key === valueMember.key)) {
          valueDocs.set(valueMember.key, toMemberDoc(valueMember));
        }
      }
      interfaceDocs.set(shared.interfaceName, sharedDocs);
      if (shared.categoryInterfaceName !== undefined) {
        interfaceDocs.set(shared.categoryInterfaceName, categoryDocs);
      }
      else if (categoryDocs.size > 0) {
        warnings.push(shared.interfaceName + ': ' + [...categoryDocs.keys()].join(', ') + ' documented only at categoryAxis.' + shared.propertyKey);
      }
      if (shared.valueInterfaceName !== undefined) {
        interfaceDocs.set(shared.valueInterfaceName, valueDocs);
      }
      else if (valueDocs.size > 0) {
        warnings.push(shared.interfaceName + ': ' + [...valueDocs.keys()].join(', ') + ' documented only at valueAxes.' + shared.propertyKey);
      }
    }
  }

  for (const shared of sharedSectionInterfaces) {
    const memberDocs = new Map<string, MemberDoc>();
    for (const member of shared.members) {
      const entries: { name: string; property: PropertyDoc }[] = [];
      for (const section of shared.sections) {
        const property = shared.propertyKey === undefined
          ? bySection.get(section.id)?.get(member)
          : findPropertyDoc(bySection.get(section.id), shared.propertyKey + '.' + member);
        if (property) {
          entries.push({ name: section.name, property });
        }
        else {
          warnings.push(shared.interfaceName + '.' + member + ': not documented at ' + section.id);
        }
      }
      if (entries.length > 0) {
        memberDocs.set(member, sharedSectionMemberDoc(entries));
      }
    }
    interfaceDocs.set(shared.interfaceName, memberDocs);
  }

  for (const shared of sharedInterfaceSources) {
    const property = findPropertyDoc(bySection.get(shared.sectionId), shared.propertyKey);
    const nested = property?.properties;
    if (!nested || nested.length === 0) {
      warnings.push(shared.interfaceName + ': no nested properties documented at '
        + shared.sectionId + '.' + shared.propertyKey);
      continue;
    }
    const memberDocs = new Map<string, MemberDoc>();
    for (const member of nested) {
      if (shared.members !== undefined && !shared.members.includes(member.key)) {
        continue;
      }
      memberDocs.set(member.key, toMemberDoc(member, shared.includeDefaults === true));
    }
    for (const memberKey of shared.members ?? []) {
      if (!memberDocs.has(memberKey)) {
        warnings.push(shared.interfaceName + '.' + memberKey + ': not documented at '
          + shared.sectionId + '.' + shared.propertyKey);
      }
    }
    interfaceDocs.set(shared.interfaceName, memberDocs);
  }

  return interfaceDocs;
}

// --- Comment rendering -------------------------------------------------------

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line.length > 0 && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    }
    else {
      line = line.length > 0 ? line + ' ' + word : word;
    }
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

function renderComment(doc: MemberDoc, indent: string): string {
  const width = WRAP_COLUMN - indent.length - 3;
  const bodyLines: string[] = [];
  bodyLines.push(...wrap(doc.description, width));
  if (doc.details !== undefined) {
    bodyLines.push('');
    bodyLines.push(...wrap(doc.details, width));
  }
  if (doc.defaultLines.length > 0) {
    bodyLines.push('');
    for (const line of doc.defaultLines) {
      if (line.startsWith('- ')) {
        bodyLines.push(...wrap(line.slice(2), width - 2).map((wrapped, i) => (i === 0 ? '- ' : '  ') + wrapped));
      }
      else {
        bodyLines.push(...wrap(line, width));
      }
    }
  }
  if (doc.defaultTag !== undefined) {
    bodyLines.push('');
    bodyLines.push('@default ' + doc.defaultTag);
  }
  if (bodyLines.length === 1) {
    return indent + '/** ' + bodyLines[0] + ' */';
  }
  return indent + '/**\n'
    + bodyLines.map(line => indent + (' * ' + line).trimEnd()).join('\n')
    + '\n' + indent + ' */';
}

// --- Source rewriting --------------------------------------------------------

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

export function buildDocumentedTypesSource(source: string): { output: string; warnings: string[] } {
  const { model, integrityErrors } = buildConfigReference();
  // an out-of-sync model has holes (e.g. undefined descriptions) the doc builders cannot render
  if (integrityErrors.length > 0) {
    throw new Error('Cannot generate JSDoc, config docs sources are out of sync:\n  - ' + integrityErrors.join('\n  - '));
  }
  const warnings: string[] = [];
  const interfaceDocs = buildInterfaceDocs(model.sections, model.topLevel, warnings);

  const sourceFile = ts.createSourceFile('config.ts', source, ts.ScriptTarget.Latest, true);
  const edits: Edit[] = [];
  const usedKeys = new Map<string, Set<string>>();

  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) {
      continue;
    }
    const memberDocs = interfaceDocs.get(statement.name.text);
    if (!memberDocs) {
      continue;
    }
    let used = usedKeys.get(statement.name.text);
    if (!used) {
      usedKeys.set(statement.name.text, used = new Set());
    }
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || member.name === undefined || !ts.isIdentifier(member.name)) {
        continue;
      }
      const doc = memberDocs.get(member.name.text);
      if (!doc) {
        continue;
      }
      used.add(member.name.text);

      const memberStart = member.getStart(sourceFile);
      const lineStart = source.lastIndexOf('\n', memberStart - 1) + 1;
      const indent = source.slice(lineStart, memberStart);
      if (indent.trim().length > 0) {
        warnings.push(statement.name.text + '.' + member.name.text + ': unexpected inline layout, skipped');
        continue;
      }

      const commentRanges = ts.getLeadingCommentRanges(source, member.pos) ?? [];
      const jsdocRanges = commentRanges.filter(range => source.slice(range.pos, range.pos + 3) === '/**');
      let start = lineStart;
      if (jsdocRanges.length > 0) {
        const firstJsdoc = jsdocRanges[0]!;
        start = source.lastIndexOf('\n', firstJsdoc.pos) + 1;
      }
      edits.push({
        start,
        end: memberStart,
        replacement: renderComment(doc, indent) + '\n' + indent
      });
    }
  }

  // Shared axis properties are declared (and documented) on AxisConfigBase,
  // which CategoryAxisConfig and ValueAxisConfig extend.
  const axisBaseUsed = usedKeys.get('AxisConfigBase') ?? new Set();
  const axisConcreteUsed = new Set([
    ...(usedKeys.get('CategoryAxisConfig') ?? new Set<string>()),
    ...(usedKeys.get('ValueAxisConfig') ?? new Set<string>())
  ]);
  // the same holds for members a section declares on a shared interface it extends
  const sharedInherited = new Map<string, Set<string>>();
  for (const shared of sharedSectionInterfaces) {
    if (shared.propertyKey !== undefined) {
      continue;
    }
    for (const section of shared.sections) {
      const interfaceName = sectionInterfaceMap[section.id];
      if (interfaceName === undefined) {
        continue;
      }
      const members = sharedInherited.get(interfaceName) ?? new Set<string>();
      for (const member of shared.members) {
        members.add(member);
      }
      sharedInherited.set(interfaceName, members);
    }
  }
  for (const [interfaceName, memberDocs] of interfaceDocs) {
    const used = usedKeys.get(interfaceName) ?? new Set();
    const inherited = interfaceName === 'CategoryAxisConfig' || interfaceName === 'ValueAxisConfig'
      ? axisBaseUsed
      : interfaceName === 'AxisConfigBase' ? axisConcreteUsed : sharedInherited.get(interfaceName) ?? new Set<string>();
    for (const key of memberDocs.keys()) {
      if (!used.has(key) && !inherited.has(key)) {
        warnings.push(interfaceName + '.' + key + ': documented in the config model but not found in types/config.ts');
      }
    }
  }

  edits.sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  return { output, warnings };
}

// --- CLI ---------------------------------------------------------------------

const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const check = process.argv.includes('--check');
  const source = fs.readFileSync(typesPath, 'utf-8');
  const { output, warnings } = buildDocumentedTypesSource(source);
  for (const warning of warnings) {
    console.warn('warning: ' + warning);
  }
  if (check) {
    if (output !== source) {
      console.error('src/types/config.ts is out of date with the config docs — run "npm run generate-jsdoc -w @mochart/core"');
      process.exitCode = 1;
    }
    else {
      console.log('src/types/config.ts JSDoc is in sync');
    }
  }
  else if (output !== source) {
    fs.writeFileSync(typesPath, output);
    console.log('src/types/config.ts JSDoc regenerated');
  }
  else {
    console.log('src/types/config.ts JSDoc already in sync');
  }
}
