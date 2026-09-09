import type { Anchor } from '../config/core/constants';
import type { Bounds, Size } from '../types/geometry';

// Rotated bounds for axis tick labels; assumes centerY = height/2 and
// centerX per anchor: 'start' 0, 'middle' width/2, 'end' width.
export function getRotatedBounds(bounds: Size, angle: number, anchor: Anchor): Bounds {
  const angleRadians = angle * (Math.PI / 180);

  const boundsWidth = bounds.width;
  const boundsHeight = bounds.height;

  // cos(90°) is 6e-17, not 0: left as is, a corner lands at -6e-16 and the layout's floor makes that a whole pixel
  const cosAngle = snapZero(Math.cos(angleRadians));
  const sinAngle = snapZero(Math.sin(angleRadians));

  const boundsWidthCosAngle = boundsWidth * cosAngle;
  const boundsWidthSinAngle = boundsWidth * sinAngle;
  const boundsHeightCosAngle = boundsHeight * cosAngle;
  const boundsHeightSinAngle = boundsHeight * sinAngle;

  const rotatedBoundsWidth = Math.abs(boundsWidthCosAngle) + Math.abs(boundsHeightSinAngle);
  const rotatedBoundsHeight = Math.abs(boundsWidthSinAngle) + Math.abs(boundsHeightCosAngle);

  const boundsHalfHeight = boundsHeight / 2.0;
  const boundsHalfHeightCosAngle = boundsHalfHeight * cosAngle;
  const boundsHalfHeightSinAngle = boundsHalfHeight * sinAngle;

  let rotatedBoundsX = 0;
  let rotatedBoundsY = 0;
  if (anchor === 'start') {
    const rotatedTopLeftX = boundsHalfHeightSinAngle;
    const rotatedTopLeftY = - 1 * boundsHalfHeightCosAngle;
    const rotatedTopRightX = boundsWidthCosAngle + boundsHalfHeightSinAngle;
    const rotatedTopRightY = boundsWidthSinAngle - boundsHalfHeightCosAngle;
    const rotatedBottomLeftX = -1 * boundsHalfHeightSinAngle;
    const rotatedBottomLeftY = boundsHalfHeightCosAngle;
    const rotatedBottomRightX = boundsWidthCosAngle - boundsHalfHeightSinAngle;
    const rotatedBottomRightY = boundsWidthSinAngle + boundsHalfHeightCosAngle;
    rotatedBoundsX = Math.min(rotatedTopLeftX, rotatedTopRightX, rotatedBottomLeftX, rotatedBottomRightX);
    rotatedBoundsY = Math.min(rotatedTopLeftY, rotatedTopRightY, rotatedBottomLeftY, rotatedBottomRightY);
  }
  else if (anchor === 'middle') {
    rotatedBoundsX = -1 * rotatedBoundsWidth / 2.0;
    rotatedBoundsY = -1 * rotatedBoundsHeight / 2.0;
  }
  else if (anchor === 'end') {
    const rotatedTopLeftX = -1 * boundsWidthCosAngle + boundsHalfHeightSinAngle;
    const rotatedTopLeftY = -1 * boundsWidthSinAngle - boundsHalfHeightCosAngle;
    const rotatedTopRightX = boundsHalfHeightSinAngle;
    const rotatedTopRightY = - 1 * boundsHalfHeightCosAngle;
    const rotatedBottomLeftX = -1 * boundsWidthCosAngle - boundsHalfHeightSinAngle;
    const rotatedBottomLeftY = -1 * boundsWidthSinAngle + boundsHalfHeightCosAngle;
    const rotatedBottomRightX = - 1 * boundsHalfHeightSinAngle;
    const rotatedBottomRightY = boundsHalfHeightCosAngle;
    rotatedBoundsX = Math.min(rotatedTopLeftX, rotatedTopRightX, rotatedBottomLeftX, rotatedBottomRightX);
    rotatedBoundsY = Math.min(rotatedTopLeftY, rotatedTopRightY, rotatedBottomLeftY, rotatedBottomRightY);
  }
  return {
    x: rotatedBoundsX,
    y: rotatedBoundsY,
    width: rotatedBoundsWidth,
    height: rotatedBoundsHeight
  };
}

function snapZero(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function getRotatedZeroBounds(bounds: Size, anchor: Anchor): Bounds {
  const { width, height } = bounds;
  const y = height / - 2.0;
  const x = anchor === 'middle' ? (width / -2.0) : (anchor === 'start' ? 0 : (-1 * width));
  return { x, y, width, height };
}
