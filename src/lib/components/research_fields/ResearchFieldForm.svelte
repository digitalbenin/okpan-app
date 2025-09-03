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

    // Get appropriate validator based on mode - map 'edit' to 'update' for API compatibility
    const validatorOperationName = mode === "edit" ? "update" : mode;
    const validator = getValidator("research_fields", validatorOperationName);

    // Store all validation errors for components to use
    let allValidationErrors = $state([]);

    // Reference to vocabulary processing function from VocabularyManager
    let vocabularyProcessingFunction = null;

    // Helper function to set structured errors
    function setAllValidationErrors(errors) {
        allValidationErrors = errors;
    }

    // Track selected type - initialize properly for edit mode
    let selectedType = $state(
        mode === "edit" && initialData?.type ? initialData.type : "free text",
    );

    // Debug selected type changes
    $effect(() => {
        console.log(
            "ResearchFieldForm: selectedType changed to:",
            selectedType,
        );
        console.log(
            "ResearchFieldForm: mode:",
            mode,
            "initialData type:",
            initialData?.type,
        );
        if (initialData?.vocabularies) {
            console.log(
                "ResearchFieldForm: initialData has vocabularies:",
                initialData.vocabularies.length,
            );
        }
    });

    // Helper to process asset for vocabulary
    const processAsset = (asset) =>
        asset
            ? {
                  id: asset.id,
                  path: asset.path,
                  name: asset.filename,
                  filename: asset.filename,
                  type: "file",
                  formats: asset.formats,
              }
            : null;

    // Helper to get translation content
    const getTranslationContent = (textObj, langId) =>
        textObj?.translations?.find((t) => t.language_id === langId)?.content ||
        "";

    // Prepare default values based on mode
    const getDefaultValues = () => {
        if (mode !== "edit" || !initialData) {
            return { type: "free text", vocabularies: [] };
        }

        // Process vocabularies for edit mode
        const processedVocabularies = (initialData.vocabularies || []).map(
            (vocab) => {
                const processedVocab = {
                    id: vocab.id,
                    option: vocab.option?.content || "",
                    description: vocab.description?.content || "",
                    mainAssetFile: processAsset(vocab.mainAsset),
                    otherAssetsFiles:
                        vocab.vocabulariesGenericAssets?.map((va) =>
                            processAsset(va.genericAsset),
                        ) || [],
                };

                // Add translations for secondary languages
                secondaryLanguages.forEach((lang) => {
                    processedVocab[`option_${lang.id}`] = getTranslationContent(
                        vocab.option,
                        lang.id,
                    );
                    processedVocab[`description_${lang.id}`] =
                        getTranslationContent(vocab.description, lang.id);
                });

                return processedVocab;
            },
        );

        const values = {
            type: initialData.type || "free text",
            name: initialData.name?.content || initialData.name || "",
            description:
                initialData.description?.content ||
                initialData.description ||
                "",
            vocabularies: processedVocabularies,
        };

        // Add main field translations
        secondaryLanguages.forEach((lang) => {
            const nameTranslation =
                getTranslationContent(initialData.name, lang.id) ||
                initialData.nameTranslations?.find(
                    (t) => t.language_id === lang.id,
                )?.content ||
                "";
            const descriptionTranslation =
                getTranslationContent(initialData.description, lang.id) ||
                initialData.descriptionTranslations?.find(
                    (t) => t.language_id === lang.id,
                )?.content ||
                "";

            values[`translations_${lang.id}_name`] = nameTranslation;
            values[`translations_${lang.id}_description`] =
                descriptionTranslation;
        });

        return values;
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
                mode: mode,
                initialData: initialData,
                projectId: projectId,
                onVocabulariesProcessed: (processingFunction) => {
                    console.log(
                        "ResearchFieldForm: Received vocabulary processing function",
                    );
                    vocabularyProcessingFunction = processingFunction;
                },
            },
        },
    });

    // Create form instance using optimized config
    const form = createForm(() =>
        getFormConfig("research_fields", validatorOperationName, {
            defaultValues: getDefaultValues(),
            onSubmit: async ({ value }) => {
                try {
                    // Prepare translations
                    const translations = prepareTranslations(value);

                    const result =
                        mode === "create"
                            ? await handleCreate(value, translations)
                            : await handleUpdate(value, translations);

                    // Handle success
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

    // Helper to prepare translations from form values
    const prepareTranslations = (value) => {
        const nameTranslations = [];
        const descriptionTranslations = [];

        secondaryLanguages.forEach((lang) => {
            const nameContent = value[`translations_${lang.id}_name`];
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
        });

        return { nameTranslations, descriptionTranslations };
    };

    // Handle create mode
    const handleCreate = async (
        value,
        { nameTranslations, descriptionTranslations },
    ) => {
        const createParams = {
            projectId: value.projectId || projectId,
            languageId: value.languageId || defaultLanguage?.id,
            name: value.name,
            description: value.description,
            type: value.type,
            nameTranslations:
                nameTranslations.length > 0 ? nameTranslations : undefined,
            descriptionTranslations:
                descriptionTranslations.length > 0
                    ? descriptionTranslations
                    : undefined,
        };

        const result = await createResearchField(createParams);
        if (!result?.result) throw new Error("Failed to create research field");

        const researchFieldId = result.result[0]?.id;
        const nameId = result.result[0]?.name_id;
        const descriptionId = result.result[0]?.description_id;

        // Create translations
        await createTranslations(nameTranslations, nameId);
        await createTranslations(descriptionTranslations, descriptionId);

        // Handle vocabularies
        if (
            value.type === "vocabulary" &&
            value.vocabularies?.length > 0 &&
            vocabularyProcessingFunction
        ) {
            await vocabularyProcessingFunction(
                researchFieldId,
                value.projectId || projectId,
                value.languageId || defaultLanguage?.id,
                "create",
            );
        }

        return result;
    };

    // Handle update mode
    const handleUpdate = async (
        value,
        { nameTranslations, descriptionTranslations },
    ) => {
        const updateParams = {
            type: value.type,
            name: value.name,
            description: value.description,
            nameTranslations:
                nameTranslations.length > 0 ? nameTranslations : undefined,
            descriptionTranslations:
                descriptionTranslations.length > 0
                    ? descriptionTranslations
                    : undefined,
        };

        const result = await updateResearchField(initialData.id, updateParams);
        if (!result || result.error) {
            throw new Error(result?.error || "Failed to update research field");
        }

        // Handle vocabularies
        if (
            value.type === "vocabulary" &&
            value.vocabularies &&
            vocabularyProcessingFunction
        ) {
            await vocabularyProcessingFunction(
                initialData.id,
                value.projectId || projectId,
                value.languageId || defaultLanguage?.id,
                "edit",
            );
        }

        return result;
    };

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
                    operation={validatorOperationName}
                    {languages}
                    {translatableFields}
                    setStructuredErrors={setAllValidationErrors}
                    defaultColSize={6}
                    translationsValidator={getValidator(
                        "translations",
                        validatorOperationName,
                    )}
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
