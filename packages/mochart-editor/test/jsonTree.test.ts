import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { pathAt, rangeForPath } from '../src/jsonTree';

const source = `{
  "series": [
    { "property": "revenue", "axis": "money" }
  ]
}`;

function state() {
  return EditorState.create({ doc: source, extensions: [json()] });
}

describe('JSON tree paths', () => {
  it('finds paths through objects and arrays', () => {
    const position = source.indexOf('"money"') + 2;
    expect(pathAt(state(), position)).toEqual(['series', 0, 'axis']);
  });

  it('maps a path back to its JSON value', () => {
    const range = rangeForPath(state(), ['series', 0, 'axis']);
    expect(source.slice(range.from, range.to)).toBe('"money"');
  });

  // Regression: a segment missing from the document kept the last resolved node, so an absent
  // property was ranged over its whole containing entry
  it('ranges an absent property on the opening brace of its container', () => {
    const range = rangeForPath(state(), ['series', 0, 'missing']);
    expect(range).toEqual({ from: source.indexOf('{ "property"'), to: source.indexOf('{ "property"') + 1 });
    const entry = rangeForPath(state(), ['series', 1]);
    expect(source.slice(entry.from, entry.to)).toBe('[');
  });

  it('reads an index against a single-object section as that object', () => {
    const single = EditorState.create({ doc: '{"series": {"axis": "money"}}', extensions: [json()] });
    const range = rangeForPath(single, ['series', 0, 'axis']);
    expect(single.doc.sliceString(range.from, range.to)).toBe('"money"');
  });
});
