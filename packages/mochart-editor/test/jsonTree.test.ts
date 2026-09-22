import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { pathAt, pathResolves, rangeForPath } from '../src/jsonTree';

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
    expect(pathResolves(single, ['series', 0, 'axis'])).toBe(true);
  });

  // Regression: a segment of the wrong kind for its node kept that node and reported the path resolved, so a
  // property absent because its container is a scalar lost its required label and was ranged on the scalar
  it('reports a segment that does not apply to its node as unresolved', () => {
    const scalar = EditorState.create({ doc: '{"chart": 5, "series": [[1]]}', extensions: [json()] });
    expect(pathResolves(scalar, ['chart', 'type'])).toBe(false);
    expect(pathResolves(scalar, ['chart', 0])).toBe(false);
    expect(pathResolves(scalar, ['series', 0, 0])).toBe(true);
    expect(pathResolves(scalar, ['series', 0, 0, 'x'])).toBe(false);
  });
});
