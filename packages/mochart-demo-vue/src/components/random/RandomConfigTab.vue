<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import JsonEditorContent from '../misc/JsonEditorContent.vue';
import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import Icon from '../misc/Icon.vue';

import { demoText, formatRandomConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, parseJson, validateRandomConfig } from '@mochart/demo-common';

import type { RandomConfigWithValid } from '../../types';

interface Props {
  active?: boolean;
  randomConfig: RandomConfigWithValid;
  /** The current demo's generator id, for schema dispatch. */
  generator?: string;
  onUpdate: (config: RandomConfigWithValid) => void;
  onReset: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

const configText = ref(formatRandomConfig(props.randomConfig));
const errorMessage = ref<string | null>(null);

watch(() => props.randomConfig, (nextRandomConfig) => {
  configText.value = formatRandomConfig(nextRandomConfig);
});

function onTextChange(nextConfigText: string) {
  configText.value = nextConfigText;
  errorMessage.value = null;
}

function onUpdateClick() {
  try {
    const newConfig = parseJson(configText.value) as RandomConfigWithValid;
    newConfig.valid = validateRandomConfig(newConfig, props.generator);
    errorMessage.value = newConfig.valid ? null : demoText.errors.invalidRandomConfigValues;
    props.onUpdate(newConfig);
  }
  catch (error) {
    console.warn('Invalid Random Config JSON: ' + configText.value);
    errorMessage.value = getJsonErrorMessage(error);
  }
}

const jsonError = computed(() => getJsonError(configText.value));
const footerError = computed(() => jsonError.value ?? errorMessage.value);

const panelAttrs = getDemoTabPanelAttrs('config');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col config' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="mochart-demo-tab-content">
      <JsonEditorContent :value="configText" :ariaLabel="demoText.randomConfigTab.editorAria" :format-on-set="true" :on-change="onTextChange" />
    </div>
    <div class="mochart-demo-tab-footer">
      <div class="demo-toolbar">
        <ButtonWithTooltip id="config-reset" :label="demoText.randomConfigTab.reset.label" :tooltip-text="demoText.randomConfigTab.reset.tooltip" tooltip-placement="top-start"
                           :on-click="props.onReset" :aria-label="demoText.randomConfigTab.reset.aria">
          <Icon size="lg" :fixed-width="true" name="arrow-rotate-left" />
        </ButtonWithTooltip>
        <ButtonWithTooltip id="config-apply" :label="demoText.randomConfigTab.apply.label" :disabled="jsonError !== null"
                           :tooltip-text="demoText.randomConfigTab.apply.tooltip" tooltip-placement="top-start"
                           :on-click="onUpdateClick" :aria-label="demoText.randomConfigTab.apply.aria">
          <Icon size="lg" :fixed-width="true" name="check" />
        </ButtonWithTooltip>
        <span v-if="footerError" class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
      </div>
    </div>
  </div>
</template>
