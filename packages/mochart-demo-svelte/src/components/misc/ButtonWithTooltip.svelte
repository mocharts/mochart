<script lang="ts">
  import type { Snippet } from 'svelte';

  // The native title attribute covers the hover hint without a popper-style
  // positioning library.
  // tooltipPlacement is accepted for call-site parity but unused.
  // `label` renders visible text beside the icon; `pressed` marks the button
  // as a toggle (aria-pressed + active styling).
  // `menuLabel` is text shown ONLY once the button is folded into a phone
  // overflow menu, where an icon-only button would be a bare glyph in a column
  // of bare glyphs. Deliberately not `label`: a real label renders visible
  // text in the strips above 900px, where these buttons are icon-only by
  // design. `.btn-menu-label` is `display: none` everywhere except in a menu.
  interface Props {
    id?: string;
    tooltipText?: string;
    tooltipPlacement?: string;
    disabled?: boolean;
    onClick: () => void;
    color?: string;
    label?: string;
    menuLabel?: string;
    pressed?: boolean;
    children: Snippet;
    [key: string]: unknown;
  }

  let {
    id = undefined,
    tooltipText,
    // Destructured only to keep it OUT of `...rest`: no port implements
    // tooltip placement (it predates the bootstrap removal and is accepted for
    // call-site parity across the six ports), so letting it fall through would
    // spread an unknown attribute onto the DOM.
    tooltipPlacement: _tooltipPlacement = undefined,
    disabled = false,
    onClick,
    color = 'secondary',
    label = undefined,
    menuLabel = undefined,
    pressed = undefined,
    children,
    ...rest
  }: Props = $props();
</script>

<!-- Unstyled wrapper: it keeps the button one flex item wherever it is folded. -->
<span>
  <button {id} type="button" class={`demo-btn demo-btn-${color}` + (pressed ? ' active' : '')} {disabled} title={tooltipText}
          aria-pressed={pressed === undefined ? undefined : pressed} onclick={onClick} {...rest}>
    {@render children()}{#if menuLabel}<span class="btn-menu-label">{menuLabel}</span>{/if}{#if label}<span class="btn-label">{label}</span>{/if}
  </button>
</span>
