import validators from './validators';
import getTruncationValidators from './truncationConfig';

import { NONE, POSITIONS, ALIGNS, VERTICAL_ALIGNS } from '../core/constants';

// A prefix or suffix box: partial like every nested config; extras pass for the unknown-key walk.
const affix = () => validators.partialObjectWithShape({
  text: validators.string().orEqual(NONE),
  margin: validators.margin(),
  padding: validators.padding(),
  backgroundStyle: validators.style(),
  textStyle: validators.style()
}, true);

export default function getValidators() {
  return {
    text: validators.string().orEqual(NONE),
    position: validators.oneOf(POSITIONS),
    link: validators.string().orEqual(NONE),
    linkDisabled: validators.boolean(),
    truncation: validators.partialObjectWithShape(getTruncationValidators(), true),
    alignedToAxes: validators.boolean(),
    align: validators.oneOf(ALIGNS),
    verticalAlign: validators.oneOf(VERTICAL_ALIGNS),
    verticalExpand: validators.boolean(),
    margin: validators.margin(),
    padding: validators.padding(),
    textMargin: validators.margin(),
    textPadding: validators.padding(),
    backgroundStyle: validators.style(),
    textBackgroundStyle: validators.style(),
    textStyle: validators.style(),
    prefix: affix(),
    suffix: affix()
  };
}