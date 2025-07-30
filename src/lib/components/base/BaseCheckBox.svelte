<script>
  import { Checkbox, Label, useId } from "bits-ui";

  let {
    id = useId(),
    checked = $bindable(false),
    ref = $bindable(null),
    labelRef = $bindable(null),
    labelText,
    value,
    ...restProps
  } = $props();
</script>

<div class="form-check">
  <Checkbox.Root bind:checked bind:ref {value} {...restProps} forceMount>
    {#snippet child({ props, checked, indeterminate })}
      <input
        class="form-check-input"
        type="checkbox"
        aria-checked={props["aria-checked"]}
        aria-required={props["aria-required"]}
        {checked}
        {indeterminate}
        {value}
        {id}
        onclick={props.onclick}
        disabled={props.disabled}
        required={props.required}
      />
    {/snippet}
  </Checkbox.Root>
  <Label.Root
    for={id}
    bind:ref={labelRef}
    class="form-check-label text-capitalize"
  >
    {labelText}
  </Label.Root>
</div>
