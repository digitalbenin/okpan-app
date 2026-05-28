<script>
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";
    import ConnectionFieldsSelector from "$lib/components/research_fields/ConnectionFieldsSelector.svelte";

    let {
        open = $bindable(false),
        basicInfo = $bindable({ name: "", description: "", onwebsite: false }),
        config = $bindable({}),
        isSaving = false,
        onSave,
        t
    } = $props();
</script>

{#if open}
    <!-- Custom Bootstrap Modal for Edit -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="modal fade show d-block"
        style="background-color: rgba(0,0,0,0.5);"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        onclick={() => (open = false)}
    >
        <div
            class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="modal-content">
                <div class="modal-header">
                    <p class="modal-title">
                        {t?.("project.edit_connection_type", { fallback: "Edit connection type" })}
                    </p>
                    <button
                        type="button"
                        class="btn-close"
                        aria-label={t?.("common.close", { fallback: "Close" })}
                        onclick={() => (open = false)}
                    ></button>
                </div>
                <div class="modal-body p-4">
                    <p class="mb-3">
                        {t?.("project.connection_type_information", {
                            fallback: "Connection type information"
                        })}
                    </p>
                    <div class="mb-3">
                        <label for="edit-title" class="form-label">
                            {t?.("project.connection-type.title", { fallback: "Connection type name" })}
                        </label>
                        <input
                            id="edit-title"
                            type="text"
                            class="form-control"
                            bind:value={basicInfo.name}
                        />
                    </div>
                    <div class="mb-3">
                        <label for="edit-description" class="form-label">
                            {t?.("common.description", { fallback: "Description" })}
                        </label>
                        <textarea
                            id="edit-description"
                            class="form-control"
                            rows="3"
                            bind:value={basicInfo.description}
                        ></textarea>
                    </div>
                    <div class="mb-4">
                        <BaseToggle
                            bind:value={basicInfo.onwebsite}
                            label={t?.("common.visibility", { fallback: "Visibility on the website" })}
                            labelPosition="left"
                        />
                        <div class="text-muted small">
                            {basicInfo.onwebsite
                                ? t?.("common.published", { fallback: "Published" })
                                : t?.("common.not-published", { fallback: "Not published" })}
                        </div>
                    </div>

                    <hr />

                    <p class="mb-3">{t?.("project.data_fields", { fallback: "Data fields" })}</p>
                    <ConnectionFieldsSelector bind:config={config} />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick={() => (open = false)}>
                        {t?.("common.cancel", { fallback: "Cancel" })}
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary"
                        onclick={() => onSave?.()}
                        disabled={isSaving}
                    >
                        {#if isSaving}
                            <span
                                class="spinner-border spinner-border-sm me-2"
                                role="status"
                                aria-hidden="true"
                            ></span>
                        {/if}
                        {t?.("common.save", { fallback: "Save" })}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
