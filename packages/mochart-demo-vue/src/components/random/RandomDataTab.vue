<script setup lang="ts">
import { demoText, formatData, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { ref, watch } from 'vue';

import JsonEditorContent from '../misc/JsonEditorContent.vue';

interface Props {
  active?: boolean;
  data: unknown;
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

const dataText = ref(formatData(props.data));

watch(() => props.data, (nextData) => {
  dataText.value = formatData(nextData);
});

const panelAttrs = getDemoTabPanelAttrs('data');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col data' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="mochart-demo-tab-content">
      <JsonEditorContent :value="dataText" :ariaLabel="demoText.randomDataTab.editorAria" :read-only="true" />
    </div>
  </div>
</template>
