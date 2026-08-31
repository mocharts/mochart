import validators from './validators';

import type { Validator } from '@mochart/movalid';

// The TruncationConfig members, the `truncation` group of the title, legend and axis validators.
// The category axis takes a conditional validator for `enabled`, so it is a parameter.
export default function getValidators(enabled: Validator = validators.boolean()): Record<string, Validator> {
  return {
    enabled,
    text: validators.string(),
    tooltipEnabled: validators.boolean()
  };
}
