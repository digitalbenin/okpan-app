<script>
    import BaseButton from "./BaseButton.svelte";
    let {
        value = $bindable([]),
        itemFields = [],
        addButtonText = "Add Item",
        minItems = 0,
        maxItems = null,
        class: customClass = "",
        onChange = null,
        errors = [],
        structuredErrors = [], // Raw validation errors with path arrays
        fieldValidators = null, // Optional field-level validators for individual items
        arrayFieldName = "", // The name of the array field for error matching
    } = $props();

    // Ensure we have an array value
    const arrayValue = $derived(Array.isArray(value) ? value : []);

    function addItem() {
        if (maxItems && arrayValue.length >= maxItems) return;

        // Create new item with default values
        const newItem = {};
        itemFields.forEach((fieldConfig) => {
            newItem[fieldConfig.name] = fieldConfig.defaultValue || "";
        });

        const newArray = [...arrayValue, newItem];
        value = newArray;
        onChange?.(newArray);
    }

    function removeItem(index) {
        if (arrayValue.length <= minItems) return;

        const newArray = arrayValue.filter((_, i) => i !== index);
        value = newArray;
        onChange?.(newArray);
    }

    function updateItem(index, fieldName, fieldValue) {
        const newArray = [...arrayValue];
        newArray[index] = { ...newArray[index], [fieldName]: fieldValue };
        value = newArray;
        onChange?.(newArray);
    }

    // Generic error matching - purely data-driven
    function getFieldErrors(index, fieldName) {
        // Try structured errors first (preferred)
        if (structuredErrors && Array.isArray(structuredErrors)) {
            const structuredFieldErrors = structuredErrors
                .filter((error) => {
                    const match =
                        typeof error === "object" &&
                        error !== null &&
                        error.path &&
                        Array.isArray(error.path) &&
                        error.path.length >= 3 &&
                        error.path[0] === arrayFieldName &&
                        error.path[1] === index &&
                        error.path[2] === fieldName;

                    return match;
                })
                .map((error) => error.message);

            if (structuredFieldErrors.length > 0) {
                return structuredFieldErrors;
            }
        }

        // Don't show fallback errors if structured errors are available
        // This prevents all fields from being highlighted when only one has an error
        return [];
    }

    function getArrayLevelErrors() {
        // Only show array-level errors if structured errors are working
        if (structuredErrors && Array.isArray(structuredErrors)) {
            return structuredErrors
                .filter((error) => {
                    // Array-level errors have path length <= 1 or don't match our array field
                    return (
                        typeof error === "object" &&
                        error !== null &&
                        error.path &&
                        Array.isArray(error.path) &&
                        (error.path.length <= 1 ||
                            error.path[0] !== arrayFieldName ||
                            error.path.length < 3)
                    );
                })
                .map((error) => error.message);
        }

        // Fallback: don't show string errors at array level if structured errors are expected but empty
        return [];
    }
</script>

<div class="dynamic-array-field {customClass}">
    <!-- Array Items -->
    {#each arrayValue as item, index}
        <div class="mb-3">
            <div class="row g-2 align-items-end">
                {#each itemFields as fieldConfig}
                    <div class="col-{fieldConfig.colSize || 6}">
                        {#if index === 0}
                            <p class="form-label">
                                {fieldConfig.label}
                                {#if fieldConfig.required}
                                    <span class="text-danger">*</span>
                                {/if}
                            </p>
                        {/if}

                        {#if fieldConfig.type === "select"}
                            {@const fieldErrors = getFieldErrors(
                                index,
                                fieldConfig.name,
                            )}
                            <select
                                class="form-select {fieldErrors.length > 0
                                    ? 'is-invalid'
                                    : ''}"
                                value={item[fieldConfig.name] || ""}
                                onchange={(e) =>
                                    updateItem(
                                        index,
                                        fieldConfig.name,
                                        e.target.value,
                                    )}
                            >
                                <option value=""
                                    >Select {fieldConfig.label}...</option
                                >
                                {#each fieldConfig.options || [] as option}
                                    <option value={option.value}
                                        >{option.label}</option
                                    >
                                {/each}
                            </select>
                        {:else if fieldConfig.type === "textarea"}
                            {@const fieldErrors = getFieldErrors(
                                index,
                                fieldConfig.name,
                            )}
                            <textarea
                                class="form-control {fieldErrors.length > 0
                                    ? 'is-invalid'
                                    : ''}"
                                rows={fieldConfig.rows || 3}
                                placeholder={fieldConfig.placeholder || ""}
                                value={item[fieldConfig.name] || ""}
                                oninput={(e) =>
                                    updateItem(
                                        index,
                                        fieldConfig.name,
                                        e.target.value,
                                    )}
                            ></textarea>
                        {:else}
                            {@const fieldErrors = getFieldErrors(
                                index,
                                fieldConfig.name,
                            )}
                            <input
                                type={fieldConfig.type || "text"}
                                class="form-control {fieldErrors.length > 0
                                    ? 'is-invalid'
                                    : ''}"
                                placeholder={fieldConfig.placeholder || ""}
                                value={item[fieldConfig.name] || ""}
                                oninput={(e) =>
                                    updateItem(
                                        index,
                                        fieldConfig.name,
                                        e.target.value,
                                    )}
                            />
                        {/if}
                    </div>
                {/each}

                <!-- Delete Button Column -->
                <div class="col-auto">
                    {#if arrayValue.length > minItems}
                        <BaseButton
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            icon="trash"
                            text=""
                            onClick={() => removeItem(index)}
                        />
                    {:else}
                        <!-- Placeholder to maintain alignment -->
                        <div style="width: 32px; height: 32px;"></div>
                    {/if}
                </div>
            </div>

            <!-- Field-specific error display -->
            <div class="row g-2 mt-1">
                {#each itemFields as fieldConfig}
                    {@const fieldErrors = getFieldErrors(
                        index,
                        fieldConfig.name,
                    )}
                    <div class="col-{fieldConfig.colSize || 6}">
                        {#if fieldErrors.length > 0}
                            <div class="invalid-feedback d-block">
                                {fieldErrors.join(", ")}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/each}

    <!-- Add Button -->
    {#if !maxItems || arrayValue.length < maxItems}
        <button type="button" class="btn btn-outline-primary" onclick={addItem}>
            <i class="bi bi-plus"></i>
            {addButtonText}
        </button>
    {/if}

    <!-- Array-level errors -->
    {#if getArrayLevelErrors().length > 0}
        <div class="invalid-feedback d-block mt-2">
            {getArrayLevelErrors().join(", ")}
        </div>
    {/if}
</div>

<style>
    /* Clean, minimal styling */
</style>
