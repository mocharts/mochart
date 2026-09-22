import { ensureSyntaxTree, getIndentation, indentString, syntaxTree } from '@codemirror/language';
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

/** True when the nearest container around `position` is an array, so the slot holds an entry rather than a member value. */
export function inArraySlot(state: EditorState, position: number): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  while (node && node.name !== 'Object' && node.name !== 'Array') node = node.parent;
  return node?.name === 'Array';
}

export function objectPath(state: EditorState, object: SyntaxNode): JsonPath {
  return pathAt(state, Math.min(object.to - 1, object.from + 1));
}

// A key parsed into a member's error node: while a member lacks its comma the parser folds the next
// member's name in as an error, and that key is still one the object has.
function foldedKeys(state: EditorState, property: SyntaxNode): string[] {
  const keys: string[] = [];
  for (const child of children(property)) {
    if (!child.type.isError) continue;
    try {
      const value = JSON.parse(state.sliceDoc(child.from, child.to)) as unknown;
      if (typeof value === 'string') keys.push(value);
    }
    catch {
      // not a quoted key
    }
  }
  return keys;
}

export function existingObjectKeys(state: EditorState, object: SyntaxNode): string[] {
  return children(object)
    .filter(child => child.name === 'Property')
    .flatMap(child => [propertyKey(state, child), ...foldedKeys(state, child)])
    .filter((key): key is string => key !== null);
}

/** The property-name token the cursor is in, and whether its member already carries a colon (so a completion renames rather than inserts). */
export function propertyNameAt(state: EditorState, position: number): { from: number; to: number; hasColon: boolean } | null {
  const node = syntaxTree(state).resolveInner(position, -1);
  if (node.name !== 'PropertyName' || !node.parent) return null;
  // a colon further along belongs to a following member the parser folded in while the comma is still missing
  const hasColon = node.nextSibling?.name === ':';
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

/** The deepest node the path reaches; `resolved` is false when a segment is missing from its container. */
function nodeForPath(state: EditorState, path: JsonPath): { node: SyntaxNode | null; resolved: boolean } {
  let node: SyntaxNode | null = syntaxTree(state).topNode.firstChild;
  for (const segment of path) {
    if (!node) break;
    if (typeof segment === 'number' && node.name === 'Array') {
      const value = arrayValues(node)[segment];
      if (!value) return { node, resolved: false };
      node = value;
    }
    else if (typeof segment === 'string' && node.name === 'Object') {
      const property = children(node).find(child => child.name === 'Property' && propertyKey(state, child) === segment);
      if (!property) return { node, resolved: false };
      node = propertyValue(property) ?? property;
    }
    // an index against an object stays put: core reads a single-object section as its entry 0
  }
  return { node, resolved: true };
}

/** True when every segment of `path` is present in the document. */
export function pathResolves(state: EditorState, path: JsonPath): boolean {
  return nodeForPath(state, path).resolved;
}

/** The range of the value at `path`, or the opening bracket of the container an absent segment belongs in. */
export function rangeForPath(state: EditorState, path: JsonPath): { from: number; to: number } {
  const { node, resolved } = nodeForPath(state, path);
  if (!node) return { from: 0, to: Math.min(1, state.doc.length) };
  return { from: node.from, to: resolved ? Math.max(node.from + 1, node.to) : node.from + 1 };
}

/** The range of `key`'s name token inside the object at `path`; falls back to that object's range. */
export function keyRangeForPath(state: EditorState, path: JsonPath, key: string): { from: number; to: number } {
  const { node: object, resolved } = nodeForPath(state, path);
  if (resolved && object?.name === 'Object') {
    const property = children(object).find(child => child.name === 'Property' && propertyKey(state, child) === key);
    const name = property ? children(property).find(child => child.name === 'PropertyName') : undefined;
    if (name) return { from: name.from, to: Math.max(name.from + 1, name.to) };
  }
  return rangeForPath(state, path);
}

export interface FormattedDocument {
  text: string;
  /** Where an offset in the source lands in the formatted text: the same place in the same token, or right after the token before it. */
  mapOffset: (offset: number) => number;
}

/** The indentation string JSON.stringify makes of its space argument: at most ten spaces, or a string's first ten characters. */
function indentationUnit(indentation: number | string): string {
  if (typeof indentation === 'string') return indentation.slice(0, 10);
  const count = Math.min(10, Math.trunc(indentation) || 0);
  return count < 1 ? '' : ' '.repeat(count);
}

/**
 * The document laid out the way JSON.stringify(value, null, indentation) lays it out, with every string, number,
 * true, false and null copied from the source as written, so formatting changes whitespace outside strings only
 * and no literal is reserialised. Null when the document does not parse into a single value.
 */
export function formatDocument(state: EditorState, indentation: number | string): FormattedDocument | null {
  const length = state.doc.length;
  const tree = ensureSyntaxTree(state, length, 5000) ?? syntaxTree(state);
  const root = children(tree.topNode).find(child => valueNames.has(child.name));
  if (!root || tree.topNode.to < length) return null;
  let hasError = false;
  tree.iterate({ enter: node => { if (node.type.isError) hasError = true; } });
  if (hasError) return null;
  const source = state.doc.toString();
  const unit = indentationUnit(indentation);
  // an empty unit lays the document out on one line with no separators, as JSON.stringify does
  const separator = (level: number) => unit === '' ? '' : '\n' + unit.repeat(level);
  const parts: string[] = [];
  const tokens: { from: number; to: number; newFrom: number }[] = [];
  let newLength = 0;
  const emit = (text: string, from: number | null) => {
    if (from !== null) tokens.push({ from, to: from + text.length, newFrom: newLength });
    parts.push(text);
    newLength += text.length;
  };
  const punctuation = (char: string, from: number) => emit(char, source[from] === char ? from : null);
  const commaBefore = (node: SyntaxNode) => {
    let at = node.from - 1;
    while (at >= 0 && /\s/.test(source[at]!)) at--;
    punctuation(',', at);
  };
  const emitValue = (node: SyntaxNode, level: number) => {
    if (node.name === 'Object' || node.name === 'Array') {
      const open = node.name === 'Object' ? '{' : '[';
      const close = node.name === 'Object' ? '}' : ']';
      const members = node.name === 'Object' ? children(node).filter(child => child.name === 'Property') : arrayValues(node);
      punctuation(open, node.from);
      if (members.length === 0) {
        punctuation(close, node.to - 1);
        return;
      }
      members.forEach((member, index) => {
        if (index > 0) commaBefore(member);
        emit(separator(level + 1), null);
        if (member.name === 'Property') {
          const name = children(member).find(child => child.name === 'PropertyName');
          const colon = children(member).find(child => child.name === ':');
          const value = propertyValue(member);
          if (!name || !value) throw new Error('property without a name or value');
          emit(source.slice(name.from, name.to), name.from);
          emit(':', colon ? colon.from : null);
          if (unit !== '') emit(' ', null);
          emitValue(value, level + 1);
        }
        else {
          emitValue(member, level + 1);
        }
      });
      emit(separator(level), null);
      punctuation(close, node.to - 1);
      return;
    }
    emit(source.slice(node.from, node.to), node.from);
  };
  try {
    emitValue(root, 0);
  }
  catch {
    return null;
  }
  const text = parts.join('');
  const mapOffset = (offset: number) => {
    let previous: { from: number; to: number; newFrom: number } | null = null;
    for (const token of tokens) {
      if (offset >= token.from && offset <= token.to) return token.newFrom + (offset - token.from);
      if (token.to <= offset) previous = token;
      else break;
    }
    return previous === null ? 0 : previous.newFrom + (previous.to - previous.from);
  };
  return { text, mapOffset };
}
