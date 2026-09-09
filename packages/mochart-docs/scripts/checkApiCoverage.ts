// Checks that the public API is documented. Five ratchets, matching how the
// pieces of the reference are produced:
//
// - chart props, callbacks, and payload fields must appear in the generated
//   api-reference model (the generator itself fails when a member has no
//   JSDoc or its interface has no page group, so this is the backstop for a
//   member quietly moving to an undocumented interface);
// - public exports from core's index.ts — values and named types alike, in
//   any export syntax, resolved through the TypeScript checker — must appear
//   in a docs page's code (a span or fenced block, so a word in prose is not
//   mistaken for a reference). Exports declared under src/types/ are the
//   exception: that surface is the generated config reference / the .d.ts;
// - `ChartHandle` methods must appear in a docs page as a call —
//   `` `name(` `` — so renaming a method breaks the check;
// - @mochart/export's and @mochart/editor's exports (checker-resolved, like
//   core's) must appear in a docs page's code too (the binding packages are
//   covered by the framework-props generator). The editor's model.ts types
//   are the exception: that surface is the shipped .d.ts;
// - the non-JS surface — core's and the editor's subpath exports (the
//   optional stylesheets) and the IIFE script-tag artifact — must be
//   mentioned in a docs page.
//
// Names that are deliberately undocumented go in `undocumented` below, with a
// reason. Usage: tsx scripts/checkApiCoverage.ts (run `npm run gen` first).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(scriptDir, '..');
const corePackageDir = path.join(docsDir, '..', 'mochart');
const coreSrcDir = path.join(corePackageDir, 'src');
const apiModelPath = path.join(corePackageDir, 'generated', 'api-reference.json');

// Documented interfaces come from the generated model's group interface names; a list here could only drift.

// name → why it needs no documentation.
const undocumented: Record<string, string> = {
  // conventional and read by tooling rather than imported, so there is nothing for a page to say
  '@mochart/core/package.json': 'manifest subpath, exported so tooling can read it; not a documented API',
  'sectionKeyAllMap': 'section→*Defaults key lookup consumed by the docs generator and coverage tooling; not a documented API'
};

const docsGlobs = ['guide', 'reference', 'recipes'];

interface ApiReferenceModel {
  pages: { groups: { interfaceName: string; properties: { key: string }[] }[] }[];
  enumerations: { entries: { name: string }[] };
}

function readDocsText(): string {
  const files: string[] = [path.join(docsDir, 'index.md')];
  for (const dir of docsGlobs) {
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.md')) files.push(full);
      }
    };
    walk(path.join(docsDir, dir));
  }
  return files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

// The documented interfaces, the members documented for them, and the
// enumerated-value types the generated enumerations page names.
function readApiReference(): { propInterfaces: string[]; propKeys: Set<string>; enumerationNames: Set<string> } {
  if (!fs.existsSync(apiModelPath)) {
    console.error(`✗ ${apiModelPath} not found — run "npm run gen" first`);
    process.exit(1);
  }
  const model = JSON.parse(fs.readFileSync(apiModelPath, 'utf8')) as ApiReferenceModel;
  const interfaceNames = new Set<string>();
  const propKeys = new Set<string>();
  for (const page of model.pages) {
    for (const group of page.groups) {
      interfaceNames.add(group.interfaceName);
      for (const property of group.properties) {
        propKeys.add(property.key);
      }
    }
  }
  if (interfaceNames.size === 0) {
    console.error(`✗ ${apiModelPath} declares no interface groups — the prop check would be vacuous`);
    process.exit(1);
  }
  return { propInterfaces: [...interfaceNames], propKeys, enumerationNames: new Set(model.enumerations.entries.map(entry => entry.name)) };
}

/**
 * Every export of the module at `entryPath`, resolved through the TypeScript
 * checker so the syntax cannot create blind spots: brace re-exports, inline
 * declarations, `export * from`, and `export type *` all land in the
 * module's export table. Each name carries the files its (alias-resolved)
 * declarations live in, so callers can exempt whole surfaces by path.
 */
function moduleExports(entryPath: string): { name: string; declarationFiles: string[] }[] {
  const program = ts.createProgram([entryPath], {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    customConditions: ['development'],
    skipLibCheck: true
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryPath);
  const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    console.error(`✗ could not resolve the module at ${entryPath}`);
    process.exit(1);
  }
  const exports = checker.getExportsOfModule(moduleSymbol).map(symbol => {
    const resolved = (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
    return {
      name: symbol.name,
      declarationFiles: (resolved.declarations ?? []).map(declaration => declaration.getSourceFile().fileName)
    };
  });
  if (exports.length === 0) {
    console.error(`✗ found no exports at ${entryPath} — the coverage check would be vacuous`);
    process.exit(1);
  }
  return exports.sort((a, b) => a.name.localeCompare(b.name));
}

const memberPrograms = new Map<string, ts.SourceFile>();
const memberCheckers = new Map<string, ts.TypeChecker>();

/** Every member an interface offers, inherited ones included, read from the AST so formatting cannot hide one. */
function interfaceMemberNames(filePath: string, interfaceName: string): string[] {
  let sourceFile = memberPrograms.get(filePath);
  if (sourceFile === undefined) {
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      customConditions: ['development'],
      skipLibCheck: true
    });
    sourceFile = program.getSourceFile(filePath);
    if (sourceFile === undefined) {
      console.error(`✗ could not read ${filePath}`);
      process.exit(1);
    }
    memberCheckers.set(filePath, program.getTypeChecker());
    memberPrograms.set(filePath, sourceFile);
  }
  const checker = memberCheckers.get(filePath)!;
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName) {
      return checker.getPropertiesOfType(checker.getTypeAtLocation(statement)).map(member => member.name);
    }
  }
  console.error(`✗ interface ${interfaceName} not found in ${path.basename(filePath)}`);
  process.exit(1);
}

/** Code spans and fenced blocks only: an api name mentioned in prose is not a reference to it. */
function readDocsCode(text: string): string {
  return [...text.matchAll(/```[\s\S]*?```/g), ...text.matchAll(/`[^`\n]+`/g)].map(match => match[0]).join('\n');
}

const docsText = readDocsText();
const docsCode = readDocsCode(docsText);
const documentedInCode = (name: string) => new RegExp(`\\b${name}\\b`).test(docsCode);
const { propInterfaces, propKeys: documentedPropKeys, enumerationNames } = readApiReference();
const chartTypesPath = path.join(coreSrcDir, 'types', 'chart.ts');
const createChartPath = path.join(coreSrcDir, 'createChart.ts');

const missing: { kind: string; name: string; where: string }[] = [];
// keyed by owner as well as name, so a shared name cannot let one kind's laxer rule stand in for another's
const seen = new Set<string>();
const seenNames = new Set<string>();

function check(kind: string, name: string, documented: boolean, where: string) {
  if (seen.has(kind + ' ' + name)) return;
  seen.add(kind + ' ' + name);
  seenNames.add(name);
  if (name in undocumented || documented) return;
  missing.push({ kind, name, where });
}

for (const interfaceName of propInterfaces) {
  for (const member of interfaceMemberNames(chartTypesPath, interfaceName)) {
    check(interfaceName, member, documentedPropKeys.has(member), 'the api-reference model');
  }
}
for (const member of interfaceMemberNames(createChartPath, 'ChartHandle')) {
  check('ChartHandle', member, docsText.includes('`' + member + '('), 'any docs page as a `' + member + '(…)` call');
}
// Types declared under src/types are the `export type *` wildcard surface —
// the generated config reference / shipped .d.ts, not docs-page material.
const coreTypesDir = path.join(coreSrcDir, 'types') + path.sep;
for (const { name, declarationFiles } of moduleExports(path.join(coreSrcDir, 'index.ts'))) {
  if (declarationFiles.length > 0 && declarationFiles.every(file => file.startsWith(coreTypesDir))) continue;
  check('export', name, enumerationNames.has(name) || documentedInCode(name), 'any docs page or the enumerations page');
}
for (const { name } of moduleExports(path.join(docsDir, '..', 'mochart-export', 'src', 'index.ts'))) {
  check('@mochart/export', name, documentedInCode(name), 'any docs page');
}
// The editor's model.ts types are the generated-model surface — the shipped
// .d.ts, not docs-page material.
const editorPackageDir = path.join(docsDir, '..', 'mochart-editor');
const editorModelPath = path.join(editorPackageDir, 'src', 'model.ts');
for (const { name, declarationFiles } of moduleExports(path.join(editorPackageDir, 'src', 'index.ts'))) {
  if (declarationFiles.length > 0 && declarationFiles.every(file => file === editorModelPath)) continue;
  check('@mochart/editor', name, documentedInCode(name), 'any docs page');
}

// Non-JS surface: subpath exports (the optional stylesheet) and the IIFE
// script-tag artifact.
const corePackageJson = JSON.parse(fs.readFileSync(path.join(corePackageDir, 'package.json'), 'utf8')) as { exports?: Record<string, unknown> };
for (const subpath of Object.keys(corePackageJson.exports ?? {})) {
  if (subpath === '.') continue;
  const specifier = '@mochart/core' + subpath.slice(1);
  check('subpath export', specifier, docsText.includes(specifier), 'any docs page');
}
const editorPackageJson = JSON.parse(fs.readFileSync(path.join(editorPackageDir, 'package.json'), 'utf8')) as { exports?: Record<string, unknown> };
for (const subpath of Object.keys(editorPackageJson.exports ?? {})) {
  if (subpath === '.') continue;
  const specifier = '@mochart/editor' + subpath.slice(1);
  check('subpath export', specifier, docsText.includes(specifier), 'any docs page');
}
const viteConfigSource = fs.readFileSync(path.join(corePackageDir, 'vite.config.ts'), 'utf8');
const iifeArtifact = /'([\w.-]+\.iife\.js)'/.exec(viteConfigSource)?.[1];
if (iifeArtifact === undefined) {
  console.error('✗ could not find the IIFE artifact name in core vite.config.ts');
  process.exit(1);
}
check('script-tag artifact', iifeArtifact, docsText.includes(iifeArtifact), 'any docs page');

const stale = Object.keys(undocumented).filter(name => !seenNames.has(name));

if (missing.length > 0) {
  console.error('✗ undocumented public API — document it, or add it to `undocumented` with a reason:\n');
  for (const { kind, name, where } of missing) {
    console.error(`    ${name}  (${kind}) — not in ${where}`);
  }
}
if (stale.length > 0) {
  console.error('\n✗ stale `undocumented` entries — these names no longer exist:\n');
  for (const name of stale) {
    console.error(`    ${name}`);
  }
}
if (missing.length > 0 || stale.length > 0) {
  process.exit(1);
}

console.log(`✓ all ${seenNames.size} public exports and chart props are documented`);
