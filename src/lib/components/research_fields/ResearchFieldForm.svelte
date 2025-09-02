<script>
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { createForm } from "@tanstack/svelte-form";
    import {
        getValidator,
        createFieldValidator,
        getFormConfig,
    } from "$lib/stores/formValidationUtils.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { page } from "$app/stores";
    import {
        createResearchField,
        updateResearchField,
        addVocabulary,
        updateVocabulary,
        deleteVocabulary,
    } from "$lib/stores/ResearchFieldsUtils.js";
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import VocabularyManager from "$lib/components/research_fields/VocabularyManager.svelte";
    import TypeSelector from "$lib/components/research_fields/TypeSelector.svelte";

    const { t } = getTranslationStore();
    const { addTranslation } = getContentLanguageStore();

    // Props
    let {
        languages,
        mode = "create", // "create" or "edit"
        initialData = null, // For edit mode
        projectId = null,
        onSuccess = null, // Callback for successful submission
        onCancel = null, // Callback for cancel action
        showTitle = true,
        showDescription = true,
        customTitle = null,
        customDescription = null,
    } = $props();

    // Extract language information
    const defaultLanguage =
        languages?.find((lang) => lang.is_default) || languages?.[0];
    const secondaryLanguages =
        languages?.filter((lang) => !lang.is_default) || [];

    // Translation state - only for translatable fields
    const translatableFields = ["name", "description"];

    // Get appropriate validator based on mode
    const validator = getValidator("research_fields", mode);

    // Store all validation errors for components to use
    let allValidationErrors = $state([]);

    // Helper function to set structured errors
    function setAllValidationErrors(errors) {
        allValidationErrors = errors;
    }

    // Track selected type
    let selectedType = $state(initialData?.type || "free text");

    // Prepare default values based on mode
    const getDefaultValues = () => {
        if (mode === "edit" && initialData) {
            // For edit mode, populate with existing data
            const values = {
                type: initialData.type || "free text",
                name: initialData.name || "",
                description: initialData.description || "",
                vocabularies: initialData.vocabularies || [],
            };

            // Add translation fields for secondary languages
            for (const lang of secondaryLanguages) {
                // Find existing translations
                const nameTranslation = initialData.nameTranslations?.find(
                    (t) => t.language_id === lang.id,
                );
                const descriptionTranslation =
                    initialData.descriptionTranslations?.find(
                        (t) => t.language_id === lang.id,
                    );

                values[`translations_${lang.id}_name`] =
                    nameTranslation?.content || "";
                values[`translations_${lang.id}_description`] =
                    descriptionTranslation?.content || "";
            }

            return values;
        } else {
            // For create mode, use defaults
            return {
                type: "free text",
                vocabularies: [],
            };
        }
    };

    // Dynamic uiSchema that updates based on selected type
    const uiSchema = $derived({
        projectId: { hidden: true },
        languageId: { hidden: true },
        name: {
            label: t("common.research-field-name", {
                fallback: "Research Field Name",
            }),
            colSize: 7,
        },
        description: {
            type: "textarea",
            label: t("common.description", {
                fallback: "Description",
            }),
            colSize: 7,
        },
        type: {
            label: t("common.field-type", {
                fallback: "Field Type",
            }),
            renderer: TypeSelector,
            colSize: 7,
            rendererProps: {
                onTypeChange: (newType) => {
                    selectedType = newType;
                },
            },
        },
        vocabularies: {
            label: "",
            renderer: VocabularyManager,
            colSize: 12,
            rendererProps: {
                languages: languages,
                structuredErrors: allValidationErrors,
                maxVocabularies: 50,
                selectedType: selectedType,
            },
        },
    });

    // Create form instance using optimized config
    const form = createForm(() =>
        getFormConfig("research_fields", mode, {
            defaultValues: getDefaultValues(),
            onSubmit: async ({ value }) => {
                console.log(`onSubmit called for ${mode} - form is valid!`);
                console.log("Form value:", value);
                console.log("Secondary languages:", secondaryLanguages);
                try {
                    // Prepare translation arrays for the mutation
                    const nameTranslations = [];
                    const descriptionTranslations = [];

                    for (const lang of secondaryLanguages) {
                        const nameContent =
                            value[`translations_${lang.id}_name`];
                        const descriptionContent =
                            value[`translations_${lang.id}_description`];

                        // Debug removed - translations are working correctly on frontend

                        if (nameContent?.trim()) {
                            nameTranslations.push({
                                language_id: lang.id,
                                content: nameContent,
                            });
                        }

                        if (descriptionContent?.trim()) {
                            descriptionTranslations.push({
                                language_id: lang.id,
                                content: descriptionContent,
                            });
                        }
                    }

                    // Translation arrays are correctly built - issue is in backend GraphQL resolver

                    let result;

                    if (mode === "create") {
                        // Create mode
                        const createParams = {
                            projectId: value.projectId || projectId,
                            languageId: value.languageId || defaultLanguage?.id,
                            name: value.name,
                            description: value.description,
                            type: value.type,
                            nameTranslations:
                                nameTranslations.length > 0
                                    ? nameTranslations
                                    : undefined,
                            descriptionTranslations:
                                descriptionTranslations.length > 0
                                    ? descriptionTranslations
                                    : undefined,
                        };

                        result = await createResearchField(createParams);

                        if (!result || !result.result) {
                            console.error(
                                "API call failed - no result returned",
                            );
                            throw new Error("Failed to create research field");
                        }

                        // Get the created research field ID and text IDs
                        const researchFieldId = result.result?.[0]?.id;
                        const nameId = result.result?.[0]?.name_id;
                        const descriptionId =
                            result.result?.[0]?.description_id;

                        // Create translations for name and description
                        await createTranslations(nameTranslations, nameId);
                        await createTranslations(
                            descriptionTranslations,
                            descriptionId,
                        );

                        if (
                            value.type === "vocabulary" &&
                            value.vocabularies &&
                            Array.isArray(value.vocabularies) &&
                            value.vocabularies.length > 0
                        ) {
                            await processVocabularies(
                                value.vocabularies,
                                researchFieldId,
                                value.projectId || projectId,
                                value.languageId || defaultLanguage?.id,
                                "create",
                            );
                        }
                    } else {
                        // Edit mode
                        const updateParams = {
                            type: value.type,
                            name: value.name,
                            description: value.description,
                            nameTranslations:
                                nameTranslations.length > 0
                                    ? nameTranslations
                                    : undefined,
                            descriptionTranslations:
                                descriptionTranslations.length > 0
                                    ? descriptionTranslations
                                    : undefined,
                        };

                        result = await updateResearchField(
                            initialData.id,
                            updateParams,
                        );

                        if (!result || result.error) {
                            console.error("Update failed:", result?.error);
                            throw new Error(
                                result?.error ||
                                    "Failed to update research field",
                            );
                        }

                        // Handle vocabulary updates for edit mode
                        if (
                            value.type === "vocabulary" &&
                            value.vocabularies &&
                            Array.isArray(value.vocabularies)
                        ) {
                            await processVocabularies(
                                value.vocabularies,
                                initialData.id,
                                value.projectId || projectId,
                                value.languageId || defaultLanguage?.id,
                                "edit",
                            );
                        }
                    }

                    // Call success callback if provided, otherwise navigate
                    if (onSuccess) {
                        onSuccess(result);
                    } else {
                        const targetProjectId =
                            value.projectId ||
                            projectId ||
                            $page.params.project_id;
                        goto(
                            `/projects/${targetProjectId}/data-structure/research-fields`,
                        );
                    }
                } catch (error) {
                    console.error(
                        `Error ${mode === "create" ? "creating" : "updating"} research field:`,
                        error.message,
                    );
                }
            },
        }),
    );

    // Helper function to link other assets to a vocabulary
    async function linkVocabularyAssets(vocabularyId, assetIds) {
        if (!assetIds || assetIds.length === 0) return;

        try {
            // Create the junction table entries
            const values = assetIds.map((assetId, index) => ({
                vocabulary_id: vocabularyId,
                generic_asset_id: assetId,
                order: index,
            }));

            const result = await executeQuery("vocabulary_assets", "create", {
                values,
            });
            console.log("Vocabulary assets linked successfully:", result);
            return result;
        } catch (error) {
            console.error("Error linking vocabulary assets:", error);
            throw error;
        }
    }

    // Helper function to create translations for a text field
    async function createTranslations(translations, textId) {
        if (
            !translations ||
            !Array.isArray(translations) ||
            translations.length === 0 ||
            !textId
        ) {
            return;
        }

        console.log(
            `Creating ${translations.length} translations for text ID ${textId}`,
        );

        for (const translation of translations) {
            try {
                // Find the language code from the language ID
                const language = secondaryLanguages.find(
                    (lang) => lang.id === translation.language_id,
                );

                if (!language) {
                    console.error(
                        `Language not found for ID: ${translation.language_id}`,
                    );
                    continue;
                }

                const result = await addTranslation(
                    textId,
                    language.code,
                    translation.content,
                );

                console.log("Translation created successfully:", result);
            } catch (error) {
                console.error("Error creating translation:", error);
            }
        }
    }

    // Helper function to process vocabularies (create/update/delete)
    async function processVocabularies(
        vocabularies,
        researchFieldId,
        projectId,
        languageId,
        mode,
    ) {
        console.log(
            "Processing",
            vocabularies.length,
            "vocabularies for",
            mode,
            "mode",
        );

        if (mode === "edit") {
            // For edit mode, we need to handle creates, updates, and deletes
            const existingVocabs = initialData.vocabularies || [];
            const currentVocabs = vocabularies.filter((vocab) =>
                vocab.option?.trim(),
            );

            // Find vocabularies to delete (exist in initial data but not in current)
            const vocabsToDelete = existingVocabs.filter(
                (existing) =>
                    !currentVocabs.find(
                        (current) => current.id === existing.id,
                    ),
            );

            // Delete vocabularies
            for (const vocab of vocabsToDelete) {
                try {
                    await deleteVocabulary(vocab.id);
                } catch (error) {
                    console.error("Error deleting vocabulary:", error);
                }
            }

            // Process current vocabularies (create new ones, update existing ones)
            for (const vocab of currentVocabs) {
                try {
                    if (vocab.id) {
                        // Update existing vocabulary
                        await updateExistingVocabulary(vocab, languageId);
                    } else {
                        // Create new vocabulary
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
            }
        } else {
            // Create mode - just create all vocabularies
            const vocabularyPromises = vocabularies
                .filter((vocab) => vocab.option?.trim())
                .map((vocab) =>
                    createNewVocabulary(
                        vocab,
                        researchFieldId,
                        projectId,
                        languageId,
                    ),
                );

            await Promise.all(vocabularyPromises);
        }
    }

    // Helper function to create a new vocabulary
    async function createNewVocabulary(
        vocab,
        researchFieldId,
        projectId,
        languageId,
    ) {
        // Handle file uploads first
        let mainAssetId = null;
        let otherAssetIds = [];

        // Upload main asset if provided
        if (vocab.mainAssetFile && vocab.mainAssetFile.path) {
            try {
                console.log("Uploading main asset file:", vocab.mainAssetFile);
                const mainAssetResult = await window.api.importAssets({
                    path: [vocab.mainAssetFile.path],
                    projectId: projectId,
                    isGenericAsset: true,
                });
                console.log("Main asset upload result:", mainAssetResult);
                if (mainAssetResult?.createdAssets?.length > 0) {
                    mainAssetId = mainAssetResult.createdAssets[0].id;
                    console.log("Main asset ID:", mainAssetId);
                }
            } catch (error) {
                console.error("Error uploading main asset:", error);
            }
        }

        // Upload other assets if provided
        if (vocab.otherAssetsFiles && Array.isArray(vocab.otherAssetsFiles)) {
            for (const file of vocab.otherAssetsFiles) {
                if (file && file.path) {
                    try {
                        const otherAssetResult = await window.api.importAssets({
                            path: [file.path],
                            projectId: projectId,
                            isGenericAsset: true,
                        });
                        if (otherAssetResult?.createdAssets?.length > 0) {
                            otherAssetIds.push(
                                otherAssetResult.createdAssets[0].id,
                            );
                        }
                    } catch (error) {
                        console.error("Error uploading other asset:", error);
                    }
                }
            }
        }

        // Prepare vocabulary translation arrays
        const optionTranslations = [];
        const descriptionTranslations = [];

        for (const lang of secondaryLanguages) {
            const optionKey = `option_${lang.id}`;
            const descriptionKey = `description_${lang.id}`;

            if (vocab[optionKey]?.trim()) {
                optionTranslations.push({
                    language_id: lang.id,
                    content: vocab[optionKey],
                });
            }

            if (vocab[descriptionKey]?.trim()) {
                descriptionTranslations.push({
                    language_id: lang.id,
                    content: vocab[descriptionKey],
                });
            }
        }

        const vocabParams = {
            languageId: languageId,
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

        console.log(
            "Vocabulary params being sent to addVocabulary:",
            vocabParams,
        );
        const result = await addVocabulary(researchFieldId, vocabParams);
        console.log("addVocabulary result:", result);

        // Create translations for vocabulary option and description, and link other assets
        if (result && result.result) {
            // The vocabulary creation should return the created vocabulary with option_id and description_id
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

                // Link other assets to vocabulary
                if (otherAssetIds.length > 0) {
                    console.log(
                        "Linking other assets to vocabulary:",
                        otherAssetIds,
                    );
                    await linkVocabularyAssets(
                        createdVocabulary.id,
                        otherAssetIds,
                    );
                }
            }
        }

        return result;
    }

    // Helper function to update an existing vocabulary
    async function updateExistingVocabulary(vocab, languageId) {
        // Prepare vocabulary translation arrays
        const optionTranslations = [];
        const descriptionTranslations = [];

        for (const lang of secondaryLanguages) {
            const optionKey = `option_${lang.id}`;
            const descriptionKey = `description_${lang.id}`;

            if (vocab[optionKey]?.trim()) {
                optionTranslations.push({
                    language_id: lang.id,
                    content: vocab[optionKey],
                });
            }

            if (vocab[descriptionKey]?.trim()) {
                descriptionTranslations.push({
                    language_id: lang.id,
                    content: vocab[descriptionKey],
                });
            }
        }

        return updateVocabulary(vocab.id, {
            option: vocab.option,
            description: vocab.description || "",
            mainAsset: vocab.mainAsset,
            otherAssets: vocab.otherAssets,
            optionTranslations:
                optionTranslations.length > 0 ? optionTranslations : undefined,
            descriptionTranslations:
                descriptionTranslations.length > 0
                    ? descriptionTranslations
                    : undefined,
        });
    }

    // Determine title and description based on mode
    const title = $derived.by(() => {
        if (customTitle) return customTitle;
        return mode === "create"
            ? t("common.add-new-research-field", {
                  fallback: "Add New Research Field",
              })
            : t("common.edit-research-field", {
                  fallback: "Edit Research Field",
              });
    });

    const description = $derived.by(() => {
        if (customDescription) return customDescription;
        return mode === "create"
            ? t("common.add-new-research-field-desc", {
                  fallback:
                      "Please fill out the details below to add a new research field to your project.",
              })
            : t("common.edit-research-field-desc", {
                  fallback:
                      "Please update the details below to modify this research field.",
              });
    });
</script>

<form method="post">
    <div class="container-fluid">
        {#if showTitle}
            <div class="row">
                <div class="col-12">
                    <h2 class="mt-3">{title}</h2>
                    {#if showDescription}
                        <p>{description}</p>
                    {/if}
                </div>
            </div>
        {/if}

        <div class="row">
            <div class="col-12">
                <AutoForm
                    {form}
                    {validator}
                    {createFieldValidator}
                    entity={"research_fields"}
                    operation={mode}
                    {languages}
                    {translatableFields}
                    setStructuredErrors={setAllValidationErrors}
                    defaultColSize={6}
                    translationsValidator={getValidator("translations", mode)}
                    fieldOrder={["type", "vocabularies"]}
                    {uiSchema}
                    hiddenValueProviders={{
                        projectId: () => projectId || $page.params.project_id,
                        languageId: () => defaultLanguage?.id || "",
                    }}
                    structuredErrors={allValidationErrors}
                />
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-12 d-flex justify-content-end gap-2">
                {#if onCancel}
                    <BaseButton
                        type="button"
                        class="btn btn-secondary"
                        text={t("common.cancel", { fallback: "Cancel" })}
                        onClick={onCancel}
                    />
                {/if}
                <BaseButton
                    type="button"
                    class="btn btn-success"
                    text={t("common.confirm", { fallback: "Confirm" })}
                    onClick={() => form.handleSubmit()}
                />
            </div>
        </div>
    </div>
</form>
