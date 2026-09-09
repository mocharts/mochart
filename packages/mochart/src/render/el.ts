import { SVG_NAMESPACE, setProperty } from './dom';

export type ElProps = Record<string, unknown>;

/**
 * A retained DOM element. `set(props)` diffs against the previously written
 * props and only touches what changed (setProperty's attribute contract).
 * Pass props in the old JSX attribute order — initial attribute order sets
 * serialization order, which the golden snapshot tests compare.
 */
export class El {
  readonly node: Element;
  readonly svg: boolean;
  private prev: ElProps = {};

  constructor(tag: string, svg: boolean) {
    this.svg = svg;
    this.node = svg ? document.createElementNS(SVG_NAMESPACE, tag) : document.createElement(tag);
  }

  set(props: ElProps): this {
    const prev = this.prev;
    for (const name in prev) {
      if (!(name in props)) {
        setProperty(this.node, name, prev[name], null, this.svg);
      }
    }
    for (const name in props) {
      if (prev[name] !== props[name]) {
        setProperty(this.node, name, prev[name], props[name], this.svg);
      }
    }
    this.prev = props;
    return this;
  }

  append(...children: (El | TextEl | Node)[]): this {
    for (const child of children) {
      this.node.appendChild(child instanceof Node ? child : child.node);
    }
    return this;
  }
}

/** A retained text node with change-detected updates. */
export class TextEl {
  readonly node: Text;
  private prev = '';

  constructor(value: string | number = '') {
    this.node = document.createTextNode('');
    this.set(value);
  }

  set(value: string | number | null | undefined): this {
    const text = value == null ? '' : String(value);
    if (text !== this.prev) {
      this.node.nodeValue = text;
      this.prev = text;
    }
    return this;
  }
}

export function svgEl(tag: string): El {
  return new El(tag, true);
}

export function htmlEl(tag: string): El {
  return new El(tag, false);
}

export function textEl(value: string | number = ''): TextEl {
  return new TextEl(value);
}
