<script setup lang="ts">
// The native title attribute covers the hover hint without a popper-style
// positioning library.
// tooltipPlacement is accepted for call-site parity but unused. Extra
// attributes (e.g. aria-label) fall through to the button element.
// `label` renders visible text beside the icon; `pressed` marks the button
// as a toggle (aria-pressed + active styling).
// `menuLabel` is text shown ONLY once the button is folded into a phone
// overflow menu, where an icon-only button would be a bare glyph in a column
// of bare glyphs. Deliberately not `label`: a real label renders visible text
// in the strips above 900px, where these buttons are icon-only by design.
// `.btn-menu-label` is `display: none` everywhere except inside a menu.
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
}

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  tooltipText: undefined,
  tooltipPlacement: undefined,
  disabled: false,
  color: 'secondary',
  label: undefined,
  menuLabel: undefined,
  pressed: undefined
});
</script>

<template>
  <!-- Unstyled wrapper: it keeps the button one flex item wherever it is folded. -->
  <span>
    <button :id="props.id" type="button" :class="`demo-btn demo-btn-${props.color}` + (props.pressed ? ' active' : '')"
            :disabled="props.disabled" :title="props.tooltipText"
            :aria-pressed="props.pressed === undefined ? undefined : props.pressed"
            v-bind="$attrs" @click="props.onClick()">
      <slot></slot><span v-if="props.menuLabel" class="btn-menu-label">{{ props.menuLabel }}</span><span v-if="props.label" class="btn-label">{{ props.label }}</span>
    </button>
  </span>
</template>
