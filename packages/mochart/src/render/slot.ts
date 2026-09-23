import type { ErasedRenderer, RendererClass } from './renderer';

/**
 * A single dynamic child position: holds one child renderer (or nothing).
 * Same-class updates flow through renderer.update(); a class change (or null)
 * destroys and remounts, mirroring how the vdom reconciled a child vnode
 * position by type. The comment anchor keeps the position stable.
 */
export class Slot {
  readonly hostNode: Node;
  readonly anchor: Comment;
  private current: ErasedRenderer | null = null;
  private ctor: RendererClass | null = null;

  constructor(hostNode: Node, before: Node | null) {
    this.hostNode = hostNode;
    this.anchor = document.createComment('');
    hostNode.insertBefore(this.anchor, before);
  }

  set<P extends object>(ctor: RendererClass<P> | null, props?: P): void {
    if (ctor === null) {
      if (this.current !== null) {
        this.current.destroy(true);
        this.current = null;
        this.ctor = null;
      }
      return;
    }
    if (this.current !== null && this.ctor === ctor) {
      this.current.update(props as P);
      return;
    }
    if (this.current !== null) {
      this.current.destroy(true);
    }
    this.ctor = ctor;
    this.current = new ctor();
    this.current.mount(this.hostNode, this.anchor, props as P);
  }

  get<R extends ErasedRenderer = ErasedRenderer>(): R | null {
    return this.current as R | null;
  }

  destroy(removeDom: boolean): void {
    if (this.current !== null) {
      this.current.destroy(removeDom);
      this.current = null;
    }
    if (removeDom && this.anchor.parentNode) {
      this.anchor.parentNode.removeChild(this.anchor);
    }
  }
}
