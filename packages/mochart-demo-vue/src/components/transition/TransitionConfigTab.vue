<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { applyTransitionConfigEdit, demoText, formatTransitionConfig, getDemoTabPanelAttrs, getJsonError } from '@mochart/demo-common';

import JsonEditorContent from '../misc/JsonEditorContent.vue';
import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import Icon from '../misc/Icon.vue';

import type { TransitionConfig } from '../../types';

interface Props {
  active?: boolean;
  transitionConfig: TransitionConfig;
  onUpdate: (config: TransitionConfig) => void;
  onReset: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

const configText = ref(formatTransitionConfig(props.transitionConfig));
const errorMessage = ref<string | null>(null);

watch(() => props.transitionConfig, (nextTransitionConfig) => {
  configText.value = formatTransitionConfig(nextTransitionConfig);
});

function onTextChange(nextConfigText: string) {
  configText.value = nextConfigText;
  errorMessage.value = null;
}

function onUpdateClick() {
  const result = applyTransitionConfigEdit(configText.value);
  if (result.ok) {
    errorMessage.value = null;
    props.onUpdate(result.config);
  }
  else {
    errorMessage.value = result.errorMessage;
  }
}

const jsonError = computed(() => getJsonError(configText.value));
const footerError = computed(() => jsonError.value ?? errorMessage.value);

const panelAttrs = getDemoTabPanelAttrs('config');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col config' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="mochart-demo-tab-content">
      <JsonEditorContent :value="configText" :ariaLabel="demoText.transitionConfigTab.editorAria" :on-change="onTextChange" />
    </div>
    <div class="mochart-demo-tab-footer">
      <div class="demo-toolbar">
        <ButtonWithTooltip id="config-reset" :label="demoText.transitionConfigTab.reset.label" :tooltip-text="demoText.transitionConfigTab.reset.tooltip" tooltip-placement="top-start"
                           :on-click="props.onReset" :aria-label="demoText.transitionConfigTab.reset.aria">
          <Icon size="lg" :fixed-width="true" name="arrow-rotate-left" />
        </ButtonWithTooltip>
        <ButtonWithTooltip id="config-apply" :label="demoText.transitionConfigTab.apply.label" :disabled="jsonError !== null"
                           :tooltip-text="demoText.transitionConfigTab.apply.tooltip" tooltip-placement="top-start"
                           :on-click="onUpdateClick" :aria-label="demoText.transitionConfigTab.apply.aria">
          <Icon size="lg" :fixed-width="true" name="check" />
        </ButtonWithTooltip>
        <span v-if="footerError" class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
      </div>
    </div>
  </div>
</template>
