import { NONE } from '../core/constants';

/** Every font member starts null: the text keeps the host page's css until a config sets a member. */
export function getFontDefaults() {
  return { family: NONE, size: NONE, weight: NONE, style: NONE };
}
