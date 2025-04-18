<script>
    let {
        value = $bindable(), // Expects string in YYYY-MM-DD format
        label = null,
        labelPosition = "top",
        min = null, // YYYY-MM-DD
        max = null, // YYYY-MM-DD
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        disabled = false,
    } = $props();
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
            type="date"
            bind:value
            class={`form-control ${customClass}`}
            {disabled}
            {min}
            {max}
        />
    </div>
{:else}
    <input
        {id}
        type="date"
        bind:value
        class={`form-control ${customClass}`}
        style={customStyle}
        {disabled}
        {min}
        {max}
    />
{/if}

<style>
    /* When label is on the left, make it take minimum width needed */
    .d-flex label {
        flex-shrink: 0;
    }

    /* Basic styling for date input - browser defaults can be inconsistent */
    input[type="date"] {
        /* Add specific styling if needed to override browser defaults */
        /* For example: */
        /* appearance: none; */
        /* padding: 0.375rem 0.75rem; */
    }
</style>
