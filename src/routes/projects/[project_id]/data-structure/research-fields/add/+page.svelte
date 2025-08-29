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
        addVocabulary,
    } from "$lib/stores/ResearchFieldsUtils.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import VocabularyManager from "$lib/components/research_fields/VocabularyManager.svelte";
    import TypeSelector from "$lib/components/research_fields/TypeSelector.svelte";

    const { t } = getTranslationStore();

    let { data } = $props();

    // Extract languages from layout data
    const { languages } = data;
    const defaultLanguage =
        languages?.find((lang) => lang.is_default) || languages?.[0];
    const secondaryLanguages =
        languages?.filter((lang) => !lang.is_default) || [];

    // Translation state - only for translatable fields
    const translatableFields = ["name", "description"];

    // Make sure custom validators are merged into schema
    const validator = getValidator("research_fields", "create");

    // Store all validation errors for components to use
    let allValidationErrors = [];

    // Helper function to set structured errors
    function setAllValidationErrors(errors) {
        allValidationErrors = errors;
    }

    // Track selected type
    let selectedType = $state("free text");

    // Dynamic uiSchema that updates based on selected type
    const uiSchema = $derived({
        projectId: { hidden: true },
        languageId: { hidden: true },
        name: {
            label: t("common.research-field-name", {
                fallback: "Research Field Name",
            }),
            colSize: 6,
        },
        description: {
            type: "textarea",
            label: t("common.description", {
                fallback: "Description",
            }),
            colSize: 6,
        },
        type: {
            label: t("common.field-type", {
                fallback: "Field Type",
            }),
            renderer: TypeSelector,
            colSize: 6,
            rendererProps: {
                onTypeChange: (newType) => {
                    selectedType = newType;
                },
            },
        },
        vocabularies: {
            label: t("common.vocabulary-options", {
                fallback: "Vocabulary Options",
            }),
            renderer: VocabularyManager,
            colSize: 12,
            rendererProps: {
                languages: languages,
                structuredErrors: allValidationErrors,
                maxVocabularies: 50,
                selectedType: selectedType, // Pass the selected type
            },
        },
    });

    // Create form instance using optimized config (live validation via onChange)
    const form = createForm(() =>
        getFormConfig("research_fields", "create", {
            onSubmit: async ({ value }) => {
                try {
                    // Prepare translation arrays for the mutation
                    const nameTranslations = [];
                    const descriptionTranslations = [];

                    for (const lang of secondaryLanguages) {
                        const nameContent =
                            value[`translations_${lang.id}_name`];
                        const descriptionContent =
                            value[`translations_${lang.id}_description`];

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

                    // Create the research field with translations
                    const result = await createResearchField({
                        projectId: value.projectId,
                        languageId: value.languageId,
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
                    });

                    if (!result || !result.result) {
                        console.error("createResearchField result:", result);
                        throw new Error("Failed to create research field");
                    }

                    // Get the created research field ID
                    const researchFieldId =
                        result.result.createResearchField
                            ?.insertIntoResearch_fields?.[0]?.id;

                    // Add vocabularies if field type is vocabulary and any were provided
                    if (
                        value.type === "vocabulary" &&
                        value.vocabularies &&
                        Array.isArray(value.vocabularies) &&
                        value.vocabularies.length > 0
                    ) {
                        const vocabularyPromises = value.vocabularies
                            .filter((vocab) => vocab.option?.trim()) // Only add vocabularies with non-empty options
                            .map(async (vocab) => {
                                // Handle file uploads first
                                let mainAssetId = null;
                                let otherAssetIds = [];

                                // Upload main asset if provided
                                if (
                                    vocab.mainAssetFile &&
                                    vocab.mainAssetFile instanceof File
                                ) {
                                    try {
                                        const mainAssetResult =
                                            await window.api.importAssets({
                                                path: [
                                                    vocab.mainAssetFile.path,
                                                ],
                                                projectId: value.projectId,
                                                isGenericAsset: true,
                                            });
                                        if (
                                            mainAssetResult?.createdAssets
                                                ?.length > 0
                                        ) {
                                            mainAssetId =
                                                mainAssetResult.createdAssets[0]
                                                    .id;
                                        }
                                    } catch (error) {
                                        console.error(
                                            "Error uploading main asset:",
                                            error,
                                        );
                                    }
                                }

                                // Upload other assets if provided
                                if (
                                    vocab.otherAssetsFiles &&
                                    Array.isArray(vocab.otherAssetsFiles)
                                ) {
                                    for (const file of vocab.otherAssetsFiles) {
                                        if (file instanceof File) {
                                            try {
                                                const otherAssetResult =
                                                    await window.api.importAssets(
                                                        {
                                                            path: [file.path],
                                                            projectId:
                                                                value.projectId,
                                                            isGenericAsset: true,
                                                        },
                                                    );
                                                if (
                                                    otherAssetResult
                                                        ?.createdAssets
                                                        ?.length > 0
                                                ) {
                                                    otherAssetIds.push(
                                                        otherAssetResult
                                                            .createdAssets[0]
                                                            .id,
                                                    );
                                                }
                                            } catch (error) {
                                                console.error(
                                                    "Error uploading other asset:",
                                                    error,
                                                );
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

                                return addVocabulary(researchFieldId, {
                                    languageId: value.languageId,
                                    option: vocab.option,
                                    description: vocab.description || "",
                                    mainAsset: mainAssetId,
                                    otherAssets: otherAssetIds,
                                    optionTranslations:
                                        optionTranslations.length > 0
                                            ? optionTranslations
                                            : undefined,
                                    descriptionTranslations:
                                        descriptionTranslations.length > 0
                                            ? descriptionTranslations
                                            : undefined,
                                });
                            });

                        await Promise.all(vocabularyPromises);
                    }

                    goto(
                        `/projects/${value.projectId}/data-structure/research-fields`,
                    );
                } catch (error) {
                    console.error("Error creating research field:", error);
                }
            },
        }),
    );
</script>

<form
    onsubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
    }}
>
    <div class="container-fluid">
        <div class="row">
            <div class="col-12">
                <h2 class="mt-3">
                    {t("common.add-new-research-field", {
                        fallback: "Add New Research Field",
                    })}
                </h2>
                <p>
                    {t("common.add-new-research-field-desc", {
                        fallback:
                            "Please fill out the details below to add a new research field to your project.",
                    })}
                </p>

                <AutoForm
                    {form}
                    {validator}
                    {createFieldValidator}
                    entity={"research_fields"}
                    operation={"create"}
                    {languages}
                    {translatableFields}
                    setStructuredErrors={setAllValidationErrors}
                    defaultColSize={6}
                    translationsValidator={getValidator(
                        "translations",
                        "create",
                    )}
                    fieldOrder={["type", "vocabularies"]}
                    {uiSchema}
                    hiddenValueProviders={{
                        projectId: () => $page.params.project_id,
                        languageId: () => defaultLanguage?.id || "",
                    }}
                    structuredErrors={allValidationErrors}
                />
            </div>
        </div>
    </div>

    <div
        class="position-absolute bottom-0 start-0 w-100 bg-light z-1 p-3 d-flex justify-content-end"
    >
        <BaseButton
            type="submit"
            class="btn btn-success"
            text={t("common.confirm", { fallback: "Confirm" })}
        />
    </div>
</form>
