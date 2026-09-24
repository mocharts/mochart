import { ELLIPSIS } from '../core/constants.js';

export function getRegularDefaults() {
  return {
    enabled: true,
    ...getDefaultsWithoutEnabled()
  };
}

export function getDefaultsWithoutEnabled() {
  return {
    text: ELLIPSIS,
    tooltipEnabled: true
  };
}
