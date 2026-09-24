import {
  NONE, CAP_TYPES
} from '../core/constants.js';
import validators from './validators.js';

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