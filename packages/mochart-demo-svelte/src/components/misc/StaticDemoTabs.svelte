<script lang="ts">
  // The strip for a view with only one pane (Multi) — a caption with no tab roles, since there is nothing to switch to.
  interface Props {
    label: string;
  }

  let { label }: Props = $props();
</script>

<ul class="demo-tabs">
  <li class="demo-tab-item"><span class="demo-tab active">{label}</span></li>
</ul>
