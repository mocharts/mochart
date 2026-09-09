import { gradientStops } from './shared';

export default function getDescriptions() {
  return {
    id: 'the unique identifier for the gradient so that it can be referenced for use',
    ignore: 'whether to ignore this linear gradient and treat it as though it were not specified',
    x1: 'the x1 start position of the svg linear gradient, as a fraction (0 - 1) of the shape bounds',
    x2: 'the x2 end position of the svg linear gradient, as a fraction (0 - 1) of the shape bounds',
    y1: 'the y1 start position of the svg linear gradient, as a fraction (0 - 1) of the shape bounds',
    y2: 'the y2 end position of the svg linear gradient, as a fraction (0 - 1) of the shape bounds',
    rotation: 'the rotation (in degrees, -360 to 360) applied to the svg linear gradient',
    stops: gradientStops('the list of svg gradient stops, each placing a color at a position along the gradient (at least one stop must be given)')
  };
}