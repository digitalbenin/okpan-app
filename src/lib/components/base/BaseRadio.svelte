<script>
    import { RadioGroup } from "melt/builders";

    let {
        options = [],
        value = $bindable(""),
        label = null,
        labelPosition = "top",
        orientation = "horizontal",
        disabled = false,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
    } = $props();

    const groupName = `radio-group-${id}`;
</script>

<div
    class={`${labelPosition === "left" ? "d-flex align-items-center gap-3" : ""}`}
    style={customStyle}
>
    {#if label}
        <div class="form-label mb-0">{label}</div>
    {/if}

    <div
        class={`${orientation === "vertical" ? "d-flex flex-column gap-1" : "d-flex gap-3"}  ${customClass}`}
    >
        {#each options as option}
            <div class="form-check">
                <input
                    type="radio"
                    id={`${id}-${option}`}
                    name={groupName}
                    class="form-check-input"
                    checked={value === option}
                    onchange={() => (value = option)}
                    {disabled}
                />
                <label for={`${id}-${option}`} class="form-check-label">
                    {option}
                </label>
            </div>
        {/each}
    </div>
</div>

<style>
    /* When label is on the left, make it take minimum width needed */
    .d-flex label {
        flex-shrink: 0;
    }

    /* Style for highlighted radio */
    .form-check-input[data-highlighted="true"] {
        border-color: var(--bs-primary);
        box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    }

    /* Style for checked radio */
    .form-check-input:checked {
        background-color: var(--bs-primary);
        border-color: var(--bs-primary);
    }
</style>
