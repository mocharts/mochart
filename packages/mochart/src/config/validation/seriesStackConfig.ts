import {
  NONE, CAP_TYPES
} from '../core/constants';
import validators from './validators';

export default function getValidators() {
  return {
    axis: validators.string(),
    id: validators.id(),
    ignore: validators.boolean(),
    outerCap: validators.partialObjectWithShape({
      size: validators.numberMin(0),
      type: validators.oneOf(CAP_TYPES).orEqual(NONE),
      expand: validators.boolean()
    }, true),
  };
}