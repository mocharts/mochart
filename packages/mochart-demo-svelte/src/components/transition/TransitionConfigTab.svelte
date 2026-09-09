<script lang="ts">
  import { untrack } from 'svelte';

  import { applyTransitionConfigEdit, demoText, formatTransitionConfig, getDemoTabPanelAttrs, getJsonError } from '@mochart/demo-common';

  import JsonEditorContent from '../misc/JsonEditorContent.svelte';
  import ButtonWithTooltip from '../misc/ButtonWithTooltip.svelte';
  import Icon from '../misc/Icon.svelte';

  import type { TransitionConfig } from '../../types';

  interface Props {
    active?: boolean;
    transitionConfig: TransitionConfig;
    onUpdate: (config: TransitionConfig) => void;
    onReset: () => void;
  }

  let { active = false, transitionConfig, onUpdate, onReset }: Props = $props();

  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs on later prop changes.
  // svelte-ignore state_referenced_locally
  let configText = $state(formatTransitionConfig(transitionConfig));
  let errorMessage = $state<string | null>(null);

  // svelte-ignore state_referenced_locally
  let previousTransitionConfig = transitionConfig;
  $effect.pre(() => {
    const nextTransitionConfig = transitionConfig;
    untrack(() => {
      if (nextTransitionConfig !== previousTransitionConfig) {
        previousTransitionConfig = nextTransitionConfig;
        configText = formatTransitionConfig(nextTransitionConfig);
      }
    });
  });

  function onTextChange(nextConfigText: string) {
    configText = nextConfigText;
    errorMessage = null;
  }

  function onUpdateClick() {
    const result = applyTransitionConfigEdit(configText);
    if (result.ok) {
      errorMessage = null;
      onUpdate(result.config);
    }
    else {
      errorMessage = result.errorMessage;
    }
  }

  const jsonError = $derived(getJsonError(configText));
  const footerError = $derived(jsonError ?? errorMessage);
</script>

<div {...getDemoTabPanelAttrs('config')} class={"mochart-demo-tab-container demo-layout-col config" + (active ? " active" : "")} inert={!active}>
  <div class="mochart-demo-tab-content">
    <JsonEditorContent value={configText} ariaLabel={demoText.transitionConfigTab.editorAria} onChange={onTextChange} />
  </div>
  <div class="mochart-demo-tab-footer">
    <div class="demo-toolbar">
      <ButtonWithTooltip id="config-reset" label={demoText.transitionConfigTab.reset.label} tooltipText={demoText.transitionConfigTab.reset.tooltip} tooltipPlacement="top-start"
                         onClick={onReset} aria-label={demoText.transitionConfigTab.reset.aria}>
        <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
      </ButtonWithTooltip>
      <ButtonWithTooltip id="config-apply" label={demoText.transitionConfigTab.apply.label} disabled={jsonError !== null}
                         tooltipText={demoText.transitionConfigTab.apply.tooltip} tooltipPlacement="top-start"
                         onClick={onUpdateClick} aria-label={demoText.transitionConfigTab.apply.aria}>
        <Icon size="lg" fixedWidth={true} name="check" />
      </ButtonWithTooltip>
      {#if footerError}
        <span class="mochart-demo-footer-error" role="alert">{footerError}</span>
      {/if}
    </div>
  </div>
</div>
