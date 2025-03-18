<script>
    import { Select } from "melt/builders";

    let {
        options = [],
        value = $bindable(null),
        label = null,
        labelPosition = "top",
        placeholder = "Select a value",
        icon,
        class: customClass = "",
        style: customStyle = "",
        id = crypto.randomUUID(),
        disabled = false,
        multiple = false,
    } = $props();

    const select = new Select({
        onValueChange: (v) =>
            multiple ? (value = v.size ? Array.from(v) : null) : (value = v),
        multiple,
    });

    // Helper to check if an option is selected
    const isSelected = (option) => {
        if (!select.value) return false;
        if (multiple) {
            return select.value instanceof Set
                ? select.value.has(option)
                : Array.isArray(select.value) && select.value.includes(option);
        }
        return option === select.value;
    };

    // Helper to get display text
    const getDisplayText = () => {
        if (multiple) {
            const vals = select.value.size
                ? Array.from(select.value).filter((a) => a)
                : null;
            return vals?.length ? vals.join(", ") : placeholder;
        }
        return select.value || placeholder;
    };
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
                    <span class="pe-3 text-truncate">
                        {getDisplayText()}
                    </span>
                </span>
            </button>

            <div
                {...select.content}
                class="position-absolute mt-1 shadow-sm bg-white border rounded-2 py-1 z-1 m-0 w-100"
            >
                {#each options as option}
                    <div
                        {...select.getOption(option)}
                        class="px-3 py-1 cursor-pointer d-flex align-items-center gap-2 {isSelected(
                            option,
                        )
                            ? 'bg-primary bg-opacity-10'
                            : ''} {option === select.highlighted
                            ? 'bg-primary bg-opacity-10'
                            : ''}"
                    >
                        <div
                            class="d-flex align-items-center"
                            style="width: 20px;"
                        >
                            {#if isSelected(option)}
                                <i class="bi bi-check2 text-primary"></i>
                            {/if}
                        </div>
                        <span
                            class={isSelected(option) ||
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
                <span class="pe-3 text-truncate">
                    {getDisplayText()}
                </span>
            </span>
            <i class="bi bi-chevron-down"></i>
        </button>

        <div
            {...select.content}
            class="position-absolute mt-1 shadow-sm bg-white border rounded-2 py-1 z-1 m-0 w-100"
        >
            {#each options as option}
                <div
                    {...select.getOption(option)}
                    class="px-3 py-1 cursor-pointer d-flex align-items-center gap-2 {isSelected(
                        option,
                    )
                        ? 'bg-primary bg-opacity-10'
                        : ''} {option === select.highlighted
                        ? 'bg-primary bg-opacity-10'
                        : ''}"
                >
                    <div class="d-flex align-items-center" style="width: 20px;">
                        {#if isSelected(option)}
                            <i class="bi bi-check2 text-primary"></i>
                        {/if}
                    </div>
                    <span
                        class={isSelected(option) ||
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

    /* Prevent overflow for long selection display */
    .text-truncate {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
