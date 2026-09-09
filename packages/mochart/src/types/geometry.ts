export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Size {
  x: number;
  y: number;
}

export interface MarginPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface InnerOuter {
  inner: number;
  outer: number;
}

/**
 * Measured text bounds. `empty` = shared zero bounds for a hidden element; `default` =
 * placeholder bounds before the DOM can be measured; `fontSize` in px, captured only where measured.
 */
export interface TextBounds extends Size {
  empty?: boolean;
  default?: boolean;
  fontSize?: number;
}
