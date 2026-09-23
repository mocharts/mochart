<script lang="ts">
  // Font Awesome 7 solid icon (css classes only). Relies on the
  // `@fortawesome/fontawesome-free` css being imported.
  interface Props {
    name: string;
    size?: string;
    fixedWidth?: boolean;
    flip?: string;
    /** Inline style, for the rare icon that carries its own layout (`margin-left: auto`). */
    style?: string;
  }

  let { name, size = undefined, fixedWidth = false, flip = undefined, style = undefined }: Props = $props();

  const classes = $derived.by(() => {
    const list = ['fa-solid', `fa-${name}`];
    if (size) {
      list.push(`fa-${size}`);
    }
    if (!fixedWidth) {
      list.push(`fa-width-auto`);
    }
    if (flip) {
      list.push(`fa-flip-${flip}`);
    }
    return list.join(' ');
  });
</script>

<span aria-hidden="true" class={classes} {style}></span>
