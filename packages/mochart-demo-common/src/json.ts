import { JsonDuplicateKeyError, parseJson } from '@mochart/editor/json';
import { demoText } from './demoText';

export { parseJson };

/** The footer message for a failed `parseJson`: repeated keys name themselves (same text as the editor's diagnostic), anything else is plain invalid JSON. */
export function getJsonErrorMessage(error: unknown): string {
  return error instanceof JsonDuplicateKeyError ? error.message : demoText.errors.invalidJson;
}

/** The message for text that does not parse (or repeats a key), or null when it does. */
export function getJsonError(text: string): string | null {
  try {
    parseJson(text);
    return null;
  }
  catch (error) {
    return getJsonErrorMessage(error);
  }
}
