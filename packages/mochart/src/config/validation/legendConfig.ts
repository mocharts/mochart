import validators from './validators.js';
import getSeriesIconValidators from './seriesIconConfig.js';
import getTruncationValidators from './truncationConfig.js';
import { ALIGNS, POSITIONS } from '../core/constants.js';

export default function getValidators() {
  return {
    visible: validators.boolean(),
    position: validators.oneOf(POSITIONS),
    truncation: validators.partialObjectWithShape({
      ...getTruncationValidators(),
      maxFraction: validators.numberMinMax(0, 1)
    }, true),
    alignedToAxes: validators.boolean(),
    align: validators.oneOf(ALIGNS),
    margin: validators.margin(),
    padding: validators.padding(),
    backgroundStyle: validators.style(),
    item: validators.partialObjectWithShape({
      margin: validators.margin(),
      padding: validators.padding(),
      backgroundStyle: validators.style(),
      textStyle: validators.style(),
      font: validators.font()
    }, true),
    icon: validators.partialObjectWithShape(getSeriesIconValidators(), true),
    strikeThroughFiltered: validators.boolean(),
    focusOnHover: validators.boolean(),
    focusOnClick: validators.boolean(),
    filterOnClick: validators.boolean()
  };
}
