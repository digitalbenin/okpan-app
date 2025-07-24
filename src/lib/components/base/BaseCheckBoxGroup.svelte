<script>
  import { Checkbox } from "bits-ui";

  let {
    name,
    groupLabel,
    value = $bindable([]),
    labelProps = {},
    children,
    ...restProps
  } = $props();
</script>

<Checkbox.Group {name} bind:value {...restProps} class="mb-3">
  {#if groupLabel}
    <Checkbox.GroupLabel {...labelProps}>{groupLabel}</Checkbox.GroupLabel>
  {/if}

  {@render children()}
</Checkbox.Group>
