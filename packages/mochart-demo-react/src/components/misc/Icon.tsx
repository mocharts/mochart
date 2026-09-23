// Font Awesome 7 solid icon (css classes only), the React equivalent of the
// svelte/vue demos' Icon component. Relies on the
// `@fortawesome/fontawesome-free` css being imported.
import type { CSSProperties } from 'react';

interface IconProps {
  name: string;
  size?: string;
  fixedWidth?: boolean;
  flip?: string;
  /** Inline style, for the rare icon that carries its own layout (`margin-left: auto`). */
  style?: CSSProperties;
}

export default function Icon({ name, size, fixedWidth, flip, style }: IconProps) {
  const classes = ['fa-solid', `fa-${name}`];
  if (size) {
    classes.push(`fa-${size}`);
  }
  if (!fixedWidth) {
    classes.push('fa-width-auto');
  }
  if (flip) {
    classes.push(`fa-flip-${flip}`);
  }
  return <span aria-hidden="true" className={classes.join(' ')} style={style} />;
}
