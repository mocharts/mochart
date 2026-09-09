<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';

import { applyDataEdit, buildMochartDemoConfig, collectUsedDataProperties, controlsMenuPlacement, demoText, formatDataView, getCategoryProperty, getDemoTabPanelAttrs, getJsonError, parseFullData } from '@mochart/demo-common';

import JsonEditorContent from '../misc/JsonEditorContent.vue';
import ButtonWithTooltip from '../misc/ButtonWithTooltip.vue';
import Icon from '../misc/Icon.vue';
import OverflowMenu from '../misc/OverflowMenu.vue';
import { usePhoneViewport } from '../misc/usePhoneViewport';

import type { DemoConfig, DataObject } from '../../types';

interface Props {
  active?: boolean;
  config: DemoConfig;
  data: DataObject[];
  onDataChange: (data: DataObject[]) => void;
  onDataError: (errorMessage: string) => void;
  onDataReset: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

// Data properties the chart config does not read are hidden by default; the
// Unused button toggles them. fullData is the complete dataset backing the
// textarea, viewUsedProperties the used-set its current content was rendered
// with (null when every property is shown).
const usedProperties = computed(() => collectUsedDataProperties(buildMochartDemoConfig(props.config).mochartConfig));
const showUnused = ref(false);
let fullData: DataObject[] = props.data;
let viewUsedProperties: Set<string> | null = null;

const dataText = ref('');
const errorMessage = ref<string | null>(null);

function renderView(fullRows: DataObject[]): void {
  fullData = fullRows;
  viewUsedProperties = showUnused.value ? null : usedProperties.value;
  dataText.value = formatDataView(fullRows, viewUsedProperties);
}

function parseCurrentFullData(): ReturnType<typeof parseFullData> {
  return parseFullData(dataText.value, fullData, viewUsedProperties, getCategoryProperty(props.config));
}

renderView(props.data);

watch(() => props.data, (nextData) => {
  renderView(nextData);
});

// Re-filter when the applied config changes, keeping any (valid) unapplied edits.
watch(() => props.config, () => {
  if (!showUnused.value) {
    const parsed = parseCurrentFullData();
    if (!('error' in parsed)) {
      renderView(parsed.full);
    }
  }
});

function onTextChange(nextDataText: string) {
  dataText.value = nextDataText;
  errorMessage.value = null;
}

function resetData() {
  renderView(props.data);
  errorMessage.value = null;
  props.onDataReset();
}

function toggleShowUnused() {
  const parsed = parseCurrentFullData();
  if ('error' in parsed) {
    errorMessage.value = parsed.error === 'json' ? demoText.errors.invalidJson : demoText.errors.invalidDataArray;
    return;
  }
  showUnused.value = !showUnused.value;
  errorMessage.value = null;
  renderView(parsed.full);
}

function applyData() {
  const result = applyDataEdit(dataText.value, fullData, viewUsedProperties, props.config);
  if (result.ok) {
    errorMessage.value = null;
    fullData = result.data;
    props.onDataChange(result.data);
  }
  else {
    errorMessage.value = result.errorMessage;
    props.onDataError(result.callbackError);
  }
}

const jsonError = computed(() => getJsonError(dataText.value));
const footerError = computed(() => jsonError.value ?? errorMessage.value);

// Same fold as the config footer — Apply and the `role="alert"` error stay
// inline, the rest goes to the `⋯`; the reasons live on ConfigTab's fold.
const isPhone = usePhoneViewport();
const footerElement = ref<HTMLElement | null>(null);
const getFooterAnchor = () => footerElement.value;

const iconChild = (name: string) => () => h(Icon, { size: 'lg', fixedWidth: true, name });

const ResetButton = () => h(ButtonWithTooltip, {
  id: 'data-reset', label: demoText.dataTab.reset.label, tooltipText: demoText.dataTab.reset.tooltip,
  tooltipPlacement: 'top-start', onClick: resetData, 'aria-label': demoText.dataTab.reset.aria
}, iconChild('arrow-rotate-left'));

const UnusedButton = () => h(ButtonWithTooltip, {
  id: 'data-unused', label: demoText.dataTab.unused.label, pressed: showUnused.value,
  tooltipText: demoText.dataTab.unused.tooltip, tooltipPlacement: 'top-start',
  onClick: toggleShowUnused, 'aria-label': demoText.dataTab.unused.aria
}, iconChild(showUnused.value ? 'eye' : 'eye-slash'));

const ApplyButton = () => h(ButtonWithTooltip, {
  id: 'data-apply', label: demoText.dataTab.apply.label, disabled: jsonError.value !== null,
  tooltipText: demoText.dataTab.apply.tooltip, tooltipPlacement: 'top-start',
  onClick: applyData, 'aria-label': demoText.dataTab.apply.aria
}, iconChild('check'));

const panelAttrs = getDemoTabPanelAttrs('data');
</script>

<template>
  <div v-bind="panelAttrs" :class="'mochart-demo-tab-container demo-layout-col data' + (props.active ? ' active' : '')" :inert="!props.active">
    <div class="mochart-demo-tab-content">
      <JsonEditorContent :value="dataText" :ariaLabel="demoText.dataTab.editorAria" :on-change="onTextChange" />
    </div>
    <div class="mochart-demo-tab-footer" ref="footerElement">
      <div class="demo-toolbar">
        <template v-if="isPhone">
          <ApplyButton />
          <OverflowMenu :text="demoText.overflowMenu.editor"
                        :placement="controlsMenuPlacement"
                        :get-anchor="getFooterAnchor"
                        :active="props.active">
            <div class="demo-btn-group"><ResetButton /><UnusedButton /></div>
          </OverflowMenu>
        </template>
        <template v-else>
          <ResetButton />
          <UnusedButton />
          <ApplyButton />
        </template>
        <span v-if="footerError" class="mochart-demo-footer-error" role="alert">{{ footerError }}</span>
      </div>
    </div>
  </div>
</template>
