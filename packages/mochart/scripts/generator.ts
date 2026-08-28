// CLI for the config reference docs: builds the model (configReferenceModel.ts), writes
// generated/config-reference.json for the docs site, and renders a standalone html page on request.
// Exits non-zero when the config docs sources have mismatched keys.
// Usage: tsx scripts/generator.ts [htmlPath] [jsonPath] [apiJsonPath] — paths default into <package> regardless of cwd.

import {
  buildConfigReference,
  type ConfigReferenceModel,
  type DefaultValue,
  type PropertyDoc,
  type SectionDoc,
  type TopLevelKeyDoc
} from './configReferenceModel';
import { buildApiReference } from './apiReferenceModel';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- HTML rendering ----------------------------------------------------------

function htmlHeader(): string {
  return [
    '<html>',
    '<head>',
    '<title>Mochart Config Docs</title>',
    '<style>',
    'table { border-collapse: collapse !important; }',
    'table th { text-align: left; }',
    'table td, table th { background-color: #fff !important; border: 1px solid #eceeef !important; padding: .75rem; vertical-align: top; }',
    'table thead th { vertical-align: bottom; border-bottom: 2px solid #eceeef; }',
    'table thead td { border-bottom-width: 2px; }',
    '.colorIcon { display: inline-block; vertical-align: middle; width: 8px; height: 8px; border: 2px solid #eceeef; }',
    '</style>',
    '</head>',
    '<body>',
    ''
  ].join('\n');
}

function htmlFooter(): string {
  return '</body>\n</html>';
}

function tags(tag: string, contents: string[]): string {
  return contents.map(content => '<' + tag + '>' + content + '</' + tag + '>').join('') + '\n';
}

function colorIcon(color: string): string {
  return '<span class="colorIcon" style="background-color: ' + color + '"></span>';
}

function renderDefaultValue(value: DefaultValue): string {
  switch (value.kind) {
    case 'color':
      return colorIcon(value.color);
    case 'colors':
      return value.colors.map(colorIcon).join('');
    case 'literal':
      return value.text;
    case 'none':
      return '';
  }
}

function renderPropertyDefault(property: PropertyDoc): string {
  if (property.required) {
    return '<div>required</div>\n';
  }
  if (property.conditionalDefaults) {
    return property.conditionalDefaults.map(conditional =>
      '<div>' + renderDefaultValue(conditional.value) + ' (' + conditional.condition + ')' + '</div>\n'
    ).join('');
  }
  return '<div>' + renderDefaultValue(property.default ?? { kind: 'none' }) + '</div>\n';
}

function renderRules(rules: string[]): string {
  if (rules.length === 1) {
    return rules[0];
  }
  return rules.map(rule => '<p>' + rule + '</p>\n').join('');
}

function renderDescription(property: PropertyDoc): string {
  return property.details
    ? property.description + '<br/><br/>' + property.details
    : property.description;
}

function renderTopLevelRow(doc: TopLevelKeyDoc): string {
  const link = doc.sectionId ? '<a href="#' + doc.sectionId + '">Details</a>' : '';
  let row = '<tr>\n';
  if (doc.allKey) {
    row += tags('td', [
      doc.key + '<br/>' + doc.allKey,
      doc.description + '<br/>' + doc.allDescription,
      renderRules(doc.rules) + '<br/>' + renderRules(doc.allRules ?? []),
      doc.defaultText + '<br/>' + (doc.allDefaultText ?? ''),
      link
    ]);
  }
  else {
    row += tags('td', [doc.key, doc.description, renderRules(doc.rules), doc.defaultText, link]);
  }
  row += '</tr>\n';
  return row;
}

function renderTopLevel(topLevel: TopLevelKeyDoc[]): string {
  let out = '<div>\n<h2>Mochart Config</h2>\n<table>\n<thead>\n<tr>\n';
  out += tags('th', ['Property', 'Description', 'Validation Rules', 'Default', 'Details']);
  out += '</tr>\n</thead>\n';
  for (const doc of topLevel) {
    out += renderTopLevelRow(doc);
  }
  out += '</table>\n</div>\n';
  return out;
}

// a member's anchor extends its parent's, matching the docs site
function renderPropertyRows(sectionId: string, property: PropertyDoc, parentPath: string[], parentLabels: string[] = []): string {
  const path = [...parentPath, property.key];
  const labels = [...parentLabels, property.key];
  // members of an array element are labelled `stops[].offset`, while the id keeps the plain dotted path
  const childLabels = [...parentLabels, property.key + (property.itemShape === true ? '[]' : '')];
  const keyId = sectionId + '.' + path.join('.');
  const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(parentPath.length);
  let out = '<tr id="' + keyId + '">\n';
  out += tags('td', [
    indent + '<a href="#' + keyId + '">' + labels.join('.') + '</a>',
    renderDescription(property),
    renderRules(property.rules),
    renderPropertyDefault(property)
  ]);
  out += '</tr>\n';
  for (const nested of property.properties ?? []) {
    out += renderPropertyRows(sectionId, nested, path, childLabels);
  }
  return out;
}

function renderSection(section: SectionDoc): string {
  let out = '<div id="' + section.id + '">\n';
  out += '<h2>' + section.title + '</h2>\n';
  out += '<table>\n<thead>\n<tr>\n';
  out += tags('th', ['Property', 'Description', 'Validation Rules', 'Default']);
  out += '</tr>\n</thead>\n';
  for (const property of section.properties) {
    out += renderPropertyRows(section.id, property, []);
  }
  out += '</table>\n</div>\n';
  return out;
}

export function renderHtml(model: ConfigReferenceModel): string {
  let out = htmlHeader();
  out += renderTopLevel(model.topLevel);
  for (const section of model.sections) {
    out += renderSection(section);
  }
  out += htmlFooter();
  return out;
}

// --- CLI ---------------------------------------------------------------------

function writeFileEnsuringDir(filename: string, contents: string) {
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filename, contents);
}

/** The site renders the json models; the standalone html is only written when a path is asked for. */
export default function generateDocs(htmlPath: string | null, jsonPath: string, apiJsonPath: string): boolean {
  // both models are built before anything is written: a failing run must leave the
  // previous artifacts in place rather than half-regenerated ones the checks rejected
  const { model, integrityErrors } = buildConfigReference();
  const api = buildApiReference(model);

  let valid = true;
  if (integrityErrors.length > 0) {
    console.error('config docs sources are out of sync:');
    for (const error of integrityErrors) {
      console.error('  - ' + error);
    }
    valid = false;
  }
  if (api.integrityErrors.length > 0) {
    console.error('api docs sources are out of sync:');
    for (const error of api.integrityErrors) {
      console.error('  - ' + error);
    }
    valid = false;
  }
  if (!valid) {
    return false;
  }

  writeFileEnsuringDir(jsonPath, JSON.stringify(model, null, 2) + '\n');
  if (htmlPath !== null) {
    writeFileEnsuringDir(htmlPath, renderHtml(model));
  }
  writeFileEnsuringDir(apiJsonPath, JSON.stringify(api.model, null, 2) + '\n');
  return valid;
}

const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const htmlPath = process.argv[2] ?? null;
  const jsonPath = process.argv[3] ?? path.join(packageDir, 'generated', 'config-reference.json');
  const apiJsonPath = process.argv[4] ?? path.join(packageDir, 'generated', 'api-reference.json');
  if (!generateDocs(htmlPath, jsonPath, apiJsonPath)) {
    process.exitCode = 1;
  }
}
