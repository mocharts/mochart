import React from 'react';

interface Props {
  children?: React.ReactNode;
  tooltipText?: string;
  // Accepted for call-site parity; the native title attribute covers the
  // same hint without a popper-style positioning library.
  tooltipPlacement?: string;
  id?: string;
  disabled?: boolean;
  onClick?: () => void;
  color?: string;
  // `label` renders visible text beside the icon; `pressed` marks the button
  // as a toggle (aria-pressed + active styling).
  label?: string;
  // Text shown ONLY once the button is folded into a phone overflow menu,
  // where an icon-only button would be a bare glyph in a column of bare
  // glyphs. Deliberately not `label`: a real label renders visible text in the
  // strips above 900px, where these buttons are icon-only by design.
  // `.btn-menu-label` is `display: none` everywhere except inside a menu.
  menuLabel?: string;
  pressed?: boolean;
  [key: string]: unknown;
}

export default function ButtonWithTooltip(props: Props) {
  // tooltipPlacement is intentionally destructured out and ignored.
  const { children, tooltipText, tooltipPlacement, id, disabled, onClick, color = 'secondary', label, menuLabel, pressed, ...buttonProps } = props;

  // Unstyled wrapper: it keeps the button one flex item wherever it is folded.
  return (
    <span>
      <button id={id} type="button" className={`demo-btn demo-btn-${color}` + (pressed ? ' active' : '')}
        disabled={disabled} title={tooltipText}
        aria-pressed={pressed === undefined ? undefined : pressed} onClick={onClick}
        {...(buttonProps as Record<string, unknown>)}>
        {children}{menuLabel ? <span className="btn-menu-label">{menuLabel}</span> : null}{label ? <span className="btn-label">{label}</span> : null}
      </button>
    </span>
  );
}
