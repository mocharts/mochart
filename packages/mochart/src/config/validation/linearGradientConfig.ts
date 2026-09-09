import validators from './validators';

export default function getValidators() {
  return {
    id: validators.id(),
    ignore: validators.boolean(),
    x1: validators.numberMinMax(0, 1),
    x2: validators.numberMinMax(0, 1),
    y1: validators.numberMinMax(0, 1),
    y2: validators.numberMinMax(0, 1),
    rotation: validators.numberMinMax(-360, 360),
    stops: validators.arrayOf(validators.objectWithShape({
      offset: validators.numberMinMax(0, 1),
      color: validators.color(),
      opacity: validators.numberMinMax(0, 1)
    }))
  };
}