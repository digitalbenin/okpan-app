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
    const { addTranslation, setProjectLanguages } = contentLanguageStore;

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
        fixedType = null,
    } = $props();

    // Constants & Derived
    const TRANSLATABLE_FIELDS = ["name", "description"];
    const isEditMode = $derived(mode === "edit");
    const validatorOperationName = $derived(isEditMode ? "update" : "create");
    const validator = $derived(getValidator("research_fields", validatorOperationName));
    const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
    const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);

    // --- minimal debug (plain text) ---
    const dbg = (msg) => console.log(`[ResearchFieldForm] ${msg}`);
    let didLogLoad = $state(false);

    // Ensure ContentLanguageStore can resolve language codes -> IDs when saving translations
    $effect(() => {
        if (languages?.length) setProjectLanguages(languages);
    });

    // Log once when edit data is available (helps verify visualization inputs)
    $effect(() => {
        if (didLogLoad) return;
        if (!languages?.length) return;
        if (mode !== "edit") return;
        if (!initialData?.id) return;

        const langSummary = languages
            .map((l) => `${l.code}:${l.id}${l.is_default ? ":default" : ""}`)
            .join(" |");

        const nameTrans = initialData?.name?.translations || [];
        const descTrans = initialData?.description?.translations || [];
        dbg(`LOAD mode=${mode} id=${initialData.id} type=${initialData.type} langs=${langSummary}`);
        dbg(`LOAD name.translations.count=${nameTrans.length} desc.translations.count=${descTrans.length}`);
        nameTrans.forEach((tr, i) => dbg(`LOAD name.tr[${i}] lang_id=${tr.language_id} content=${String(tr.content ?? "")}`));
        descTrans.forEach((tr, i) => dbg(`LOAD desc.tr[${i}] lang_id=${tr.language_id} content=${String(tr.content ?? "")}`));
        didLogLoad = true;
    });

    // State
    const effectiveFixedType = $derived(isEditMode && initialData?.type ? initialData.type : fixedType);
    let vocabularyProcessingFunction = null;
    let mutableType = $state((mode === "edit" && initialData?.type) ? initialData.type : "freetext");
    const selectedType = $derived(effectiveFixedType || mutableType);

    // Normalize legacy values
    $effect(() => {
        if (mutableType === "free text" || mutableType === "free_text") {
            mutableType = "freetext";
        }
    });

    // Helpers
    const processAsset = (asset) => asset ? {
        id: asset.id,
        path: asset.path,
        name: asset.filename,
        filename: asset.filename,
        type: "file",
        formats: asset.formats,
    } : null;

    const getTranslationContent = (textObj, lang) =>
        textObj?.translations?.find((t) =>
            t.language_id === lang?.id || t.language?.code === lang?.code
        )?.content || "";

    const processVocabulariesForEdit = () => (initialData.vocabularies || []).map((vocab) => {
        const processedVocab = {
            id: vocab.id,
            option: vocab.option?.content || "",
            description: vocab.description?.content || "",
            externalLink: vocab.external_link || "",
            mainAssetFile: processAsset(vocab.mainAsset),
            otherAssetsFiles: vocab.vocabulariesGenericAssets?.map((va) => processAsset(va.genericAsset)) || [],
        };

        secondaryLanguages.forEach((lang) => {
            processedVocab[`option_${lang.id}`] = getTranslationContent(vocab.option, lang);
            processedVocab[`description_${lang.id}`] = getTranslationContent(vocab.description, lang);
        });

        return processedVocab;
    });

    // Prepare default values based on mode
    const getDefaultValues = () => {
        if (!isEditMode || !initialData) {
            return { type: selectedType, name: "", description: "", vocabularies: [] };
        }

        const values = {
            type: selectedType,
            name: initialData.name?.content || initialData.name || "",
            description: initialData.description?.content || initialData.description || "",
            vocabularies: processVocabulariesForEdit(),
        };

        // Add main field translations
        secondaryLanguages.forEach((lang) => {
            values[`translations_${lang.id}_name`] = 
                getTranslationContent(initialData.name, lang) ||
                initialData.nameTranslations?.find((t) => t.language_id === lang.id)?.content || "";
            values[`translations_${lang.id}_description`] =
                getTranslationContent(initialData.description, lang) ||
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
        fieldsConfig: { hidden: true },
        name: { 
            label: t("common.label"), 
            colSize: 7 
        },
        description: { type: "textarea", label: t("common.description"), colSize: 7 },
        type: {
            label: t("common.field-type"),
            renderer: TypeSelector,
            colSize: 7,
            rendererProps: { onTypeChange: (newType) => mutableType = newType },
            hidden: !!effectiveFixedType
        },
        vocabularies: {
            label: "",
            renderer: VocabularyManager,
            colSize: 12,
            rendererProps: {
                languages,
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

            if (nameContent !== undefined && nameContent !== null && String(nameContent).trim()) {
                const existing = initialData?.name?.translations?.find((t) =>
                    t.language_id === lang.id || t.language?.code === lang.code
                );
                nameTranslations.push({
                    language_code: lang.code,
                    content: String(nameContent).trim(),
                    id: existing?.id,
                });
            }

            if (descriptionContent !== undefined && descriptionContent !== null && String(descriptionContent).trim()) {
                const existing = initialData?.description?.translations?.find((t) =>
                    t.language_id === lang.id || t.language?.code === lang.code
                );
                descriptionTranslations.push({
                    language_code: lang.code,
                    content: String(descriptionContent).trim(),
                    id: existing?.id,
                });
            }
        });

        return { nameTranslations, descriptionTranslations };
    };

    // Create form instance
    const form = createForm(() => {
        const config = getFormConfig("research_fields", validatorOperationName, {
            // IMPORTANT: keep translation fields like `translations_<langId>_<field>` in form values.
            // Zod objects strip unknown keys by default; passthrough keeps them so they render after reload.
            validators: {
                onChange: validator?.schema?.passthrough ? validator.schema.passthrough() : validator.schema
            },
            defaultValues: getDefaultValues(),
            onSubmit: async ({ value }) => {
                try {
                    // Minimal save debug: show translation keys present in form + payload summary
                    const translationKeys = Object.keys(value || {})
                        .filter((k) => k.startsWith("translations_"))
                        .sort();
                    dbg(`SAVE mode=${mode} id=${initialData?.id || "(new)"} type=${value?.type} translationKeys=${translationKeys.join("|")}`);
                    const translations = prepareTranslations(value);
                    dbg(`SAVE nameTranslations.count=${translations.nameTranslations?.length || 0} descriptionTranslations.count=${translations.descriptionTranslations?.length || 0}`);
                    (translations.nameTranslations || []).forEach((tr, i) => dbg(`SAVE name.tr[${i}] lang_code=${tr.language_code} id=${tr.id || ""} content=${String(tr.content ?? "")}`));
                    (translations.descriptionTranslations || []).forEach((tr, i) => dbg(`SAVE desc.tr[${i}] lang_code=${tr.language_code} id=${tr.id || ""} content=${String(tr.content ?? "")}`));
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

        return config;
    });

    const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

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
            const languageCode = translation.language_code || secondaryLanguages.find((l) => l.id === translation.language_id)?.code;
            if (!languageCode) {
                console.error("Language code not found for translation:", translation);
                continue;
            }
            try {
                await addTranslation(textId, languageCode, translation.content);
            } catch (error) {
                console.error("Error creating translation:", error);
            }
        }
    };

    // Determine title and description - Dynamic based on type
    const isConnection = $derived(selectedType === "vocabulary");
    const itemLabel = $derived(isConnection ? t("common.connection") : t("common.research-field"));
    
    // Labels
    const title = $derived(customTitle || (
        mode === "create" 
            ? t("common.add-item", { item: itemLabel })
            : t("common.edit-item", { item: itemLabel })
    ));
    
    const description = $derived(customDescription || (
        mode === "create"
            ? t("common.fill-details-below")
            : t("common.update-details-below")
    ));

    const leftActionButtons = $derived(onCancel ? [{
        id: "cancel-research-field",
        text: t("common.cancel"),
        class: "btn btn-outline-secondary",
        type: "button",
        icon: "chevron-left",
        onClick: onCancel,
    }] : []);

    const rightActionButtons = $derived([
        {
            id: "save-research-field",
            text: t("common.confirm"),
            class: "btn btn-success",
            type: "submit",
            disableOnError: true,
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
        formStore={formStore}
    >
        {#if showTitle}
            <div class="row"><div class="col-12">
                <h2 class="mt-3">{title}</h2>
                {#if showDescription}<p>{description}</p>{/if}
            </div></div>
        {/if}

        <div class="row"><div class="col-12">
            <AutoForm {form} {validator} {createFieldValidator} {languages} translatableFields={TRANSLATABLE_FIELDS} defaultColSize={6} translationsValidator={getValidator("translations", validatorOperationName)} fieldOrder={["type", "vocabularies"]} {uiSchema} hiddenValueProviders={{ projectId: () => projectId, languageId: () => defaultLanguage?.id || "", type: () => selectedType }} />
        </div></div>
    </PageActionFooter>
</form>
