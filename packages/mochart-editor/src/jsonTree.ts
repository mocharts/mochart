import { getIndentation, indentString, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import type { JsonPath } from './types.js';

const valueNames = new Set(['Object', 'Array', 'String', 'Number', 'True', 'False', 'Null']);

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function propertyKey(state: EditorState, property: SyntaxNode): string | null {
  const name = children(property).find(child => child.name === 'PropertyName');
  if (!name) return null;
  try {
    return JSON.parse(state.sliceDoc(name.from, name.to)) as string;
  }
  catch {
    return state.sliceDoc(name.from, name.to).replace(/^"|"$/g, '');
  }
}

function propertyValue(property: SyntaxNode): SyntaxNode | null {
  return children(property).find(child => valueNames.has(child.name)) ?? null;
}

function arrayValues(array: SyntaxNode): SyntaxNode[] {
  return children(array).filter(child => valueNames.has(child.name));
}

export function pathAt(state: EditorState, position: number): JsonPath {
  const path: JsonPath = [];
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  if (node.name === 'Property') {
    // resolved to the member itself: past its colon with no value yet is that member's value slot
    const colon = children(node).find(child => child.name === ':');
    const key = colon && position > colon.from ? propertyKey(state, node) : null;
    if (key !== null) path.push(key);
  }
  while (node?.parent) {
    const parent: SyntaxNode = node.parent;
    if (parent.name === 'Property') {
      const key = propertyKey(state, parent);
      if (key !== null) path.unshift(key);
    }
    else if (parent.name === 'Array') {
      const values = arrayValues(parent);
      const index = values.findIndex(value => value.from <= node!.from && value.to >= node!.to);
      if (index >= 0) path.unshift(index);
    }
    node = parent;
  }
  return path;
}

export function containingObject(state: EditorState, position: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  while (node && node.name !== 'Object') node = node.parent;
  return node;
}

export function objectPath(state: EditorState, object: SyntaxNode): JsonPath {
  return pathAt(state, Math.min(object.to - 1, object.from + 1));
}

export function existingObjectKeys(state: EditorState, object: SyntaxNode): string[] {
  return children(object)
    .filter(child => child.name === 'Property')
    .map(child => propertyKey(state, child))
    .filter((key): key is string => key !== null);
}

/** The property-name token the cursor is in, and whether its member already carries a colon (so a completion renames rather than inserts). */
export function propertyNameAt(state: EditorState, position: number): { from: number; to: number; hasColon: boolean } | null {
  const node = syntaxTree(state).resolveInner(position, -1);
  if (node.name !== 'PropertyName' || !node.parent) return null;
  const hasColon = children(node.parent).some(child => child.name === ':');
  return { from: node.from, to: node.to, hasColon };
}

/** True when the cursor sits right after the closing quote of a complete property name. */
export function afterClosingPropertyQuote(state: EditorState, position: number): boolean {
  const name = propertyNameAt(state, position);
  if (!name || name.to !== position) return false;
  const text = state.sliceDoc(name.from, name.to);
  return text.length >= 2 && text.endsWith('"');
}

export function isPropertyPosition(state: EditorState, position: number, object: SyntaxNode): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  if (node.name === 'PropertyName') return true;
  while (node && node !== object) {
    if (node.name === 'Property') {
      // past the colon is the value slot even while the value is missing or still a parse error
      const colon = children(node).find(child => child.name === ':');
      return colon === undefined || position <= colon.from;
    }
    node = node.parent;
  }
  // find the last comma/colon outside string literals: raw indexOf would be
  // fooled by punctuation inside string values ("Sales, weekly")
  const prefix = state.sliceDoc(object.from + 1, position);
  let comma = -1;
  let colon = -1;
  let inString = false;
  for (let i = 0; i < prefix.length; i++) {
    const char = prefix[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    }
    else if (char === '"') inString = true;
    else if (char === ',') comma = i;
    else if (char === ':') colon = i;
  }
  return colon < comma || colon === -1;
}

/** The indentation for a member of `object`: an existing own-line member's, else the language's. */
export function memberIndentation(state: EditorState, object: SyntaxNode): string {
  for (let child = object.firstChild; child; child = child.nextSibling) {
    if (child.name !== 'Property') continue;
    const line = state.doc.lineAt(child.from);
    const indent = line.text.slice(0, child.from - line.from);
    if (!/\S/.test(indent)) return indent;
  }
  const columns = getIndentation(state, Math.min(object.from + 1, state.doc.length));
  return columns === null ? '' : indentString(state, columns);
}

function nodeForPath(state: EditorState, path: JsonPath): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).topNode.firstChild;
  for (const segment of path) {
    if (!node) break;
    if (typeof segment === 'number' && node.name === 'Array') {
      node = arrayValues(node)[segment] ?? node;
    }
    else if (typeof segment === 'string' && node.name === 'Object') {
      const property = children(node).find(child => child.name === 'Property' && propertyKey(state, child) === segment);
      node = property ? propertyValue(property) ?? property : node;
    }
  }
  return node;
}

export function rangeForPath(state: EditorState, path: JsonPath): { from: number; to: number } {
  const node = nodeForPath(state, path);
  return node ? { from: node.from, to: Math.max(node.from + 1, node.to) } : { from: 0, to: Math.min(1, state.doc.length) };
}

/** The range of `key`'s name token inside the object at `path`; falls back to that object's range. */
export function keyRangeForPath(state: EditorState, path: JsonPath, key: string): { from: number; to: number } {
  const object = nodeForPath(state, path);
  if (object?.name === 'Object') {
    const property = children(object).find(child => child.name === 'Property' && propertyKey(state, child) === key);
    const name = property ? children(property).find(child => child.name === 'PropertyName') : undefined;
    if (name) return { from: name.from, to: Math.max(name.from + 1, name.to) };
  }
  return rangeForPath(state, path);
}
