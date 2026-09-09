// The four tier-1 oracles' primitives: a canonical DOM serialization for comparison, a geometry scan
// for impossible attribute values, and a deep compare that reports where two objects diverge.
// Only the leaf ChartDom module is imported here — the library entry must load after the clock.
import { mochartVersionAttribute } from '../../src/utils/ChartDom';

const UNIQUE_ID_PREFIXES = [
  '__mochart__chart__', 'tooltip__clippath__', 'title__clippath__', 'legend__clippath__',
  'categoryaxistitle__clippath__', 'categoryaxisticklabel__clippath__', 'seriesaxistitle__clippath__',
  'series__clippath__', 'clipindicator__pattern__', 'linear__gradient__', 'radial__gradient__',
  'series__pattern__', 'seriescolor__gradient__'
];
const uniqueIdPattern = new RegExp('(' + UNIQUE_ID_PREFIXES.join('|') + ')(\\d+)', 'g');

/**
 * Line-per-node serialization with attributes sorted by name and the per-instance id counters
 * flattened. Two chart instances built from the same config must produce the same text — attribute
 * write order is not observable, so it must not be compared.
 */
export function serializeDom(root: Element): string {
  const lines: string[] = [];
  writeNode(root, lines);
  return lines.join('\n');
}

function writeNode(node: Node, lines: string[]): void {
  if (node.nodeType === 3) {
    const text = (node.nodeValue ?? '').trim();
    if (text.length > 0) {
      lines.push('"' + text.replace(uniqueIdPattern, '$1N') + '"');
    }
    return;
  }
  if (node.nodeType !== 1) {
    return;
  }
  const element = node as Element;
  const attributes = element.getAttributeNames()
    .filter(name => name !== mochartVersionAttribute)
    .sort()
    .map(name => name + '="' + (element.getAttribute(name) ?? '').replace(uniqueIdPattern, '$1N') + '"');
  lines.push('<' + element.tagName + (attributes.length > 0 ? ' ' + attributes.join(' ') : '') + '>');
  for (const child of node.childNodes) {
    writeNode(child, lines);
  }
  lines.push('</' + element.tagName + '>');
}

/** Attributes carrying geometry: a non-numeric value here is always a bug, never user text. */
const GEOMETRY_ATTRIBUTES = new Set([
  'd', 'transform', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'dx', 'dy',
  'width', 'height', 'r', 'rx', 'ry', 'offset', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'font-size', 'opacity', 'fill-opacity', 'stroke-opacity', 'viewBox'
]);

/** Attributes that cannot legitimately be negative. */
const NON_NEGATIVE_ATTRIBUTES = new Set(['width', 'height', 'r', 'rx', 'ry', 'stroke-width', 'font-size']);

const NUMERIC_JUNK = /\b(NaN|Infinity|-Infinity)\b/;
const MISSING_VALUE = /\b(undefined|null)\b/;

export interface GeometryIssue {
  /** Where in the tree, as a chain of tag names with the offending element last. */
  element: string;
  attribute: string;
  value: string;
  kind: 'numeric-junk' | 'missing-value' | 'negative' | 'text';
}

function describeElement(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && parts.length < 4) {
    const className = node.getAttribute('class');
    parts.unshift(node.tagName + (className ? '.' + className.split(' ')[0] : ''));
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/** Oracle 2: no NaN, Infinity, missing values or negative extents reached the rendered DOM. */
export function scanGeometry(root: Element): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of element.getAttributeNames()) {
      const value = element.getAttribute(attribute) ?? '';
      if (NUMERIC_JUNK.test(value)) {
        issues.push({ element: describeElement(element), attribute, value, kind: 'numeric-junk' });
        continue;
      }
      if (!GEOMETRY_ATTRIBUTES.has(attribute)) {
        continue;
      }
      if (MISSING_VALUE.test(value)) {
        issues.push({ element: describeElement(element), attribute, value, kind: 'missing-value' });
      }
      else if (NON_NEGATIVE_ATTRIBUTES.has(attribute) && parseFloat(value) < 0) {
        issues.push({ element: describeElement(element), attribute, value, kind: 'negative' });
      }
    }
    // a tick label formatted from a broken number reads as NaN on screen
    if (element.children.length === 0 && NUMERIC_JUNK.test(element.textContent ?? '')) {
      issues.push({ element: describeElement(element), attribute: '#text', value: element.textContent ?? '', kind: 'text' });
    }
  }
  return issues;
}

/** First differing lines of two serialized DOMs, trimmed to something a report can carry. */
export function diffSummary(expected: string, actual: string, maxLines = 6): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const lines: string[] = [];
  let differences = 0;
  for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
    if (expectedLines[i] === actualLines[i]) {
      continue;
    }
    differences++;
    if (lines.length < maxLines * 2) {
      lines.push('- ' + (expectedLines[i] ?? '<missing>').slice(0, 300));
      lines.push('+ ' + (actualLines[i] ?? '<missing>').slice(0, 300));
    }
  }
  if (differences > maxLines) {
    lines.push('… ' + (differences - maxLines) + ' further differing lines');
  }
  return lines.join('\n');
}

/** A stable one-line label for the first difference, so repeats of one bug group together. */
export function diffSignature(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
    if (expectedLines[i] === actualLines[i]) {
      continue;
    }
    const line = expectedLines[i] ?? actualLines[i] ?? '';
    const tag = /<\/?([a-zA-Z0-9:-]+)/.exec(line);
    const className = /class="([^" ]+)/.exec(line);
    return (tag ? tag[1] : 'text') + (className ? '.' + className[1] : '');
  }
  return 'none';
}

/**
 * Oracle 4: where an input object the caller owns diverged from its pre-call copy, or null when it
 * did not. Prototypes are ignored (the config is built from null-prototype objects, which a
 * structuredClone copy cannot reproduce) and cycles terminate on the pair already being compared.
 */
export function differencePath(before: unknown, after: unknown, path = '', seen = new WeakMap<object, WeakSet<object>>()): string | null {
  if (Object.is(before, after)) {
    return null;
  }
  if (typeof before !== 'object' || typeof after !== 'object' || before === null || after === null) {
    return path === '' ? '<root>' : path;
  }
  const compared = seen.get(before);
  if (compared?.has(after)) {
    return null;
  }
  if (compared) {
    compared.add(after);
  }
  else {
    seen.set(before, new WeakSet([after]));
  }
  if (Array.isArray(before) !== Array.isArray(after) || (Array.isArray(before) && before.length !== (after as unknown[]).length)) {
    return path === '' ? '<root>' : path;
  }
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])) {
    const difference = differencePath(beforeRecord[key], afterRecord[key], path === '' ? key : path + '.' + key, seen);
    if (difference !== null) {
      return difference;
    }
  }
  return null;
}
