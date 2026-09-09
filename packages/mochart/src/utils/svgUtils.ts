import { path } from 'd3-path';

export function getCutoutRectanglePath(x: number, y: number, width: number, height: number, cx: number, cy: number, cwidth: number, cheight: number): string {
  const pathGenerator = path();
  pathGenerator.moveTo(x, y);
  pathGenerator.lineTo(x + width, y);
  pathGenerator.lineTo(x + width, y + height);
  pathGenerator.lineTo(x, y + height);
  pathGenerator.closePath();
  pathGenerator.moveTo(cx, cy);
  pathGenerator.lineTo(cx + cwidth, cy);
  pathGenerator.lineTo(cx + cwidth, cy + cheight);
  pathGenerator.lineTo(cx, cy + cheight);
  pathGenerator.closePath();

  return "" + pathGenerator;
}

export function getClipPathReference(clipPathId: string): string {
  return `url(#${clipPathId})`;
}

export function getGradientReference(gradientId: string): string {
  return `url(#${gradientId})`;
}

export function getPatternReference(patternId: string): string {
  return `url(#${patternId})`;
}
