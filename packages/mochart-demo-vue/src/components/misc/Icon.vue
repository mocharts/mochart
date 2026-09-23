<script setup lang="ts">
import { computed } from 'vue';

// Font Awesome 7 solid icon (css classes only). Relies on the
// `@fortawesome/fontawesome-free` css being imported.
interface Props {
  name: string;
  size?: string;
  fixedWidth?: boolean;
  flip?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: undefined,
  fixedWidth: false,
  flip: undefined
});

const classes = computed(() => {
  const list = ['fa-solid', `fa-${props.name}`];
  if (props.size) {
    list.push(`fa-${props.size}`);
  }
  if (!props.fixedWidth) {
    list.push('fa-width-auto');
  }
  if (props.flip) {
    list.push(`fa-flip-${props.flip}`);
  }
  return list.join(' ');
});
</script>

<template>
  <span aria-hidden="true" :class="classes"></span>
</template>
