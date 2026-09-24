import { degreesToRadians } from '../data/PieData';
import type { PieConfig } from '../types/config';
import type { LayoutInfo } from '../types/layout';

export interface RadialLayoutInfo {
  /** The circle center x, relative to the series layout origin. */
  cx: number;
  /** The circle center y, relative to the series layout origin. */
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

interface UnitBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * The bounding box (in outer-radius units) of the pie's configured span: the
 * center, the span's two edge points, and every cardinal extreme it crosses.
 * A full circle yields [-1, 1] on both axes.
 */
function getSpanUnitBounds(startAngle: number, endAngle: number): UnitBounds {
  const from = Math.min(startAngle, endAngle);
  const to = Math.max(startAngle, endAngle);
  if (to - from >= 360) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }
  // angle 0 is up, clockwise: (sin, -cos) in SVG coordinates
  const points: [number, number][] = [[0, 0]];
  for (const angle of [from, to]) {
    const radians = degreesToRadians(angle);
    points.push([Math.sin(radians), -Math.cos(radians)]);
  }
  for (let cardinal = Math.ceil(from / 90) * 90; cardinal <= to; cardinal += 90) {
    const radians = degreesToRadians(cardinal);
    points.push([Math.sin(radians), -Math.cos(radians)]);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Fits the pie's configured span into the series rect: the span's bounding box
 * is scaled to fill the rect and centered, so partial pies use the space their
 * missing slices would waste. The span comes from the config, never the
 * current slice angles, so the layout holds still while values animate.
 * The box fitted and centred is the exploded one: a focused slice moves out along its mid-angle by
 * focusOffsetFraction of the outer radius, so the span's arc points scale by that factor while the
 * centre stays put, and the pie sits so that an exploded slice still stays inside the rect on any span.
 */
export function getRadialLayoutInfo(seriesLayoutInfo: LayoutInfo, pieConfig: PieConfig): RadialLayoutInfo {
  const { width, height } = seriesLayoutInfo;
  const bounds = getSpanUnitBounds(pieConfig.startAngle, pieConfig.endAngle);
  // the bounds always hold the centre (0, 0), so scaling each of them scales the arc points and leaves the centre alone
  const explodedExtent = 1 + pieConfig.focusOffsetFraction;
  const unitWidth = Math.max((bounds.maxX - bounds.minX) * explodedExtent, 1e-6);
  const unitHeight = Math.max((bounds.maxY - bounds.minY) * explodedExtent, 1e-6);
  const maxRadius = Math.max(Math.min(width / unitWidth, height / unitHeight), 0);
  const outerRadius = maxRadius * pieConfig.outerRadiusFraction;
  const innerRadius = outerRadius * pieConfig.innerRadiusFraction;
  return {
    cx: width / 2 - outerRadius * explodedExtent * (bounds.minX + bounds.maxX) / 2,
    cy: height / 2 - outerRadius * explodedExtent * (bounds.minY + bounds.maxY) / 2,
    innerRadius,
    outerRadius
  };
}
