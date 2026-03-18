<script>
    let {
        value = $bindable(false),
        label = null,
        labelPosition = "left",
        disabled = false,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        onChange = null,
    } = $props();

    // Handle value changes
    function handleChange(event) {
        if (onChange) {
            onChange(event);
        }
    }
</script>

<div
    class={`d-flex ${labelPosition === "top" ? "flex-column" : "align-items-center"} gap-2 ${customClass}`}
    style={customStyle + " width: fit-content;"}
>
    {#if label && (labelPosition === "left" || labelPosition === "top")}
        <label for={id}>{label}</label>
    {/if}
    <div class="form-check form-switch">
        <input
            type="checkbox"
            role="switch"
            class="form-check-input"
            {id}
            bind:checked={value}
            {disabled}
            onchange={handleChange}
        />
    </div>
    {#if label && labelPosition === "right"}
        <label for={id}>{label}</label>
    {/if}
</div>
