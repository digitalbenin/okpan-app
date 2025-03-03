<script>
    import { Select } from "melt/builders";

    let {
        options = [],
        value = $bindable(""),
        label = null,
        labelPosition = "top",
        placeholder = "Select an option...",
        icon,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        disabled = false,
    } = $props();

    const select = new Select({
        defaultValue: value,
        onValueChange: (v) => (value = v),
    });

    // Keep the external value in sync with the select's internal value
    $effect(() => {
        if (value !== select.value) {
            select.value = value;
        }
    });

    const triggerId = `select-${id}`;
</script>

{#if label}
    <div
        class={`${labelPosition === "left" ? "d-flex align-items-center gap-3" : ""}`}
        style={customStyle}
    >
        <div class="form-label mb-0">
            {label}
        </div>
        <div class="position-relative flex-grow-1">
            <button
                type="button"
                {...select.trigger}
                {disabled}
                class={`form-select d-flex justify-content-between align-items-center px-3 gap-2 ${customClass}`}
            >
                <span
                    class={`${icon ? "d-flex align-items-center gap-2" : ""} ${!select.value ? "text-muted" : ""}`}
                >
                    {#if icon}
                        <i class={`bi bi-${icon}`}></i>
                    {/if}
                    <span class="pe-3">{select.value || placeholder}</span>
                </span>
            </button>

            <div
                {...select.content}
                class="position-absolute mt-1 shadow-sm bg-white border rounded-2 py-1 z-1 m-0"
            >
                {#each options as option}
                    <div
                        {...select.getOption(option)}
                        class="px-3 py-1 cursor-pointer d-flex align-items-center gap-2 {option ===
                        select.value
                            ? 'bg-primary bg-opacity-10'
                            : ''} {option === select.highlighted
                            ? 'bg-primary bg-opacity-10'
                            : ''}"
                    >
                        {#if option === select.value}
                            <i class="bi bi-check2 text-primary"></i>
                        {/if}
                        <span
                            class={option === select.value ||
                            option === select.highlighted
                                ? "text-primary"
                                : ""}
                        >
                            {option}
                        </span>
                    </div>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <div class="position-relative" style={customStyle}>
        <button
            type="button"
            {...select.trigger}
            {disabled}
            class={`form-select d-flex justify-content-between align-items-center px-3 gap-2 ${customClass}`}
        >
            <span
                class={`${icon ? "d-flex align-items-center gap-2" : ""} ${!select.value ? "text-muted" : ""}`}
            >
                {#if icon}
                    <i class={`bi bi-${icon}`}></i>
                {/if}
                <span class="pe-3">{select.value || placeholder}</span>
            </span>
        </button>

        <div
            {...select.content}
            class="position-absolute mt-1 shadow-sm bg-white border rounded-2 py-1 z-1 m-0"
        >
            {#each options as option}
                <div
                    {...select.getOption(option)}
                    class="px-3 py-1 cursor-pointer d-flex align-items-center gap-2 {option ===
                    select.value
                        ? 'bg-primary bg-opacity-10'
                        : ''} {option === select.highlighted
                        ? 'bg-primary bg-opacity-10'
                        : ''}"
                >
                    {#if option === select.value}
                        <i class="bi bi-check2 text-primary"></i>
                    {/if}
                    <span
                        class={option === select.value ||
                        option === select.highlighted
                            ? "text-primary"
                            : ""}
                    >
                        {option}
                    </span>
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .cursor-pointer {
        cursor: pointer;
    }
</style>
