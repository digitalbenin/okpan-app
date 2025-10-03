<script>
  let {
    type = "text",
    value = $bindable(),
    optionsList,
    optionsValue = $bindable(),
    placeholder = "",
    icon,
    min = null,
    max = null,
    class: customClass = "",
    style: customStyle = "",
    id = crypto.randomUUID(),
    disabled = false,
    onChange = null,
    onInput = null,
    clearable = false,
    size,
  } = $props();

  // Validate type
  const validatedType = $derived.by(() => {
    if (!["text", "number"].includes(type)) {
      console.warn(`Invalid input type: ${type}. Defaulting to "text"`);
      return "text";
    }
    return type;
  });

  function clearInput() {
    value = "";
    // If onInput handler is provided, invoke it so consumers can react
    if (onInput) {
      try {
        onInput({ target: { value } });
      } catch (e) {
        console.warn('onInput handler threw during clearInput:', e);
      }
    }
  }
</script>

<div class="input-group {size ? `input-group-${size}` : ''}">
  {#if icon}
    <span class="input-group-text bg-white">
      <i class={`bi bi-${icon}`}></i>
    </span>
  {/if}
  <input
    {id}
    type={validatedType}
    bind:value
    class={`form-control ${customClass}`}
    {placeholder}
    {disabled}
    min={validatedType === "number" ? min : undefined}
    max={validatedType === "number" ? max : undefined}
    onchange={onChange}
    oninput={onInput}
  />
  {#if clearable}
    <span class="input-group-text bg-white">
      <button
        type="button"
        class="btn p-0 border-0 bg-transparent"
        onclick={clearInput}
        aria-label="Clear input"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </span>
  {/if}
  {#if optionsList && optionsList.length > 0}
    <span class="input-group-text bg-white p-0 col-4">
      <select
        bind:value={optionsValue}
        class="form-select border-0 text-truncate {size
          ? `form-select-${size}`
          : ''}"
      >
        {#each optionsList as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </span>
  {/if}
</div>
