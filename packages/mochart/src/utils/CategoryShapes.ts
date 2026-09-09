import { mochartCssClasses } from './ChartDom';
import { isHoverPointer } from './utils';
import type { MochartCssClassKey } from './ChartDom';
import type { ElProps } from '../render';

/** The per-category callbacks a series component routes its shape events to. */
export interface CategoryCallbacks {
  onCategoryEnter: (categoryIndex: number) => void;
  onCategoryLeave: (categoryIndex: number) => void;
  onCategoryClick: (categoryIndex: number, event: Event) => void;
}

/** One shape at a category index: its list key, class name and DOM handlers, plus a slot for the attrs written on the current sync. */
export interface CategoryShape {
  key: number;
  className: string;
  onPointerEnter: (event: Event) => void;
  onPointerLeave: (event: Event) => void;
  onClick: (event: Event) => void;
  /** Rewritten every sync (El.set keeps the previous object for diffing, so it is never mutated in place). */
  attrs: ElProps;
}

/**
 * Per-index shape records created once and reused across syncs, so a shape's key, class name and
 * event props keep their identity frame to frame; the current callbacks are read at call time.
 * The record doubles as the keyed-list item, so a sync allocates only the attrs object per shape.
 */
export class CategoryShapeCache<S extends CategoryShape = CategoryShape> {
  private readonly shapes: S[] = [];

  constructor(
    private readonly classKey: MochartCssClassKey,
    private readonly callbacks: () => CategoryCallbacks,
    private readonly extend: (shape: CategoryShape) => S = shape => shape as S
  ) {}

  get(categoryIndex: number): S {
    let shape = this.shapes[categoryIndex];
    if (shape === undefined) {
      const { callbacks } = this;
      // leave mirrors the enter that actually fired: an ignored touch enter must not clear focus set elsewhere
      let hoverActive = false;
      shape = this.shapes[categoryIndex] = this.extend({
        key: categoryIndex,
        className: mochartCssClasses[this.classKey] + categoryIndex,
        onPointerEnter: (event: Event) => { if (isHoverPointer(event)) { hoverActive = true; callbacks().onCategoryEnter(categoryIndex); } },
        onPointerLeave: () => { if (hoverActive) { hoverActive = false; callbacks().onCategoryLeave(categoryIndex); } },
        onClick: (event: Event) => { callbacks().onCategoryClick(categoryIndex, event); },
        attrs: {}
      });
    }
    return shape;
  }
}
