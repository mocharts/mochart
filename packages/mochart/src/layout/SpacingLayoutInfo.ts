import { createBoundsLayoutInfo } from './LayoutInfo';
import type { Bounds, MarginPadding } from '../types/geometry';
import type { SpacingBoundsInput, SpacingLayoutInfo } from '../types/layout';

export const emptyMarginPadding: MarginPadding = { top: 0, right: 0, bottom: 0, left: 0 };
export const emptyInnerOuter = 0;
export const getAll = (accessor: (marginPadding: MarginPadding) => number, margin?: MarginPadding, padding?: MarginPadding): number => Math.ceil((margin ? accessor(margin) : 0) + (padding ? accessor(padding) : 0));
export const getLeft = ({ left }: MarginPadding): number => left;
export const getSpacingLeft = (margin?: MarginPadding, padding?: MarginPadding): number => getAll(getLeft, margin, padding);
export const getLeftRight = ({ left, right }: MarginPadding): number => Math.ceil(left + right);
export const getTop = ({ top }: MarginPadding): number => top;
export const getSpacingTop = (margin?: MarginPadding, padding?: MarginPadding): number => getAll(getTop, margin, padding);
export const getTopBottom = ({ top, bottom }: MarginPadding): number => Math.ceil(top + bottom);
export const getSpacingWidth = (margin?: MarginPadding, padding?: MarginPadding): number => getAll(getLeftRight, margin, padding);
export const getOuterWidth = (width: number, margin?: MarginPadding, padding?: MarginPadding): number => Math.ceil(width + getSpacingWidth(margin, padding));
export const getInnerWidth = (width: number, margin?: MarginPadding, padding?: MarginPadding): number => Math.ceil(width - getSpacingWidth(margin, padding));
export const getSpacingOuterWidth = ({ width }: { width: number }, margin?: MarginPadding, padding?: MarginPadding): number => getOuterWidth(width, margin, padding);
export const getSpacingInnerWidth = ({ width }: { width: number }, margin?: MarginPadding, padding?: MarginPadding): number => getInnerWidth(width, margin, padding);
export const getSpacingHeight = (margin?: MarginPadding, padding?: MarginPadding): number => getAll(getTopBottom, margin, padding);
export const getOuterHeight = (height: number, margin?: MarginPadding, padding?: MarginPadding): number => Math.ceil(height + getSpacingHeight(margin, padding));
export const getInnerHeight = (height: number, margin?: MarginPadding, padding?: MarginPadding): number => Math.ceil(height - getSpacingHeight(margin, padding));
export const getSpacingOuterHeight = ({ height }: { height: number }, margin?: MarginPadding, padding?: MarginPadding): number => getOuterHeight(height, margin, padding);
export const getSpacingInnerHeight = ({ height }: { height: number }, margin?: MarginPadding, padding?: MarginPadding): number => getInnerHeight(height, margin, padding);
export const getMaxSpacingHeight = (max: number, bounds: { height: number }, margin?: MarginPadding, padding?: MarginPadding): number => Math.max(max, getSpacingOuterHeight(bounds, margin, padding));
export const getRelativeBounds = ({ x, y }: { x: number; y: number }, innerBounds: Bounds): Bounds => ({ ...innerBounds, x: Math.floor(innerBounds.x - x), y: Math.floor(innerBounds.y - y) });

export function getSpacingOuterBounds(bounds: SpacingBoundsInput, margin?: MarginPadding, padding: MarginPadding = emptyMarginPadding): Bounds {
  const { x = 0, y = 0 } = bounds;
  return {
    x: x - getSpacingLeft(margin, padding),
    y: y - getSpacingTop(margin, padding),
    width: getSpacingOuterWidth(bounds, margin, padding),
    height: getSpacingOuterHeight(bounds, margin, padding)
  }
}

export function getSpacingInnerBounds(bounds: SpacingBoundsInput, margin?: MarginPadding, padding: MarginPadding = emptyMarginPadding): Bounds {
  const { x = 0, y = 0 } = bounds;
  return {
    x: x + getSpacingLeft(margin, padding),
    y: y + getSpacingTop(margin, padding),
    width: Math.max(0, getSpacingInnerWidth(bounds, margin, padding)),
    height: Math.max(0, getSpacingInnerHeight(bounds, margin, padding))
  }
}

export function createSpacingLayoutInfo(bounds: SpacingBoundsInput, margin: MarginPadding = emptyMarginPadding, padding: MarginPadding = emptyMarginPadding, inner = true): SpacingLayoutInfo {
  bounds = { ...bounds, width: Math.max(0, bounds.width), height: Math.max(0, bounds.height) };
  const { width, height } = bounds;
  const spacious = width > 0 && height > 0;
  const marginBounds = inner ? spacious ? getSpacingInnerBounds(bounds, margin) : bounds : getSpacingOuterBounds(bounds, padding);
  const paddingBounds = inner ? spacious ? getSpacingInnerBounds(bounds, margin, padding) : bounds : bounds;
  bounds = inner ? bounds : getSpacingOuterBounds(bounds, margin, padding);
  const marginRelativeBounds = getRelativeBounds(bounds, marginBounds);
  const paddingRelativeBounds = getRelativeBounds(bounds, paddingBounds);
  return {
    ...bounds,
    marginBounds,
    marginRelativeBounds,
    paddingBounds,
    paddingRelativeBounds
  };
}

export function createInvertedSpacingLayoutInfo(bounds: Bounds, inverted: boolean, margin: MarginPadding = emptyMarginPadding, padding: MarginPadding = emptyMarginPadding): SpacingLayoutInfo {
  return createSpacingLayoutInfo(createBoundsLayoutInfo(bounds, inverted), margin, padding);
}

export function createInnerOuterSpacingLayoutInfo(bounds: Bounds, vertical: boolean, inverted: boolean, before: boolean, marginInner: number = emptyInnerOuter, marginOuter: number = emptyInnerOuter, paddingInner: number = emptyInnerOuter, paddingOuter: number = emptyInnerOuter): SpacingLayoutInfo {
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  if (vertical) {
    if (before) {
      margin.left = marginOuter;
      margin.right = marginInner;
      padding.left = paddingOuter;
      padding.right = paddingInner;
    }
    else {
      margin.left = marginInner;
      margin.right = marginOuter;
      padding.left = paddingInner;
      padding.right = paddingOuter;
    }
  }
  else {
    if (before) {
      margin.top = marginOuter;
      margin.bottom = marginInner;
      padding.top = paddingOuter;
      padding.bottom = paddingInner;
    }
    else {
      margin.top = marginInner;
      margin.bottom = marginOuter;
      padding.top = paddingInner;
      padding.bottom = paddingOuter;
    }
  }
  return createInvertedSpacingLayoutInfo(bounds, inverted, margin, padding);
}
