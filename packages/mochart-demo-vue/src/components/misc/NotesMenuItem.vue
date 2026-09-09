<script setup lang="ts">
  // The phone fold's stand-in for the NotesMenu popover: a `.demo-menu-item`
  // row that expands the same title and body inline, inside the navigation
  // row's overflow panel. `.demo-menu-keep-open` so revealing the note does
  // not also dismiss the menu it lives in; the panel's own `overflow-y: auto`
  // under its `max-height` is what makes a long note readable on a screen that
  // does not scroll.
  import { ref, useId, watch } from 'vue';

  import { demoText, menuKeepOpenClassName } from '@mochart/demo-common';

  import Icon from './Icon.vue';

  interface Props {
    title: string;
    notes?: string;
  }

  const props = withDefaults(defineProps<Props>(), { notes: undefined });

  const expanded = ref(false);
  const disclosureId = 'demo-notes-disclosure-' + useId();

  // A different demo's notes start collapsed again (history navigation).
  watch(() => [props.title, props.notes], () => {
    expanded.value = false;
  });
</script>

<template>
  <div v-if="props.notes !== undefined" :class="'mochart-demo-notes-item ' + menuKeepOpenClassName">
    <button type="button" class="demo-menu-item"
            :title="demoText.demoNotes.trigger.tooltip"
            :aria-expanded="expanded" :aria-controls="disclosureId"
            @click="expanded = !expanded">
      <Icon :fixed-width="true" name="circle-info" /> <span>{{ demoText.demoNotes.trigger.aria }}</span>
      <!-- `margin-left: auto` on the icon itself (it falls through to Icon's
           root span), matching the vanilla port's markup pixel for pixel. -->
      <Icon :fixed-width="true" :name="expanded ? 'chevron-up' : 'chevron-down'" style="margin-left: auto;" />
    </button>
    <div class="demo-field" :id="disclosureId" :hidden="!expanded">
      <span class="demo-menu-notes-title">{{ props.title }}</span>
      <span class="demo-menu-notes-body">{{ props.notes }}</span>
    </div>
  </div>
</template>
