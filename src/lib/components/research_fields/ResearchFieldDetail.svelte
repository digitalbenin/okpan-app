<script>
    import { createEventDispatcher } from "svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import { Tabs } from "melt/builders";

    // --- Prop definition ---
    let { researchField, projectLanguages } = $props();

    // --- State variable to track the ID processed by the effect ---
    let previousResearchFieldId = $state(null);

    // --- Internal State ---
    let nameContent = $state({});
    let descriptionContent = $state({});
    let typeContent = $state(""); // Research field 'type' is not translatable per schema

    // --- Keep Tab State ---
    let activeLanguageCode = $state("");
    let defaultLanguageCode = $state("");

    // --- Keep Tabs builder ---
    const tabs = new Tabs({
        value: () => activeLanguageCode,
        onValueChange: (v) => {
            if (v) activeLanguageCode = v;
        },
    });

    // --- Effect to sync prop to internal state (with GUARD) ---
    $effect(() => {
        const currentId = researchField?.id;

        if (!currentId || currentId === previousResearchFieldId) {
            return; // Exit the effect early if ID hasn't changed or is null
        }

        // --- Logic to update internal state based on `researchField` AND `projectLanguages` prop ---
        if (researchField && projectLanguages && projectLanguages.length > 0) {
            // Determine default and active language first
            const defaultLang = projectLanguages.find(
                (lang) => lang.is_default,
            );
            const newDefaultLangCode = defaultLang
                ? defaultLang.language_code
                : projectLanguages[0].language_code;
            defaultLanguageCode = newDefaultLangCode; // Update state

            if (
                !activeLanguageCode ||
                !projectLanguages.some(
                    (l) => l.language_code === activeLanguageCode,
                )
            ) {
                activeLanguageCode = newDefaultLangCode;
            }
            tabs.value = activeLanguageCode; // Sync tab builder value

            // Sync non-translatable field 'type'
            typeContent = researchField.type ?? "";

            // Sync translatable fields (name, description)
            let tempName = {};
            let tempDescription = {};
            projectLanguages.forEach((lang) => {
                const code = lang.language_code;
                const isDefault = code === newDefaultLangCode;

                // Extract content for the default language directly
                // Extract content for other languages from the translations array
                tempName[code] =
                    (isDefault && researchField.name?.content) ||
                    researchField.name?.translations?.find(
                        (t) => t.language_code === code,
                    )?.content ||
                    "";
                tempDescription[code] =
                    (isDefault && researchField.description?.content) ||
                    researchField.description?.translations?.find(
                        (t) => t.language_code === code,
                    )?.content ||
                    "";
            });
            nameContent = tempName;
            descriptionContent = tempDescription;
        } else {
            // Reset internal state if researchField is null or languages are missing
            nameContent = {};
            descriptionContent = {};
            typeContent = "";
            defaultLanguageCode = "";
            activeLanguageCode = "";
            tabs.value = undefined; // Reset tab builder value
        }
        previousResearchFieldId = currentId; // Update the processed ID
    });

    const dispatch = createEventDispatcher();

    // --- handleSave to read from internal state ---
    function handleSave() {
        if (!researchField?.id || !defaultLanguageCode || !projectLanguages) {
            console.error("Missing data for saving research field.");
            return;
        }

        // Prepare translations payload from internal state
        const nameTrans = [];
        const descriptionTrans = [];
        projectLanguages.forEach((lang) => {
            const langCode = lang.language_code;
            if (langCode !== defaultLanguageCode) {
                // Find original translation ID if it exists in the original prop
                const originalNameTrans =
                    researchField.name?.translations?.find(
                        (t) => t.language_code === langCode,
                    );
                const originalDescriptionTrans =
                    researchField.description?.translations?.find(
                        (t) => t.language_code === langCode,
                    );

                // Add if content exists in state for this language
                if (nameContent[langCode] !== undefined) {
                    nameTrans.push({
                        id: originalNameTrans?.id, // Pass original ID if exists
                        language_code: langCode,
                        content: nameContent[langCode] || "",
                    });
                }
                if (descriptionContent[langCode] !== undefined) {
                    descriptionTrans.push({
                        id: originalDescriptionTrans?.id,
                        language_code: langCode,
                        content: descriptionContent[langCode] || "",
                    });
                }
            }
        });

        const updatedDataPayload = {
            // Non-translatable field from state
            type: typeContent,
            // Default language content for translatable fields from state
            name: nameContent[defaultLanguageCode] || "",
            description: descriptionContent[defaultLanguageCode] || "",
            // Pass original text IDs from the prop (important for backend update logic)
            original_name_id: researchField.name?.id,
            original_description_id: researchField.description?.id,
            // Pass prepared translations arrays
            nameTranslations: nameTrans.filter((t) => t.content !== undefined),
            descriptionTranslations: descriptionTrans.filter(
                (t) => t.content !== undefined,
            ),
        };

        // Clean up undefined payload keys (optional, but good practice)
        Object.keys(updatedDataPayload).forEach(
            (key) =>
                updatedDataPayload[key] === undefined &&
                delete updatedDataPayload[key],
        );

        console.log(
            "Dispatching save for RF:",
            researchField.id,
            updatedDataPayload,
        );
        dispatch("save", { id: researchField.id, data: updatedDataPayload });
    }

    function handleDelete() {
        if (!researchField?.id) {
            console.error("Research Field ID is missing, cannot delete.");
            return;
        }
        dispatch("delete", { id: researchField.id });
    }
</script>

<div class="p-2 research-field-detail-form">
    <h5 id="research-field-detail-title" class="mb-4">Edit research field</h5>

    <!-- Language Tabs -->
    {#if projectLanguages && projectLanguages.length > 1}
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            {#each projectLanguages as lang}
                {@const langCode = lang.language_code}
                <button
                    {...tabs.getTrigger(langCode)}
                    type="button"
                    class="nav-link {lang.is_default ? 'fw-bold' : ''}"
                    role="tab"
                    aria-selected={activeLanguageCode === langCode}
                    data-active={activeLanguageCode === langCode
                        ? ""
                        : undefined}
                >
                    {lang.language?.name || lang.language_code}
                    {#if lang.is_default}<span
                            class="badge bg-secondary ms-1 small">Default</span
                        >{/if}
                </button>
            {/each}
        </div>

        <!-- Tab Content -->
        {#each projectLanguages as lang}
            {@const langCode = lang.language_code}
            {@const langName = lang.language?.name || lang.language_code}
            <div {...tabs.getContent(langCode)} class="pt-2">
                <div class="d-flex flex-column gap-3">
                    <!-- Binding to internal state per language -->
                    <BaseInput
                        label="Name *"
                        bind:value={nameContent[langCode]}
                        placeholder={`Enter name in ${langName}...`}
                    />
                    <BaseTextArea
                        label="Description"
                        bind:value={descriptionContent[langCode]}
                        placeholder={`Enter description in ${langName}...`}
                        rows={4}
                        maxLength={500}
                    />
                </div>
            </div>
        {/each}

        <hr class="my-4" />
    {:else if projectLanguages && projectLanguages.length === 1}
        {@const langCode = projectLanguages[0].language_code}
        {@const langName = projectLanguages[0].language?.name || langCode}
        <div class="d-flex flex-column gap-3">
            <!-- Binding to internal state for single language -->
            <BaseInput
                label="Name *"
                bind:value={nameContent[langCode]}
                placeholder={`Enter name in ${langName}...`}
            />
            <BaseTextArea
                label="Description"
                bind:value={descriptionContent[langCode]}
                placeholder={`Enter description in ${langName}...`}
                rows={4}
                maxLength={500}
            />
        </div>
        <hr class="my-4" />
    {/if}

    <!-- Non-Translatable Fields - Binding to internal state -->
    <div class="d-flex flex-column gap-3">
        <BaseInput
            label="Type"
            bind:value={typeContent}
            placeholder="Enter field type (e.g., category, tag)"
        />
        <!-- Add other non-translatable fields here if needed -->
    </div>
</div>

<!-- Action Buttons -->
<div class="d-flex justify-content-end gap-2 mt-4 p-2">
    <button type="button" class="btn btn-sm btn-danger" onclick={handleDelete}
        >Delete</button
    >
    <button type="button" class="btn btn-sm btn-success" onclick={handleSave}
        >Save Changes</button
    >
</div>

<style>
    /* Style Melt UI tabs using data attributes - Copied from DatasourceDetail */
    [data-melt-tabs-trigger] {
        background: none;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem 0.25rem 0 0;
        cursor: pointer;
        border-bottom: 1px solid transparent;
        margin-bottom: -1px;
    }
    [data-melt-tabs-trigger][data-state="active"] {
        border: 1px solid #dee2e6;
        border-bottom-color: white;
        background-color: white;
        color: var(--bs-nav-tabs-link-active-color, #495057);
    }
    [data-melt-tabs-trigger]:not([data-state="active"]) {
        color: var(--bs-nav-link-color, #0d6efd);
    }
    [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
        border-color: var(--bs-border-color-translucent, #dee2e6);
        color: var(--bs-nav-link-hover-color, #0a58ca);
    }
    .nav-tabs {
        border-bottom: 1px solid #dee2e6;
    }
    .research-field-detail-form :global(label.form-label) {
        font-weight: bold;
    }
</style>
