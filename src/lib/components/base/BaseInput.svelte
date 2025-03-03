<script>
    let {
        type = "text",
        value = $bindable(""),
        label = null,
        labelPosition = "top",
        placeholder = "",
        min = null,
        max = null,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        disabled = false,
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

{#if label}
    <div
        class={`${labelPosition === "left" ? "d-flex align-items-center gap-3" : ""}`}
        style={customStyle}
    >
        <label class="form-label mb-0" for={id}>
            {label}
        </label>
        <input
            {id}
            type={validatedType}
            bind:value
            class={`form-control ${customClass}`}
            {placeholder}
            {disabled}
            min={validatedType === "number" ? min : undefined}
            max={validatedType === "number" ? max : undefined}
        />
    </div>
{:else}
    <input
        type={validatedType}
        bind:value
        class={`form-control ${customClass}`}
        style={customStyle}
        {placeholder}
        {disabled}
        min={validatedType === "number" ? min : undefined}
        max={validatedType === "number" ? max : undefined}
    />
{/if}

<style>
    /* When label is on the left, make it take minimum width needed */
    .d-flex label {
        flex-shrink: 0;
    }
</style>
