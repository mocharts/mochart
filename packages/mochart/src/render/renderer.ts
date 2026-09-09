import { shallowEqual, enqueue, beginWork, endWork } from './shared';
import { El } from './el';
import { Slot } from './slot';
import { ElSlot } from './elslot';
import { ElList, RendererList } from './list';
import type { ElBlock } from './list';

export type StateUpdate<P, S> = Partial<S> | ((state: S, props: P) => Partial<S> | null) | null;

export interface RendererClass<P extends object = any> {
  new (): Renderer<P, any>;
}

interface ChildRegion {
  hostNode: Node;
  destroy(removeDom: boolean): void;
}

/**
 * Base class for retained-mode chart components. `create()` builds the static
 * DOM once; `sync()` writes the dynamic parts from props/state, skipped when
 * both are shallow-equal (no vnodes, no tree diffing). Optional hooks: see
 * `derive`, `measure` and `dispose` below. Every renderer owns a comment
 * anchor in its parent so it can detach and re-attach its root element
 * (setPresent) without losing its position among siblings.
 */
export abstract class Renderer<P extends object, S extends object = Record<string, never>> {
  props!: P;
  state: S;

  parentDom!: Node;
  anchor!: Comment;
  /** root element; null for pass-through renderers that only mount children */
  element: Node | null = null;
  present = false;

  _unmounted = false;
  _stateCallbacks: (() => void)[] = [];
  private regions: ChildRegion[] = [];
  /** marks the start of this renderer's span once self-anchored regions put DOM before the element/anchor */
  private spanStart: Comment | null = null;

  constructor() {
    this.state = {} as S;
  }

  /**
   * Compute derived state from props. Runs on mount (`prevProps === null`) and on
   * every `update()` that receives a new props object; `setState` does not re-derive.
   * Return the state delta to merge, or null when nothing derived changes.
   */
  derive?(props: P, state: S, prevProps: P | null): Partial<S> | null;
  /** Override the default shallow-equal skip check. */
  shouldSync?(nextProps: P, nextState: S): boolean;
  /**
   * Post-commit hook for DOM measurement. Runs after the DOM is fully
   * written; `prevProps`/`prevState` are null on the run after mount.
   */
  measure?(prevProps: P | null, prevState: S | null): void;
  /** Release externally owned resources (tweens, refs). DOM removal is handled by destroy(). */
  dispose?(): void;

  /** Build the renderer's static DOM (once). Return the root node, or null for pass-through renderers. */
  protected abstract create(): Node | null;
  /** Write all dynamic attributes/children from this.props/this.state. */
  protected abstract sync(): void;

  mount(parentDom: Node, before: Node | null, props: P): void {
    beginWork();
    try {
      this.parentDom = parentDom;
      this.anchor = document.createComment('');
      parentDom.insertBefore(this.anchor, before);
      this.props = props;
      if (this.derive) {
        const delta = this.derive(this.props, this.state, null);
        if (delta !== null && delta !== undefined) {
          this.state = { ...this.state, ...delta };
        }
      }
      this.element = this.create();
      if (this.element !== null) {
        parentDom.insertBefore(this.element, this.anchor);
        this.present = true;
      }
      this.sync();
      if (this.measure) {
        enqueue(() => {
          if (!this._unmounted) {
            this.measure!(null, null);
          }
        });
      }
      this.drainStateCallbacks();
    }
    finally {
      endWork();
    }
  }

  update(props: P): void {
    if (this._unmounted) {
      return;
    }
    beginWork();
    try {
      let nextState = this.state;
      if (this.derive && props !== this.props) {
        const delta = this.derive(props, this.state, this.props);
        if (delta !== null && delta !== undefined) {
          nextState = { ...this.state, ...delta };
        }
      }
      const prevProps = this.props;
      const prevState = this.state;

      let skip: boolean;
      if (this.shouldSync) {
        skip = this.shouldSync(props, nextState) === false;
      }
      else {
        skip = shallowEqual(prevProps, props) && shallowEqual(prevState, nextState);
      }

      this.props = props;
      this.state = nextState;

      if (!skip) {
        this.sync();
        this.queueMeasure(prevProps, prevState);
      }
      this.drainStateCallbacks();
    }
    finally {
      endWork();
    }
  }

  setState(update: StateUpdate<P, S>, callback?: () => void): void {
    if (this._unmounted) {
      return;
    }
    const partial = typeof update === 'function' ? update(this.state, this.props) : update;
    if (partial == null && !callback) {
      return;
    }
    const nextState = partial == null ? this.state : { ...this.state, ...partial };
    if (callback) {
      this._stateCallbacks.push(callback);
    }
    beginWork();
    try {
      const prevProps = this.props;
      const prevState = this.state;

      let skip: boolean;
      if (this.shouldSync) {
        skip = this.shouldSync(this.props, nextState) === false;
      }
      else {
        skip = shallowEqual(prevState, nextState);
      }

      this.state = nextState;

      if (!skip) {
        this.sync();
        this.queueMeasure(prevProps, prevState);
      }
      this.drainStateCallbacks();
    }
    finally {
      endWork();
    }
  }

  private queueMeasure(prevProps: P, prevState: S): void {
    if (this.measure) {
      enqueue(() => {
        if (!this._unmounted) {
          this.measure!(prevProps, prevState);
        }
      });
    }
  }

  private drainStateCallbacks(): void {
    if (this._stateCallbacks.length > 0) {
      const callbacks = this._stateCallbacks;
      this._stateCallbacks = [];
      for (const callback of callbacks) {
        enqueue(callback);
      }
    }
  }

  /** Attach/detach the root element while keeping its sibling position. */
  protected setPresent(present: boolean): void {
    if (this.element === null || present === this.present) {
      return;
    }
    if (present) {
      this.parentDom.insertBefore(this.element, this.anchor);
    }
    else {
      this.parentDom.removeChild(this.element);
    }
    this.present = present;
  }

  /** Reposition this renderer's whole span (self-anchored regions, element, anchor) before a reference node. Used by RendererList reordering. */
  moveBefore(ref: Node | null): void {
    const nodes: Node[] = [];
    for (let node: Node | null = this.firstNode; node !== null && node !== this.anchor; node = node.nextSibling) {
      nodes.push(node);
    }
    nodes.push(this.anchor);
    for (const node of nodes) {
      this.parentDom.insertBefore(node, ref);
    }
  }

  /** First DOM node owned by this renderer (for list reordering cursors). */
  get firstNode(): Node {
    if (this.spanStart !== null) {
      return this.spanStart;
    }
    return this.element !== null && this.present ? this.element : this.anchor;
  }

  // ---------------------------------------------------------------------
  // child region factories — registered so destroy() cascades automatically
  // ---------------------------------------------------------------------

  /** Marks the span start before creating a self-anchored region, whose DOM lands ahead of the element/anchor. */
  private ownRegionAnchor(): Comment {
    if (this.spanStart === null) {
      const spanStart = document.createComment('');
      this.parentDom.insertBefore(spanStart, this.firstNode);
      this.spanStart = spanStart;
    }
    return this.anchor;
  }

  /** A single dynamic child renderer, anchored inside `host` (or in this renderer's own region when omitted). */
  protected slot(host?: El | Node): Slot {
    const created = host !== undefined
      ? new Slot(host instanceof El ? host.node : host, null)
      : new Slot(this.parentDom, this.ownRegionAnchor());
    this.regions.push(created);
    return created;
  }

  /** A single conditional/polymorphic element position, anchored inside `host` (or in this renderer's own region when omitted). */
  protected elSlot(host?: El | Node): ElSlot {
    const created = host !== undefined
      ? new ElSlot(host instanceof El ? host.node : host, null)
      : new ElSlot(this.parentDom, this.ownRegionAnchor());
    this.regions.push(created);
    return created;
  }

  /** A keyed list of element subtrees, anchored inside `host` (or in this renderer's own region when omitted). */
  protected elList<T, H extends ElBlock = ElBlock>(host?: El | Node): ElList<T, H> {
    const created = host !== undefined
      ? new ElList<T, H>(host instanceof El ? host.node : host, null)
      : new ElList<T, H>(this.parentDom, this.ownRegionAnchor());
    this.regions.push(created);
    return created;
  }

  /** A keyed list of child renderers, anchored inside `host` (or in this renderer's own region when omitted). */
  protected rendererList(host?: El | Node): RendererList {
    const created = host !== undefined
      ? new RendererList(host instanceof El ? host.node : host, null)
      : new RendererList(this.parentDom, this.ownRegionAnchor());
    this.regions.push(created);
    return created;
  }

  /** Destroy one region early, for a slot that is replaced rather than kept for this renderer's life. */
  protected releaseRegion(region: ChildRegion): void {
    const index = this.regions.indexOf(region);
    if (index !== -1) {
      this.regions.splice(index, 1);
    }
    region.destroy(true);
  }

  destroy(removeDom = true): void {
    if (this._unmounted) {
      return;
    }
    beginWork();
    try {
      this._unmounted = true;
      if (this.dispose) {
        this.dispose();
      }
      for (const region of this.regions) {
        // regions hosted inside our own element are discarded wholesale with it
        const insideElement = this.element !== null && this.element.contains(region.hostNode);
        region.destroy(removeDom && !insideElement);
      }
      this.regions = [];
      if (removeDom) {
        if (this.element !== null && this.present && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
        if (this.anchor.parentNode) {
          this.anchor.parentNode.removeChild(this.anchor);
        }
        if (this.spanStart !== null && this.spanStart.parentNode) {
          this.spanStart.parentNode.removeChild(this.spanStart);
        }
      }
    }
    finally {
      endWork();
    }
  }
}

/** Type-erased renderer used only by heterogeneous renderer containers. */
export type ErasedRenderer = Renderer<any, any>;
