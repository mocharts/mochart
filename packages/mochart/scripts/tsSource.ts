// TypeScript-source readers shared by the docs generators: member names, type text, and JSDoc
// pulled straight from declaration files (not the type checker), so the reference shows the
// same spelling the source and the shipped .d.ts do.

import ts from 'typescript';
import fs from 'fs';

export interface ParsedMember {
  key: string;
  /** Source text of the type annotation. */
  type: string;
  optional: boolean;
  description: string;
}

export interface ParsedInterface {
  name: string;
  exported: boolean;
  /** Declared type parameter names, e.g. ['C', 'S'] for StyleState<C, S>. */
  typeParameters: string[];
  extendsNames: string[];
  members: ParsedMember[];
  /** Members the model cannot render — method signatures and computed names. */
  skippedMembers: string[];
}

export function readSourceFile(filePath: string): { text: string; sourceFile: ts.SourceFile } {
  const text = fs.readFileSync(filePath, 'utf-8');
  return { text, sourceFile: ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true) };
}

/** The JSDoc comment immediately above `node`, as markdown-ready text. */
export function jsDocText(text: string, node: ts.Node): string {
  const ranges = ts.getLeadingCommentRanges(text, node.pos) ?? [];
  const docRange = ranges.filter(range => text.slice(range.pos, range.pos + 3) === '/**').pop();
  if (docRange === undefined) {
    return '';
  }
  const lines = text
    .slice(docRange.pos, docRange.end)
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*/, '').trim());
  // JSDoc wraps at 80 columns, so wrapped lines rejoin into one paragraph;
  // blank lines stay paragraph breaks.
  return lines
    .join('\n')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.split('\n').join(' ').trim())
    .filter(paragraph => paragraph !== '')
    .join('\n\n')
    .replace(/\{@link\s+([^}]+)\}/g, '`$1`');
}

export function typeText(node: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string {
  return node === undefined ? 'unknown' : node.getText(sourceFile).replace(/\s+/g, ' ');
}

export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node)?.some(modifier => modifier.kind === kind) ?? false)
    : false;
}

/** Every interface declared in `filePath`, keyed by name, in source order. */
export function parseInterfaces(filePath: string): Map<string, ParsedInterface> {
  const { text, sourceFile } = readSourceFile(filePath);
  const interfaces = new Map<string, ParsedInterface>();

  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) {
      continue;
    }
    const extendsNames: string[] = [];
    for (const heritage of statement.heritageClauses ?? []) {
      for (const type of heritage.types) {
        extendsNames.push(type.expression.getText(sourceFile));
      }
    }
    const members: ParsedMember[] = [];
    const skippedMembers: string[] = [];
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || member.name === undefined || !ts.isIdentifier(member.name)) {
        const name = member.name !== undefined && ts.isIdentifier(member.name) ? member.name.text : member.getText(sourceFile).split('(')[0]!.trim();
        skippedMembers.push(name);
        continue;
      }
      members.push({
        key: member.name.text,
        type: typeText(member.type, sourceFile),
        optional: member.questionToken !== undefined,
        description: jsDocText(text, member)
      });
    }
    interfaces.set(statement.name.text, {
      name: statement.name.text,
      exported: hasModifier(statement, ts.SyntaxKind.ExportKeyword),
      typeParameters: (statement.typeParameters ?? []).map(parameter => parameter.name.text),
      extendsNames,
      members,
      skippedMembers
    });
  }
  return interfaces;
}
