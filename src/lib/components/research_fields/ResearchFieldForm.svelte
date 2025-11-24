<script>
    import { createForm } from "@tanstack/svelte-form";
    import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { createResearchField, updateResearchField } from "$lib/stores/ResearchFieldsUtils.js";
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import VocabularyManager from "$lib/components/research_fields/VocabularyManager.svelte";
    import TypeSelector from "$lib/components/research_fields/TypeSelector.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

    const translationStore = getTranslationStore();
    const contentLanguageStore = getContentLanguageStore();
    const t = $derived(translationStore.t);
    const { addTranslation } = contentLanguageStore;

    // Props
    let {
        languages,
        mode = "create",
        initialData = null,
        projectId = null,
        onSuccess = null,
        onCancel = null,
        showTitle = true,
        showDescription = true,
        customTitle = null,
        customDescription = null,
    } = $props();

    // Constants & Derived
    const TRANSLATABLE_FIELDS = ["name", "description"];
    const isEditMode = $derived(mode === "edit");
    const validatorOperationName = $derived(isEditMode ? "update" : "create");
    const validator = $derived(getValidator("research_fields", validatorOperationName));
    const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
    const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);

    // State
    let allValidationErrors = $state([]);
    let vocabularyProcessingFunction = null;
    let selectedType = $state((mode === "edit" && initialData?.type) ? initialData.type : "free text");

    // Helpers
    const processAsset = (asset) => asset ? {
        id: asset.id,
        path: asset.path,
        name: asset.filename,
        filename: asset.filename,
        type: "file",
        formats: asset.formats,
    } : null;

    const getTranslationContent = (textObj, langId) =>
        textObj?.translations?.find((t) => t.language_id === langId)?.content || "";

    const processVocabulariesForEdit = () => (initialData.vocabularies || []).map((vocab) => {
        const processedVocab = {
            id: vocab.id,
            option: vocab.option?.content || "",
            description: vocab.description?.content || "",
            mainAssetFile: processAsset(vocab.mainAsset),
            otherAssetsFiles: vocab.vocabulariesGenericAssets?.map((va) => processAsset(va.genericAsset)) || [],
        };

        secondaryLanguages.forEach((lang) => {
            processedVocab[`option_${lang.id}`] = getTranslationContent(vocab.option, lang.id);
            processedVocab[`description_${lang.id}`] = getTranslationContent(vocab.description, lang.id);
        });

        return processedVocab;
    });

    // Prepare default values based on mode
    const getDefaultValues = () => {
        if (!isEditMode || !initialData) {
            return { type: "free text", name: "", description: "", vocabularies: [] };
        }

        const values = {
            type: initialData.type || "free text",
            name: initialData.name?.content || initialData.name || "",
            description: initialData.description?.content || initialData.description || "",
            vocabularies: processVocabulariesForEdit(),
        };

        // Add main field translations
        secondaryLanguages.forEach((lang) => {
            values[`translations_${lang.id}_name`] = 
                getTranslationContent(initialData.name, lang.id) ||
                initialData.nameTranslations?.find((t) => t.language_id === lang.id)?.content || "";
            values[`translations_${lang.id}_description`] =
                getTranslationContent(initialData.description, lang.id) ||
                initialData.descriptionTranslations?.find((t) => t.language_id === lang.id)?.content || "";
        });

        return values;
    };

    // Dynamic uiSchema that updates based on selected type
    const uiSchema = $derived({
        fieldId: { hidden: true },
        projectId: { hidden: true },
        languageId: { hidden: true },
        private: { hidden: true },
        onwebsite: { hidden: true },
        name: { label: t("common.research-field-name", { fallback: "Research Field Name" }), colSize: 7 },
        description: { type: "textarea", label: t("common.description", { fallback: "Description" }), colSize: 7 },
        type: {
            label: t("common.field-type", { fallback: "Field Type" }),
            renderer: TypeSelector,
            colSize: 7,
            rendererProps: { onTypeChange: (newType) => selectedType = newType },
        },
        vocabularies: {
            label: "",
            renderer: VocabularyManager,
            colSize: 12,
            rendererProps: {
                languages,
                structuredErrors: allValidationErrors,
                maxVocabularies: 50,
                selectedType,
                mode,
                initialData,
                projectId,
                onVocabulariesProcessed: (processingFunction) => vocabularyProcessingFunction = processingFunction,
            },
        },
    });

    // Helper to prepare translations from form values
    const prepareTranslations = (value) => {
        const nameTranslations = [];
        const descriptionTranslations = [];

        secondaryLanguages.forEach((lang) => {
            const nameContent = value[`translations_${lang.id}_name`];
            const descriptionContent = value[`translations_${lang.id}_description`];

            if (nameContent?.trim()) nameTranslations.push({ language_id: lang.id, content: nameContent });
            if (descriptionContent?.trim()) descriptionTranslations.push({ language_id: lang.id, content: descriptionContent });
        });

        return { nameTranslations, descriptionTranslations };
    };

    // Create form instance
    const form = createForm(() => {
        const config = getFormConfig("research_fields", validatorOperationName, {
            defaultValues: getDefaultValues(),
            onSubmit: async ({ value }) => {
                try {
                    const translations = prepareTranslations(value);
                    const result = mode === "create" ? await handleCreate(value, translations) : await handleUpdate(value, translations);
                    
                    if (onSuccess) {
                        onSuccess(result);
                    } else {
                        goto(`/projects/${value.projectId || projectId}/data-structure/research-fields`);
                    }
                } catch (error) {
                    console.error(`Error ${mode === "create" ? "creating" : "updating"} research field:`, error.message);
                }
            },
        });

        if (config.fieldValidators?.vocabularies) {
            config.fieldValidators.vocabularies = createFieldValidator("vocabularies", validator, null, (errors) => allValidationErrors = errors, { validateOnChange: true });
        }

        return config;
    });

    // Handle create mode
    const handleCreate = async (value, { nameTranslations, descriptionTranslations }) => {
        const result = await createResearchField({
            projectId: value.projectId || projectId,
            languageId: value.languageId || defaultLanguage?.id,
            name: value.name ?? "",
            description: value.description ?? "",
            type: value.type,
            nameTranslations: nameTranslations.length > 0 ? nameTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length > 0 ? descriptionTranslations : undefined,
        });
        
        if (!result?.result) throw new Error("Failed to create research field");

        const researchFieldId = result.result[0]?.id;
        const nameId = result.result[0]?.name_id;
        const descriptionId = result.result[0]?.description_id;

        await createTranslations(nameTranslations, nameId);
        await createTranslations(descriptionTranslations, descriptionId);

        if (value.type === "vocabulary" && value.vocabularies?.length > 0 && vocabularyProcessingFunction) {
            await vocabularyProcessingFunction(researchFieldId, value.projectId || projectId, value.languageId || defaultLanguage?.id, "create");
        }

        return result;
    };

    // Handle update mode
    const handleUpdate = async (value, { nameTranslations, descriptionTranslations }) => {
        const result = await updateResearchField(initialData.id, {
            type: value.type,
            name: value.name,
            description: value.description,
            nameTranslations: nameTranslations.length > 0 ? nameTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length > 0 ? descriptionTranslations : undefined,
        });
        
        if (!result || result.error) throw new Error(result?.error || "Failed to update research field");

        if (value.type === "vocabulary" && value.vocabularies && vocabularyProcessingFunction) {
            await vocabularyProcessingFunction(initialData.id, value.projectId || projectId, value.languageId || defaultLanguage?.id, "edit");
        }

        return result;
    };

    // Helper to create translations for a text field
    const createTranslations = async (translations, textId) => {
        if (!translations?.length || !textId) return;
        
        for (const translation of translations) {
            const language = secondaryLanguages.find((lang) => lang.id === translation.language_id);
            if (!language) {
                console.error(`Language not found for ID: ${translation.language_id}`);
                continue;
            }
            try {
                await addTranslation(textId, language.code, translation.content);
            } catch (error) {
                console.error("Error creating translation:", error);
            }
        }
    };

    // Determine title and description
    const title = $derived(customTitle || (mode === "create" ? t("common.add-new-research-field", { fallback: "Add New Research Field" }) : t("common.edit-research-field", { fallback: "Edit Research Field" })));
    const description = $derived(customDescription || (mode === "create" ? t("common.add-new-research-field-desc", { fallback: "Please fill out the details below to add a new research field to your project." }) : t("common.edit-research-field-desc", { fallback: "Please update the details below to modify this research field." })));

    const leftActionButtons = $derived(onCancel ? [{
        id: "cancel-research-field",
        text: t("common.cancel", { fallback: "Cancel" }),
        class: "btn btn-outline-secondary",
        type: "button",
        icon: "chevron-left",
        onClick: onCancel,
    }] : []);

    const rightActionButtons = $derived([
        {
            id: "save-research-field",
            text: t("common.confirm", { fallback: "Confirm" }),
            class: "btn btn-success",
            type: "submit",
        },
    ]);

</script>

<form
    method="post"
    onsubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
    }}
>
    <PageActionFooter
        contentClass="container-fluid"
        leftButtons={leftActionButtons}
        rightButtons={rightActionButtons}
    >
        {#if showTitle}
            <div class="row"><div class="col-12">
                <h2 class="mt-3">{title}</h2>
                {#if showDescription}<p>{description}</p>{/if}
            </div></div>
        {/if}

        <div class="row"><div class="col-12">
            <AutoForm {form} {validator} {createFieldValidator} entity="research_fields" operation={validatorOperationName} {languages} translatableFields={TRANSLATABLE_FIELDS} setStructuredErrors={(errors) => allValidationErrors = errors} defaultColSize={6} translationsValidator={getValidator("translations", validatorOperationName)} fieldOrder={["type", "vocabularies"]} {uiSchema} hiddenValueProviders={{ projectId: () => projectId, languageId: () => defaultLanguage?.id || "" }} structuredErrors={allValidationErrors} />
        </div></div>
    </PageActionFooter>
</form>
