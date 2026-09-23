<script setup lang="ts">
import { ref } from 'vue';

import { demoText } from '@mochart/demo-common';
import type { GalleryItem, ShowcaseMode } from '@mochart/demo-common';

import Icon from '../misc/Icon.vue';

// One gallery card. A demo's `notes` hang off the card behind a toggle; the
// toggle and the notes prose are siblings of the open-demo button rather than
// children of it, since a <button> may not contain interactive content, so the
// card chrome lives on the .demo-list-entry wrapper (see demo.css).
interface Props {
  item: GalleryItem;
  onOpen: (item: GalleryItem) => void;
}

const props = defineProps<Props>();

const pageIcons: Record<ShowcaseMode, string> = {
  transition: 'right-left',
  rotation: 'repeat',
  sparkline: 'chart-line'
};

const notesOpen = ref(false);
</script>

<template>
  <div class="demo-list-entry">
    <div class="demo-list-row">
      <button type="button" class="demo-list-item" @click="props.onOpen(props.item)">
        <Icon v-if="props.item.kind === 'page'" :name="pageIcons[props.item.mode]" :fixed-width="true" />
        <span class="mochart-demo-item-title">{{ props.item.title }}</span>
        <span v-if="props.item.description !== undefined" class="mochart-demo-item-description">{{ props.item.description }}</span>
      </button>
      <button v-if="props.item.notes !== undefined" type="button"
              :class="'demo-btn demo-btn-secondary mochart-demo-notes-toggle' + (notesOpen ? ' active' : '')"
              :aria-expanded="notesOpen" :aria-label="demoText.demoNotes.galleryToggle.aria"
              :title="notesOpen ? demoText.demoNotes.galleryToggle.tooltipHide : demoText.demoNotes.galleryToggle.tooltipShow"
              @click="notesOpen = !notesOpen">
        <Icon name="circle-info" :fixed-width="true" />
      </button>
    </div>
    <div v-if="props.item.notes !== undefined && notesOpen" class="mochart-demo-notes">{{ props.item.notes }}</div>
  </div>
</template>
