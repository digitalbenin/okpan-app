<script>
    import { createEventDispatcher } from "svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { Tabs } from "melt/builders";

    // --- Prop definition ---
    let { researchField, projectLanguages } = $props();

    // --- State variable to track the ID processed by the effect ---
    let previousResearchFieldId = $state(null);

    // --- Internal State ---
    let nameContent = $state({});
    let descriptionContent = $state({});
    let typeContent = $state(""); // Research field 'type' is not translatable per schema
    let expandedVocabularies = $state({}); // Added for Read more/less

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
                ? defaultLang.code
                : projectLanguages[0].code;
            defaultLanguageCode = newDefaultLangCode; // Update state

            if (
                !activeLanguageCode ||
                !projectLanguages.some((l) => l.code === activeLanguageCode)
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
                const code = lang.code;
                const isDefault = code === newDefaultLangCode;

                // Extract content for the default language directly
                // Extract content for other languages from the translations array
                tempName[code] =
                    (isDefault && researchField.name?.content) ||
                    researchField.name?.translations?.find(
                        (t) => t.language?.code === code,
                    )?.content ||
                    "";
                tempDescription[code] =
                    (isDefault && researchField.description?.content) ||
                    researchField.description?.translations?.find(
                        (t) => t.language?.code === code,
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
            const langCode = lang.code;
            if (langCode !== defaultLanguageCode) {
                // Find original translation ID if it exists in the original prop
                const originalNameTrans =
                    researchField.name?.translations?.find(
                        (t) => t.language?.code === langCode,
                    );
                const originalDescriptionTrans =
                    researchField.description?.translations?.find(
                        (t) => t.language?.code === langCode,
                    );

                // Add if content exists in state for this language
                if (nameContent[langCode] !== undefined) {
                    nameTrans.push({
                        id: originalNameTrans?.id, // Pass original ID if exists
                        language_code: langCode, // Use language code for consistency with other entities
                        content: nameContent[langCode] || "",
                    });
                }
                if (descriptionContent[langCode] !== undefined) {
                    descriptionTrans.push({
                        id: originalDescriptionTrans?.id,
                        language_code: langCode, // Use language code for consistency with other entities
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

    // Helper function to get the URL for a vocabulary's main asset
    function getVocabularyAssetUrl(asset) {
        if (!asset) return null;
        let imageUrl = null;

        if (asset.formats && typeof asset.formats === "object") {
            // Prefer smaller formats first for thumbnails
            imageUrl =
                asset.formats.sm ||
                asset.formats.md ||
                asset.formats.lg ||
                asset.formats.original;
        }
        // Fallback to path if formats didn't yield a URL
        if (!imageUrl) {
            imageUrl = asset.path;
        }

        return imageUrl ? `media://${imageUrl}` : null;
    }

    // Helper function to toggle vocabulary description expansion
    function toggleVocabularyExpansion(vocabId) {
        expandedVocabularies[vocabId] = !expandedVocabularies[vocabId];
    }

    const DESCRIPTION_TRUNCATE_LENGTH = 140;
</script>

<div class="p-2 research-field-detail-form">
    <h5 id="research-field-detail-title" class="mb-4">Edit research field</h5>

    <!-- Language Tabs -->
    {#if projectLanguages && projectLanguages.length > 1}
        <div {...tabs.triggerList} class="nav nav-tabs mb-3" role="tablist">
            {#each projectLanguages as lang}
                {@const langCode = lang.code}
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
                    {lang.name || lang.code}
                    {#if lang.is_default}<span
                            class="badge bg-secondary ms-1 small">Default</span
                        >{/if}
                </button>
            {/each}
        </div>

        <!-- Tab Content -->
        {#each projectLanguages as lang}
            {@const langCode = lang.code}
            {@const langName = lang.name || lang.code}
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
    {:else if projectLanguages && projectLanguages.length === 1}
        {@const langCode = projectLanguages[0].code}
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

    <!-- Vocabulary Section -->
    {#if researchField?.vocabularies && researchField.vocabularies.length > 0}
        <h6 class="h6 fw-bold text-dark mt-5 mb-1 pb-1">Vocabulary</h6>
        <div class="list-group list-group-flush vocabulary-list">
            {#each researchField.vocabularies as vocabulary (vocabulary.id)}
                {@const originalDescription =
                    vocabulary.description?.content || "No description."}
                {@const isLongDescription =
                    originalDescription.length > DESCRIPTION_TRUNCATE_LENGTH}
                {@const isExpanded = !!expandedVocabularies[vocabulary.id]}
                {@const displayDescription =
                    isLongDescription && !isExpanded
                        ? originalDescription.substring(
                              0,
                              DESCRIPTION_TRUNCATE_LENGTH,
                          ) + "..."
                        : originalDescription}

                <div
                    class="list-group-item d-flex align-items-start gap-3 px-0 py-2"
                >
                    {#if vocabulary.mainAsset}
                        <BaseImage
                            src={getVocabularyAssetUrl(vocabulary.mainAsset)}
                            alt={vocabulary.option?.content ||
                                "Vocabulary image"}
                            width={75}
                            height={75}
                            objectFit="cover"
                            customClass="rounded flex-shrink-0"
                            ratio="1x1"
                        />
                    {:else}
                        <div
                            class="bg-light rounded flex-shrink-0 d-flex align-items-center justify-content-center"
                            style="width: 75px; height: 75px; font-size: 2rem; color: #ccc;"
                        >
                            <i class="bi bi-image"></i>
                        </div>
                    {/if}
                    <div class="flex-grow-1">
                        <strong class="d-block mb-1"
                            >{vocabulary.option?.content ||
                                "Unnamed Option"}</strong
                        >
                        <small class="text-muted d-block">
                            {displayDescription}
                            {#if isLongDescription}
                                <button
                                    type="button"
                                    class="btn btn-link btn-sm p-0 ms-1 align-baseline"
                                    onclick={() =>
                                        toggleVocabularyExpansion(
                                            vocabulary.id,
                                        )}
                                >
                                    {isExpanded ? "Read less" : "Read more..."}
                                </button>
                            {/if}
                        </small>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
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
    .vocabulary-list .list-group-item:last-child {
        border-bottom: none; /* Optional: remove border from last item if using list-group-flush */
    }
</style>
