import validators from './validators';
import { DOMAIN_CHANGES, EASINGS } from '../core/constants';

export default function getValidators() {
  return {
    enabled: validators.boolean(),
    valueDomainChange: validators.oneOf(DOMAIN_CHANGES),
    categoryDomainChange: validators.oneOf(DOMAIN_CHANGES),
    initialDuration: validators.numberMin(0),
    expansionDuration: validators.numberMin(0),
    valueChangeDuration: validators.numberMin(0),
    contractionDuration: validators.numberMin(0),
    easing: validators.oneOf(EASINGS),
    focusDuration: validators.numberMin(0),
    focusEasing: validators.oneOf(EASINGS)
  };
}
