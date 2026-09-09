import validators from './validators';
import getSeriesIconValidators from './seriesIconConfig';
import getTruncationValidators from './truncationConfig';
import { ALIGNS, POSITIONS } from '../core/constants';

export default function getValidators() {
  return {
    visible: validators.boolean(),
    position: validators.oneOf(POSITIONS),
    truncation: validators.partialObjectWithShape(getTruncationValidators(), true),
    alignedToAxes: validators.boolean(),
    align: validators.oneOf(ALIGNS),
    margin: validators.margin(),
    padding: validators.padding(),
    backgroundStyle: validators.style(),
    item: validators.partialObjectWithShape({
      margin: validators.margin(),
      padding: validators.padding(),
      backgroundStyle: validators.style(),
      textStyle: validators.style()
    }, true),
    icon: validators.partialObjectWithShape(getSeriesIconValidators(), true),
    strikeThroughFiltered: validators.boolean(),
    focusOnHover: validators.boolean(),
    focusOnClick: validators.boolean(),
    filterOnClick: validators.boolean()
  };
}
