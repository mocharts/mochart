// CodeMirror-free entry (`@mochart/editor/json`), so a host can apply the editor's JSON rules without loading the editor itself.
export {
  findDuplicateJsonKeys, formatJsonPath, duplicateJsonKeyMessage, JsonDuplicateKeyError, parseJson
} from './jsonDuplicateKeys.js';
export type { DuplicateJsonKey } from './jsonDuplicateKeys.js';
export type { JsonPath } from './types.js';
