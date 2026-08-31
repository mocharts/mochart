import { AUTO, DOMAIN_CHANGE_STAGED, EASING_SINE_IN_OUT, EASING_CUBIC_OUT } from '../core/constants';

export default function getDefaults() {
  return {
    enabled: true,
    valueDomainChange: AUTO,
    categoryDomainChange: DOMAIN_CHANGE_STAGED,
    initialDuration: 1000,
    expansionDuration: 1000,
    valueChangeDuration: 1000,
    contractionDuration: 1000,
    easing: EASING_SINE_IN_OUT,
    focusDuration: 1000,
    focusEasing: EASING_CUBIC_OUT
  };
}