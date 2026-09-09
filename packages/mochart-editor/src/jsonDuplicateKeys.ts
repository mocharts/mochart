import type { JsonPath } from './types.js';

export interface DuplicateJsonKey {
  /** The repeated key, decoded. */
  key: string;
  /** Path of the object that repeats the key. */
  path: JsonPath;
  /** Source offsets of the later occurrence's name token. */
  from: number;
  to: number;
}

type Frame =
  { kind: 'object'; keys: Set<string>; key: string | null; expectKey: boolean } |
  { kind: 'array'; index: number };

/** Keys repeated within one object, one entry per later occurrence. Meant for text that already parses; other text yields best-effort results. */
export function findDuplicateJsonKeys(text: string): DuplicateJsonKey[] {
  const duplicates: DuplicateJsonKey[] = [];
  const stack: Frame[] = [];
  const currentPath = (): JsonPath => stack.slice(0, -1).map(frame => frame.kind === 'object' ? frame.key ?? '' : frame.index);
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      const from = i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
      const top = stack[stack.length - 1];
      if (top?.kind === 'object' && top.expectKey) {
        const token = text.slice(from, i);
        let key: string;
        try {
          key = JSON.parse(token) as string;
        }
        catch {
          key = token.slice(1, -1);
        }
        if (top.keys.has(key)) duplicates.push({ key, path: currentPath(), from, to: i });
        else top.keys.add(key);
        top.key = key;
        top.expectKey = false;
      }
      continue;
    }
    if (char === '{') stack.push({ kind: 'object', keys: new Set(), key: null, expectKey: true });
    else if (char === '[') stack.push({ kind: 'array', index: 0 });
    else if (char === '}' || char === ']') stack.pop();
    else if (char === ',') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'object') top.expectKey = true;
      else if (top?.kind === 'array') top.index++;
    }
    i++;
  }
  return duplicates;
}

/** Keys a dot can join unambiguously; anything else is bracketed and quoted, the way JSON writes it. */
const plainKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** `series[0].property` style rendering of a path; the empty path is the document root. */
export function formatJsonPath(path: JsonPath): string {
  return path.reduce<string>((text, segment) => {
    if (typeof segment === 'number') return `${text}[${segment}]`;
    if (!plainKey.test(segment)) return `${text}[${JSON.stringify(segment)}]`;
    return text ? `${text}.${segment}` : segment;
  }, '');
}

export function duplicateJsonKeyMessage(duplicate: DuplicateJsonKey): string {
  const container = formatJsonPath(duplicate.path);
  return duplicate.path.length > 0 ? `Duplicate key "${duplicate.key}" in ${container}` : `Duplicate key "${duplicate.key}"`;
}

/** Thrown by `parseJson` for text that parses but repeats a key within one object. */
export class JsonDuplicateKeyError extends SyntaxError {
  readonly duplicates: readonly DuplicateJsonKey[];

  constructor(duplicates: readonly DuplicateJsonKey[]) {
    super(duplicates.map(duplicateJsonKeyMessage).join('; '));
    this.name = 'JsonDuplicateKeyError';
    this.duplicates = duplicates;
  }
}

/** `JSON.parse` that also rejects keys repeated within one object, instead of silently keeping the last one. */
export function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const duplicates = findDuplicateJsonKeys(text);
  if (duplicates.length > 0) throw new JsonDuplicateKeyError(duplicates);
  return value;
}
