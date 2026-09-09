import { El } from './el';

/**
 * A single conditional/polymorphic element position (the `{cond && <rect/>}`
 * JSX pattern). Content is keyed (usually by tag): a key change swaps the
 * element, an unchanged key updates it in place; the comment anchor keeps the
 * position stable while the element is absent.
 */
export class ElSlot {
  readonly hostNode: Node;
  readonly anchor: Comment;
  private current: El | null = null;
  private currentKey: string | null = null;

  constructor(hostNode: Node, before: Node | null) {
    this.hostNode = hostNode;
    this.anchor = document.createComment('');
    hostNode.insertBefore(this.anchor, before);
  }

  /** Show the element for `key` (creating it via `init` on key change), or hide with key null. */
  set(key: string | null, init?: () => El): El | null {
    if (key === null) {
      this.clear();
      return null;
    }
    if (this.currentKey !== key) {
      this.clear();
      this.current = init!();
      this.currentKey = key;
      this.hostNode.insertBefore(this.current.node, this.anchor);
    }
    return this.current;
  }

  private clear(): void {
    if (this.current !== null) {
      if (this.current.node.parentNode) {
        this.current.node.parentNode.removeChild(this.current.node);
      }
      this.current = null;
      this.currentKey = null;
    }
  }

  destroy(removeDom: boolean): void {
    if (removeDom) {
      this.clear();
      if (this.anchor.parentNode) {
        this.anchor.parentNode.removeChild(this.anchor);
      }
    }
  }
}
