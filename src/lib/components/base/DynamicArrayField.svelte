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
                            <select
                                class="form-select"
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
                            <textarea
                                class="form-control"
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
                            <input
                                type={fieldConfig.type || "text"}
                                class="form-control"
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
        </div>
    {/each}

    <!-- Add Button -->
    {#if !maxItems || arrayValue.length < maxItems}
        <button type="button" class="btn btn-outline-primary" onclick={addItem}>
            <i class="bi bi-plus"></i>
            {addButtonText}
        </button>
    {/if}

    <!-- Array-level validation errors -->
    {#if errors.length > 0}
        <div class="invalid-feedback d-block mt-2">
            {errors.join(", ")}
        </div>
    {/if}
</div>

<style>
    /* Clean, minimal styling */
</style>
