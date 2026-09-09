import { gradientStops } from './shared';

export default function getDescriptions() {
  return {
    id: 'the unique identifier for the gradient so that it can be referenced for use',
    ignore: 'whether to ignore this radial gradient and treat it as though it were not specified',
    cx: 'the cx center x position of the svg radial gradient, as a fraction (0 - 1) of the shape bounds',
    cy: 'the cy center y position of the svg radial gradient, as a fraction (0 - 1) of the shape bounds',
    fx: 'the fx focal x position of the svg radial gradient, as a fraction (0 - 1) of the shape bounds',
    fy: 'the fy focal y position of the svg radial gradient, as a fraction (0 - 1) of the shape bounds',
    r: 'the r radius of the svg radial gradient, as a fraction (0 - 1) of the shape bounds',
    rotation: 'the rotation (in degrees, -360 to 360) applied to the svg radial gradient',
    stops: gradientStops('the list of svg gradient stops, each placing a color at a position along the gradient (at least one stop must be given)')
  };
}