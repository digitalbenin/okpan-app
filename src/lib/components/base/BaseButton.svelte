<script>
    let {
        text,
        icon,
        iconPosition = "left",
        disabled = $bindable(),
        loading = $bindable(),
        onClick = $bindable(),
        class: customClass = "", // Add class prop with default empty string
        style: customStyle = "", // Add style prop with default empty string
    } = $props();
</script>

<button
    class={`d-flex gap-2 align-items-center ${customClass}`}
    style={customStyle}
    {disabled}
    onclick={onClick}
>
    {#if loading}
        <span
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
        ></span>
    {:else}
        {#if icon && iconPosition === "left"}
            <i class={`bi bi-${icon}`}></i>
        {/if}
        {text}
        {#if icon && iconPosition === "right"}
            <i class={`bi bi-${icon}`}></i>
        {/if}
    {/if}
</button>
