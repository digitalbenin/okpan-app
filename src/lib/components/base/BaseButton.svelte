<script>
  let {
    text,
    icon,
    IconComponent = null,
    iconPosition = "left",
    disabled = $bindable(),
    loading = $bindable(),
    onClick = $bindable(),
    class: customClass = "",
    style: customStyle = "",
    type = "button",
    title = "",
  } = $props();
</script>

<button
  {type}
  class={`d-flex gap-2 align-items-center ${customClass}`}
  style={customStyle}
  {disabled}
  title={title || undefined}
  onclick={onClick}
>
  {#if loading}
    <span
      class="spinner-border spinner-border-sm"
      role="status"
      aria-hidden="true"
    ></span>
  {:else}
    {#if (icon || IconComponent) && iconPosition === "left"}
      {#if IconComponent}
        <IconComponent size={16} />
      {:else}
        <i class={`bi bi-${icon}`}></i>
      {/if}
    {/if}
    {text}
    {#if (icon || IconComponent) && iconPosition === "right"}
      {#if IconComponent}
        <IconComponent size={16} />
      {:else}
        <i class={`bi bi-${icon}`}></i>
      {/if}
    {/if}
  {/if}
</button>
