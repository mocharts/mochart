import { describe, expect, it } from 'vitest';
import { JsonDuplicateKeyError, findDuplicateJsonKeys, formatJsonPath, parseJson } from '../src/json';

describe('duplicate JSON keys', () => {
  it('finds nothing in unique-keyed documents', () => {
    expect(findDuplicateJsonKeys('{"a": 1, "b": {"a": 2}, "c": [{"a": 3}, {"a": 4}]}')).toEqual([]);
    expect(findDuplicateJsonKeys('[1, "x", {"k": "v"}]')).toEqual([]);
    expect(findDuplicateJsonKeys('')).toEqual([]);
  });

  it('reports every later occurrence with its container path and name-token offsets', () => {
    const text = '{"a": 1, "a": 2, "s": [{"p": "x", "q": ",\\":", "p": "y"}], "a": 3}';
    const duplicates = findDuplicateJsonKeys(text);
    expect(duplicates.map(duplicate => [duplicate.key, duplicate.path, text.slice(duplicate.from, duplicate.to)])).toEqual([
      ['a', [], '"a"'],
      ['p', ['s', 0], '"p"'],
      ['a', [], '"a"']
    ]);
    expect(duplicates[0].from).toBe(text.indexOf('"a"', 2));
    expect(duplicates[2].from).toBe(text.lastIndexOf('"a"'));
  });

  it('compares decoded keys and ignores strings used as values', () => {
    expect(findDuplicateJsonKeys('{"\\u0061": 1, "a": 2}')).toHaveLength(1);
    expect(findDuplicateJsonKeys('{"a": "a", "b": "b", "c": ["a", "b"]}')).toEqual([]);
  });

  it('formats paths the way the diagnostics name them', () => {
    expect(formatJsonPath([])).toBe('');
    expect(formatJsonPath(['series', 0, 'property'])).toBe('series[0].property');
    expect(formatJsonPath([2, 'x'])).toBe('[2].x');
    expect(formatJsonPath(['a.b', 'x'])).toBe('["a.b"].x');
    expect(formatJsonPath(['', 'x'])).toBe('[""].x');
    expect(formatJsonPath(['a[0]'])).toBe('["a[0]"]');
    expect(formatJsonPath(['a b', 'c-d'])).toBe('["a b"]["c-d"]');
    expect(formatJsonPath(['say "hi"'])).toBe('["say \\"hi\\""]');
  });

  it('parses like JSON.parse but throws a SyntaxError listing the repeats', () => {
    expect(parseJson('{"a": [1, 2]}')).toEqual({ a: [1, 2] });
    expect(() => parseJson('{')).toThrow(SyntaxError);
    let error: unknown;
    try {
      parseJson('{"chart": {}, "series": [{"property": "a", "property": "b"}], "chart": {}}');
    }
    catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(JsonDuplicateKeyError);
    expect(error).toBeInstanceOf(SyntaxError);
    expect((error as JsonDuplicateKeyError).message).toBe('Duplicate key "property" in series[0]; Duplicate key "chart"');
    expect((error as JsonDuplicateKeyError).duplicates.map(duplicate => duplicate.key)).toEqual(['property', 'chart']);
  });
});
