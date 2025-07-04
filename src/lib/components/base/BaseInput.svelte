<script>
  let {
    type = "text",
    value = $bindable(),
    label = null,
    labelPosition = "top",
    placeholder = "",
    min = null,
    max = null,
    class: customClass = "",
    style: customStyle = "",
    id = crypto.randomUUID(),
    disabled = false,
    onChange = null,
    onInput = null,
  } = $props();

  // Validate type
  const validatedType = $derived.by(() => {
    if (!["text", "number"].includes(type)) {
      console.warn(`Invalid input type: ${type}. Defaulting to "text"`);
      return "text";
    }
    return type;
  });
</script>

<div class="row g-3 align-items-center">
  {#if label}
    <div class="col-auto">
      <label class="col-form-label" for={id}>
        {label}
      </label>
    </div>
  {/if}
  <div class="col-auto">
    <input
      {id}
      type={validatedType}
      bind:value
      class={`form-control ${customClass}`}
      {placeholder}
      {disabled}
      min={validatedType === "number" ? min : undefined}
      max={validatedType === "number" ? max : undefined}
      {onChange}
      {onInput}
    />
  </div>
</div>
