import validators from './validators';

export default function getValidators() {
  return {
    id: validators.id(),
    ignore: validators.boolean(),
    cx: validators.numberMinMax(0, 1),
    cy: validators.numberMinMax(0, 1),
    fx: validators.numberMinMax(0, 1),
    fy: validators.numberMinMax(0, 1),
    r: validators.numberMinMax(0, 1),
    rotation: validators.numberMinMax(-360, 360),
    stops: validators.arrayOf(validators.objectWithShape({
      offset: validators.numberMinMax(0, 1),
      color: validators.color(),
      opacity: validators.numberMinMax(0, 1)
    }))
  };
}