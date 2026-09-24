import validators from './validators.js';


export default function getValidators() {
  return {
    visible: validators.boolean(),
    applyFocus: validators.boolean(),
    categoryLine: validators.partialObjectWithShape({ visible: validators.boolean(), style: validators.strokeStyle() }, true),
    seriesLine: validators.partialObjectWithShape({ visible: validators.boolean(), style: validators.strokeStyle() }, true),
    showBehindTooltip: validators.boolean()
  };
}