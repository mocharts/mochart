import { ELLIPSIS } from '../core/constants';

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
