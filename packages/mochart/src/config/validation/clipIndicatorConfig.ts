import validators from './validators';
import { AUTO, NONE } from '../core/constants';

export default function getValidators() {
  return {
    visible: validators.boolean(),
    size: validators.numberMin(0).orEqual(AUTO),
    labelPadding: validators.numberMin(0),
    label: validators.string().orEqual(NONE),
    textStyle: validators.style(),
    style: validators.style(),
    hatch: validators.partialObjectWith(['spacing', 'lineWidth'], validators.numberMin(0)).orEqual(NONE),
    front: validators.boolean()
  };
}
