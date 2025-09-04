<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import MediaManager from "$lib/components/research_fields/MediaManager.svelte";
    import {
        addVocabulary as addVocabularyAPI,
        updateVocabulary as updateVocabularyAPI,
        deleteVocabulary as deleteVocabularyAPI,
    } from "$lib/stores/ResearchFieldsUtils.js";
    import { executeQuery } from "$lib/stores/GraphqlUtils.js";

    const { t } = getTranslationStore();

    let {
        value = $bindable(),
        languages = [],
        errors = [],
        structuredErrors = [],
        maxVocabularies = 50,
        activeLanguageCode = "default", // Current active language tab
        selectedType = "free text", // Current selected type from parent form
        class: customClass = "",
        onChange = null, // AutoForm passes this callback
        // New props for vocabulary processing
        mode = "create", // "create" or "edit"
        initialData = null, // For edit mode
        projectId = null,
        onVocabulariesProcessed = null, // Callback when processing is complete
    } = $props();

    // Local persistent state to prevent loss during tab changes
    let localVocabularies = $state([]);
    let hasBeenInitialized = $state(false);

    // Initialize local state without creating infinite loops
    function updateBoundValue() {
        if (hasBeenInitialized) {
            const newValue = [...localVocabularies];
            value = newValue;
            // Also call onChange if provided by AutoForm
            if (onChange) {
                onChange(newValue);
            }
            // console.log("updateBoundValue called, setting value to:", $state.snapshot(value));
        }
    }

    // Initialize only once from external value
    if (!hasBeenInitialized) {
        if (value !== undefined && value !== null && Array.isArray(value)) {
            localVocabularies = [...value];
        } else {
            localVocabularies = [];
            value = [];
        }
        hasBeenInitialized = true;
    }

    // Use local state for display
    const vocabularies = $derived(localVocabularies);

    // Get secondary languages (non-default)
    const defaultLanguage = $derived(
        languages?.find((l) => l.is_default) || languages?.[0] || null,
    );
    const secondaryLanguages = $derived(
        languages?.filter((l) => !l.is_default) || [],
    );

    function addVocabulary() {
        if (localVocabularies.length >= maxVocabularies) return;

        const newVocabulary = {
            option: "",
            description: "",
            mainAssetFile: null,
            otherAssetsFiles: [],
        };

        // Add translation fields for secondary languages
        secondaryLanguages.forEach((lang) => {
            newVocabulary[`option_${lang.id}`] = "";
            newVocabulary[`description_${lang.id}`] = "";
        });

        localVocabularies = [...localVocabularies, newVocabulary];
        updateBoundValue();
    }

    function removeVocabulary(index) {
        if (localVocabularies.length <= 0) return;
        localVocabularies = localVocabularies.filter((_, i) => i !== index);
        updateBoundValue();
    }

    function updateVocabulary(index, field, newValue) {
        const updated = [...localVocabularies];
        updated[index] = { ...updated[index], [field]: newValue };
        localVocabularies = updated;
        updateBoundValue();
    }

    function getFieldErrors(index, fieldName) {
        if (!structuredErrors || !Array.isArray(structuredErrors)) return [];

        return structuredErrors
            .filter((error) => {
                return (
                    typeof error === "object" &&
                    error !== null &&
                    error.path &&
                    Array.isArray(error.path) &&
                    error.path.length >= 3 &&
                    error.path[0] === "vocabularies" &&
                    error.path[1] === index &&
                    error.path[2] === fieldName
                );
            })
            .map((error) => error.message);
    }

    // Handle media changes from MediaManager
    function handleMediaChange(index, { mainAsset, otherAssets }) {
        updateVocabulary(index, "mainAssetFile", mainAsset);
        updateVocabulary(index, "otherAssetsFiles", otherAssets);
    }

    // === VOCABULARY PROCESSING FUNCTIONS (moved from ResearchFieldForm) ===

    const { addTranslation } = getContentLanguageStore();

    // Helper to get translation content
    const getTranslationContent = (textObj, langId) =>
        textObj?.translations?.find((t) => t.language_id === langId)?.content ||
        "";

    // Link other assets to vocabulary
    const linkVocabularyAssets = async (vocabularyId, assetIds) => {
        if (!assetIds?.length) return;

        try {
            const values = assetIds.map((assetId, index) => ({
                vocabulary_id: vocabularyId,
                generic_asset_id: assetId,
                order: index,
            }));

            return await executeQuery("vocabulary_assets", "create", {
                values,
            });
        } catch (error) {
            console.error("Error linking vocabulary assets:", error);
            throw error;
        }
    };

    // Create translations for a text field
    const createTranslations = async (translations, textId) => {
        if (
            !translations ||
            !Array.isArray(translations) ||
            translations.length === 0 ||
            !textId
        ) {
            return;
        }

        for (const translation of translations) {
            try {
                const language = secondaryLanguages.find(
                    (lang) => lang.id === translation.language_id,
                );
                if (!language) {
                    console.error(
                        `Language not found for ID: ${translation.language_id}`,
                    );
                    continue;
                }

                await addTranslation(
                    textId,
                    language.code,
                    translation.content,
                );
            } catch (error) {
                console.error("Error creating translation:", error);
            }
        }
    };

    // Check if vocabulary has changed
    const hasVocabularyChanged = (currentVocab, existingVocabs) => {
        const originalVocab = existingVocabs.find(
            (existing) => existing.id === currentVocab.id,
        );
        if (!originalVocab) return true;

        // Compare main fields
        const originalOption = originalVocab.option?.content || "";
        const originalDescription = originalVocab.description?.content || "";
        const currentOption = currentVocab.option || "";
        const currentDescription = currentVocab.description || "";

        if (
            originalOption !== currentOption ||
            originalDescription !== currentDescription
        ) {
            return true;
        }

        // Compare main asset
        const originalMainAssetId = originalVocab.mainAsset?.id || null;
        const currentMainAssetId = currentVocab.mainAssetFile?.id || null;
        const currentHasNewAsset =
            currentVocab.mainAssetFile?.path && !currentVocab.mainAssetFile?.id;

        // If there's a new asset (has path but no id) or the asset IDs are different
        if (currentHasNewAsset || originalMainAssetId !== currentMainAssetId) {
            return true;
        }

        // Compare other assets
        const originalOtherAssetIds = (
            originalVocab.vocabulariesGenericAssets || []
        )
            .map((va) => va.genericAsset.id)
            .sort();

        const currentOtherAssets = currentVocab.otherAssetsFiles || [];
        const currentOtherAssetIds = currentOtherAssets
            .map((file) => file.id)
            .filter((id) => id)
            .sort();

        // Check if there are new assets (files with path but no id)
        const hasNewAssets = currentOtherAssets.some(
            (file) => file.path && !file.id,
        );

        if (
            hasNewAssets ||
            JSON.stringify(originalOtherAssetIds) !==
                JSON.stringify(currentOtherAssetIds)
        ) {
            return true;
        }

        // Compare translations
        return secondaryLanguages.some((lang) => {
            const originalOptionTranslation = getTranslationContent(
                originalVocab.option,
                lang.id,
            );
            const originalDescriptionTranslation = getTranslationContent(
                originalVocab.description,
                lang.id,
            );
            const currentOptionTranslation =
                currentVocab[`option_${lang.id}`] || "";
            const currentDescriptionTranslation =
                currentVocab[`description_${lang.id}`] || "";

            return (
                originalOptionTranslation !== currentOptionTranslation ||
                originalDescriptionTranslation !== currentDescriptionTranslation
            );
        });
    };

    // Create new vocabulary
    const createNewVocabulary = async (
        vocab,
        researchFieldId,
        projectId,
        languageId,
    ) => {
        // Upload assets
        const mainAssetId = await handleAssetUpload(
            vocab.mainAssetFile,
            projectId,
        );
        const otherAssetIds = [];
        if (vocab.otherAssetsFiles?.length) {
            for (const file of vocab.otherAssetsFiles) {
                const assetId = await handleAssetUpload(file, projectId);
                if (assetId) otherAssetIds.push(assetId);
            }
        }

        // Prepare translations
        const { optionTranslations, descriptionTranslations } =
            prepareVocabTranslations(vocab);

        const vocabParams = {
            languageId,
            option: vocab.option,
            description: vocab.description || "",
            mainAsset: mainAssetId,
            otherAssets: otherAssetIds,
            optionTranslations:
                optionTranslations.length > 0 ? optionTranslations : undefined,
            descriptionTranslations:
                descriptionTranslations.length > 0
                    ? descriptionTranslations
                    : undefined,
        };

        const result = await addVocabularyAPI(researchFieldId, vocabParams);

        // Create translations and link assets
        if (result?.result) {
            const createdVocabulary = result.result.insertIntoVocabularies?.[0];
            if (createdVocabulary) {
                await createTranslations(
                    optionTranslations,
                    createdVocabulary.option_id,
                );
                await createTranslations(
                    descriptionTranslations,
                    createdVocabulary.description_id,
                );

                if (otherAssetIds.length > 0) {
                    await linkVocabularyAssets(
                        createdVocabulary.id,
                        otherAssetIds,
                    );
                }
            }
        }

        return result;
    };

    // Prepare vocabulary translations with proper format for GraphQL processing
    const prepareVocabTranslations = (vocab) => {
        const optionTranslations = [];
        const descriptionTranslations = [];

        // Find original vocabulary to get existing translation IDs
        let originalVocab = null;
        if (mode === "edit" && vocab.id && initialData?.vocabularies) {
            originalVocab = initialData.vocabularies.find(
                (v) => v.id === vocab.id,
            );
        }

        secondaryLanguages.forEach((lang) => {
            const optionContent = vocab[`option_${lang.id}`];
            const descriptionContent = vocab[`description_${lang.id}`];

            // Handle option translations
            if (optionContent?.trim()) {
                const translation = {
                    language_code: lang.code,
                    content: optionContent,
                };

                // If updating, try to find existing translation ID
                if (originalVocab?.option?.translations) {
                    const existingTranslation =
                        originalVocab.option.translations.find(
                            (t) => t.language_id === lang.id,
                        );
                    if (existingTranslation) {
                        translation.id = existingTranslation.id;
                    }
                }

                optionTranslations.push(translation);
            }

            // Handle description translations
            if (descriptionContent?.trim()) {
                const translation = {
                    language_code: lang.code,
                    content: descriptionContent,
                };

                // If updating, try to find existing translation ID
                if (originalVocab?.description?.translations) {
                    const existingTranslation =
                        originalVocab.description.translations.find(
                            (t) => t.language_id === lang.id,
                        );
                    if (existingTranslation) {
                        translation.id = existingTranslation.id;
                    }
                }

                descriptionTranslations.push(translation);
            }
        });

        return { optionTranslations, descriptionTranslations };
    };

    // Handle asset upload for vocabulary
    const handleAssetUpload = async (assetFile, projectId) => {
        if (!assetFile) return null;

        // If existing asset, return its ID
        if (assetFile.id) return assetFile.id;

        // If new asset, upload it
        if (assetFile.path) {
            try {
                const result = await window.api.importAssets({
                    path: [assetFile.path],
                    projectId,
                    isGenericAsset: true,
                });
                return result?.createdAssets?.[0]?.id || null;
            } catch (error) {
                console.error("Error uploading asset:", error);
                return null;
            }
        }

        return null;
    };

    // Update existing vocabulary
    const updateExistingVocabulary = async (vocab, languageId) => {
        const { optionTranslations, descriptionTranslations } =
            prepareVocabTranslations(vocab);

        // Handle main asset
        const mainAssetId = await handleAssetUpload(
            vocab.mainAssetFile,
            projectId,
        );

        // Handle other assets
        const otherAssetIds = [];
        if (vocab.otherAssetsFiles?.length) {
            for (const file of vocab.otherAssetsFiles) {
                const assetId = await handleAssetUpload(file, projectId);
                if (assetId) otherAssetIds.push(assetId);
            }
        }

        const updateData = {
            option: vocab.option,
            description: vocab.description || "",
            mainAsset: mainAssetId,
            optionTranslations:
                optionTranslations.length > 0 ? optionTranslations : undefined,
            descriptionTranslations:
                descriptionTranslations.length > 0
                    ? descriptionTranslations
                    : undefined,
        };

        const result = await updateVocabularyAPI(vocab.id, updateData);

        // Handle other assets separately like in create process
        // Check if update was successful
        if (result?.result && !result?.error) {
            // First delete existing other asset links
            try {
                await executeQuery("vocabulary_assets", "delete", {
                    vocabularyId: vocab.id,
                });
            } catch (error) {
                console.error("Error deleting old vocabulary assets:", error);
            }

            // Then create new links if there are other assets
            if (otherAssetIds.length > 0) {
                try {
                    await linkVocabularyAssets(vocab.id, otherAssetIds);
                } catch (error) {
                    console.error("Error linking vocabulary assets:", error);
                }
            }
        }

        return result;
    };

    // Main vocabulary processing function
    const processVocabularies = async (
        vocabularies,
        researchFieldId,
        projectId,
        languageId,
        mode,
    ) => {
        if (mode === "edit") {
            const existingVocabs = initialData.vocabularies || [];
            const currentVocabs = vocabularies.filter((vocab) =>
                vocab.option?.trim(),
            );

            // Delete removed vocabularies
            const vocabsToDelete = existingVocabs.filter(
                (existing) =>
                    !currentVocabs.find(
                        (current) => current.id === existing.id,
                    ),
            );

            await Promise.all(
                vocabsToDelete.map(async (vocab) => {
                    try {
                        await deleteVocabularyAPI(vocab.id);
                    } catch (error) {
                        console.error(
                            `Error deleting vocabulary ${vocab.id}:`,
                            error,
                        );
                    }
                }),
            );

            // Process current vocabularies
            await Promise.all(
                currentVocabs.map(async (vocab) => {
                    try {
                        if (vocab.id) {
                            if (hasVocabularyChanged(vocab, existingVocabs)) {
                                await updateExistingVocabulary(
                                    vocab,
                                    languageId,
                                );
                            }
                        } else {
                            await createNewVocabulary(
                                vocab,
                                researchFieldId,
                                projectId,
                                languageId,
                            );
                        }
                    } catch (error) {
                        console.error("Error processing vocabulary:", error);
                    }
                }),
            );
        } else {
            // Create mode
            const validVocabs = vocabularies.filter((vocab) =>
                vocab.option?.trim(),
            );
            await Promise.all(
                validVocabs.map((vocab) =>
                    createNewVocabulary(
                        vocab,
                        researchFieldId,
                        projectId,
                        languageId,
                    ),
                ),
            );
        }
    };

    // Expose processVocabularies function to parent
    const handleVocabularyProcessing = async (
        researchFieldId,
        projectId,
        languageId,
        mode,
    ) => {
        try {
            await processVocabularies(
                localVocabularies,
                researchFieldId,
                projectId,
                languageId,
                mode,
            );
            if (onVocabulariesProcessed) {
                onVocabulariesProcessed();
            }
        } catch (error) {
            console.error("Error processing vocabularies:", error);
            throw error;
        }
    };

    // Expose the processing function to parent component via callback after initialization
    $effect(() => {
        if (onVocabulariesProcessed && hasBeenInitialized) {
            onVocabulariesProcessed(handleVocabularyProcessing);
        }
    });
</script>

{#if selectedType === "vocabulary"}
    <div class="vocabulary-manager {customClass}">
        <div class="d-flex justify-content-end align-items-center mb-3">
            {#if vocabularies.length < maxVocabularies}
                <BaseButton
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    icon="plus"
                    text={t("common.add-vocabulary", {
                        fallback: "Add Vocabulary",
                    })}
                    onClick={addVocabulary}
                />
            {/if}
        </div>

        {#if vocabularies.length === 0}
            <div class="text-center text-muted py-4">
                <i class="bi bi-list-ul mb-2" style="font-size: 2rem;"></i>
                <p class="mb-0">
                    {t("common.no-vocabularies", {
                        fallback: "No vocabulary options added yet",
                    })}
                </p>
                <small>
                    {t("common.vocabulary-help", {
                        fallback:
                            "Add vocabulary options to provide controlled choices for this research field",
                    })}
                </small>
            </div>
        {:else}
            <!-- Header Row -->
            <div
                class="row g-0 bg-secondary-subtle bg-opacity-25 rounded-top border"
            >
                <div
                    class="col-4 p-2 border-0 border-secondary border-opacity-25 border-end"
                >
                    <div class="d-flex align-items-center gap-2">
                        <strong
                            >{t("common.label", { fallback: "Label" })}</strong
                        >
                    </div>
                </div>
                <div
                    class="col-4 p-2 border-0 border-secondary border-opacity-25 border-end"
                >
                    <div class="d-flex align-items-center gap-2">
                        <strong
                            >{t("common.description", {
                                fallback: "Description",
                            })}</strong
                        >
                    </div>
                </div>
                <div class="col-4 p-2">
                    <div class="d-flex align-items-center gap-2">
                        <strong
                            >{t("common.media", { fallback: "Media" })}</strong
                        >
                    </div>
                </div>
            </div>

            {#each vocabularies as vocab, index}
                <div
                    class="row g-0 border border-top-0 {index ===
                    vocabularies.length - 1
                        ? 'rounded-bottom'
                        : ''}"
                >
                    <!-- Option Column -->
                    <div class="col-4 p-3">
                        <div
                            class="d-flex align-items-center justify-content-start gap-2"
                        >
                            <div class="flex-grow-1">
                                {#if activeLanguageCode === "default"}
                                    {@const fieldErrors = getFieldErrors(
                                        index,
                                        "option",
                                    )}
                                    <input
                                        type="text"
                                        class="form-control {fieldErrors.length >
                                        0
                                            ? 'is-invalid'
                                            : ''}"
                                        placeholder={t(
                                            "common.vocabulary-option-placeholder",
                                            {
                                                fallback:
                                                    "Enter vocabulary option...",
                                            },
                                        )}
                                        value={vocab.option || ""}
                                        oninput={(e) =>
                                            updateVocabulary(
                                                index,
                                                "option",
                                                e.target.value,
                                            )}
                                    />
                                    {#if fieldErrors.length > 0}
                                        <div class="invalid-feedback">
                                            {fieldErrors.join(", ")}
                                        </div>
                                    {/if}
                                {:else}
                                    {@const currentLang = languages.find(
                                        (l) => l.id === activeLanguageCode,
                                    )}
                                    {#if currentLang}
                                        {@const fieldErrors = getFieldErrors(
                                            index,
                                            `option_${currentLang.id}`,
                                        )}
                                        <input
                                            type="text"
                                            class="form-control {fieldErrors.length >
                                            0
                                                ? 'is-invalid'
                                                : ''}"
                                            placeholder={t(
                                                "common.vocabulary-option-translation-placeholder",
                                                {
                                                    fallback: `Option in ${currentLang.name}...`,
                                                },
                                            )}
                                            value={vocab[
                                                `option_${currentLang.id}`
                                            ] || ""}
                                            oninput={(e) =>
                                                updateVocabulary(
                                                    index,
                                                    `option_${currentLang.id}`,
                                                    e.target.value,
                                                )}
                                        />
                                        {#if fieldErrors.length > 0}
                                            <div class="invalid-feedback">
                                                {fieldErrors.join(", ")}
                                            </div>
                                        {/if}
                                    {/if}
                                {/if}
                            </div>
                            <!-- Delete Button -->
                            <BaseButton
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                icon="trash"
                                text=""
                                title="Delete vocabulary option"
                                onClick={() => removeVocabulary(index)}
                            />
                        </div>
                    </div>

                    <!-- Description Column -->
                    <div class="col-4 p-3">
                        {#if activeLanguageCode === "default"}
                            {@const fieldErrors = getFieldErrors(
                                index,
                                "description",
                            )}
                            <textarea
                                class="form-control {fieldErrors.length > 0
                                    ? 'is-invalid'
                                    : ''}"
                                rows="5"
                                placeholder={t(
                                    "common.vocabulary-description-placeholder",
                                    {
                                        fallback: "Optional description...",
                                    },
                                )}
                                value={vocab.description || ""}
                                oninput={(e) =>
                                    updateVocabulary(
                                        index,
                                        "description",
                                        e.target.value,
                                    )}
                            ></textarea>
                            {#if fieldErrors.length > 0}
                                <div class="invalid-feedback">
                                    {fieldErrors.join(", ")}
                                </div>
                            {/if}
                        {:else}
                            {@const currentLang = languages.find(
                                (l) => l.id === activeLanguageCode,
                            )}
                            {#if currentLang}
                                {@const fieldErrors = getFieldErrors(
                                    index,
                                    `description_${currentLang.id}`,
                                )}
                                <textarea
                                    class="form-control {fieldErrors.length > 0
                                        ? 'is-invalid'
                                        : ''}"
                                    rows="3"
                                    placeholder={t(
                                        "common.vocabulary-description-translation-placeholder",
                                        {
                                            fallback: `Description in ${currentLang.name}...`,
                                        },
                                    )}
                                    value={vocab[
                                        `description_${currentLang.id}`
                                    ] || ""}
                                    oninput={(e) =>
                                        updateVocabulary(
                                            index,
                                            `description_${currentLang.id}`,
                                            e.target.value,
                                        )}
                                ></textarea>
                                {#if fieldErrors.length > 0}
                                    <div class="invalid-feedback">
                                        {fieldErrors.join(", ")}
                                    </div>
                                {/if}
                            {/if}
                        {/if}
                    </div>

                    <!-- Media Column -->
                    <div class="col-4 p-3">
                        <MediaManager
                            bind:mainAsset={vocab.mainAssetFile}
                            bind:otherAssets={vocab.otherAssetsFiles}
                            acceptedTypes={["image", "audio", "video"]}
                            maxAssets={10}
                            onChange={(mediaData) =>
                                handleMediaChange(index, mediaData)}
                        />
                    </div>
                </div>
            {/each}
        {/if}

        <!-- Overall errors 
        {#if errors.length > 0}
            <div class="alert alert-danger">
                {errors.join(", ")}
            </div>
        {/if} -->
    </div>
{/if}

<style>
    .vocabulary-item {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6 !important;
    }

    .translation-section {
        border-top: 1px solid #dee2e6;
        padding-top: 1rem;
        margin-top: 1rem;
    }
</style>
