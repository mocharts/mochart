import type { Bounds, Size } from '../types/geometry';
import type { LayoutInfo } from '../types/layout';

export function createLayoutInfo(categoryPosition: number, valuePosition: number, categoryExtent: number, valueExtent: number, inverted: boolean): LayoutInfo {
  const layoutInfo = {
    categoryPosition,
    valuePosition,
    categoryExtent,
    valueExtent,
    inverted
  } as LayoutInfo;
  if (inverted) {
    layoutInfo.x = valuePosition;
    layoutInfo.y = categoryPosition;
    layoutInfo.width = valueExtent;
    layoutInfo.height = categoryExtent;
  }
  else {
    layoutInfo.x = categoryPosition;
    layoutInfo.y = valuePosition;
    layoutInfo.width = categoryExtent;
    layoutInfo.height = valueExtent;
  }
  return layoutInfo;
}

export function createBoundsLayoutInfo(bounds: Bounds, inverted: boolean): LayoutInfo {
  const { x, y, width, height } = bounds;
  return createLayoutInfo(inverted ? y : x, inverted ? x : y, inverted ? height : width, inverted ? width : height, inverted);
}

export function layoutInfoExtentChanged(oldLayoutInfo: Size | null, newLayoutInfo: Size | null): boolean {
  if (oldLayoutInfo === newLayoutInfo) {
    return false;
  }
  else if (oldLayoutInfo === null || newLayoutInfo === null) {
    return true;
  }
  else {
    return oldLayoutInfo.width !== newLayoutInfo.width ||
           oldLayoutInfo.height !== newLayoutInfo.height;
  }
}
