<script lang="ts">
  import { demoText, formatData, getDemoTabPanelAttrs } from '@mochart/demo-common';

  import { untrack } from 'svelte';

  import JsonEditorContent from '../misc/JsonEditorContent.svelte';

  interface Props {
    active?: boolean;
    data: unknown;
  }

  let { active = false, data }: Props = $props();

  // Props intentionally seed local state with their initial value only; the
  // $effect.pre below re-syncs on later prop changes.
  // svelte-ignore state_referenced_locally
  let dataText = $state(formatData(data));

  // svelte-ignore state_referenced_locally
  let previousData = data;
  $effect.pre(() => {
    const nextData = data;
    untrack(() => {
      if (nextData !== previousData) {
        previousData = nextData;
        dataText = formatData(nextData);
      }
    });
  });
</script>

<div {...getDemoTabPanelAttrs('data')} class={"mochart-demo-tab-container demo-layout-col data" + (active ? " active" : "")} inert={!active}>
  <div class="mochart-demo-tab-content">
    <JsonEditorContent value={dataText} ariaLabel={demoText.randomDataTab.editorAria} readOnly={true} />
  </div>
</div>
