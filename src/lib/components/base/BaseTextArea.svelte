<script>
    let {
        value = $bindable(),
        label = null,
        labelPosition = "top",
        placeholder = "",
        rows = 3,
        maxLength,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        disabled = false,
        resize = "vertical", // none, both, horizontal, vertical
    } = $props();

    // Computed properties
    const charCount = $derived(value?.length ?? 0);
    const showCharCount = $derived(maxLength != null);
</script>

<div
    class={`${label && labelPosition === "left" ? "d-flex align-items-start gap-3" : ""}`}
    style={customStyle}
>
    {#if label}
        <label class="form-label mb-0" for={id}>
            {label}
        </label>
    {/if}
    <div class={label ? "flex-grow-1" : ""}>
        <textarea
            {id}
            bind:value
            class={`form-control ${customClass}`}
            style={`resize: ${resize};`}
            {placeholder}
            {rows}
            {maxLength}
            {disabled}
        ></textarea>
        {#if showCharCount}
            <div class="form-text text-end">
                {charCount} / {maxLength}
            </div>
        {/if}
    </div>
</div>

<style>
    /* When label is on the left, make it take minimum width needed */
    .d-flex label {
        flex-shrink: 0;
    }
</style>
