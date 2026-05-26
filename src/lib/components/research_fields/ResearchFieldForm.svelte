<script>
    import { createForm } from "@tanstack/svelte-form";
    import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { createResearchField, updateResearchField } from "$lib/api/ResearchFieldsApi.js";
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import VocabularyManager from "$lib/components/research_fields/VocabularyManager.svelte";
    import TypeSelector from "$lib/components/research_fields/TypeSelector.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import { watch } from "runed";

    const translationStore = getTranslationStore();
    const contentLanguageStore = getContentLanguageStore();
    const t = $derived(translationStore.t);
    const { setProjectLanguages, getTranslationContent, buildTranslationFormValues, processEntityTranslations } = contentLanguageStore;

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
    let didLogLoad = false;

    // Ensure ContentLanguageStore can resolve language codes -> IDs when saving translations
    watch(() => languages, (curr) => {
        if (curr?.length) setProjectLanguages(curr);
    });

    // Log once when edit data is available (helps verify visualization inputs)
    watch(() => [languages, initialData], () => {
        if (didLogLoad || !languages?.length || mode !== "edit" || !initialData?.id) return;

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
    const normalizeType = (type) => (type === "free text" || type === "free_text") ? "freetext" : type;
    let vocabularyProcessingFunction = null;
    let mutableType = $state(normalizeType(mode === "edit" && initialData?.type ? initialData.type : "freetext"));
    const selectedType = $derived(effectiveFixedType || mutableType);

    // Helpers
    const processAsset = (asset) => asset ? {
        id: asset.id,
        path: asset.path,
        name: asset.filename,
        filename: asset.filename,
        type: "file",
        formats: asset.formats,
    } : null;

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
            processedVocab[`option_${lang.id}`] = getTranslationContent(vocab.option, lang.code);
            processedVocab[`description_${lang.id}`] = getTranslationContent(vocab.description, lang.code);
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

        Object.assign(values, buildTranslationFormValues(initialData, secondaryLanguages, TRANSLATABLE_FIELDS));
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
            rendererProps: { onTypeChange: (newType) => mutableType = normalizeType(newType) },
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
        const toTranslation = (field, content, lang) => {
            if (content == null || !String(content).trim()) return null;
            const existing = initialData?.[field]?.translations?.find(
                (t) => t.language_id === lang.id || t.language?.code === lang.code
            );
            return { language_code: lang.code, content: String(content).trim(), id: existing?.id };
        };

        const nameTranslations = [];
        const descriptionTranslations = [];

        secondaryLanguages.forEach((lang) => {
            const name = toTranslation("name", value[`translations_${lang.id}_name`], lang);
            if (name) nameTranslations.push(name);
            const desc = toTranslation("description", value[`translations_${lang.id}_description`], lang);
            if (desc) descriptionTranslations.push(desc);
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
                    dbg(`SAVE mode=${mode} id=${initialData?.id || "(new)"} type=${value?.type}`);
                    const result = mode === "create" ? await handleCreate(value) : await handleUpdate(value);
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
    const handleCreate = async (value) => {
        const result = await createResearchField({
            projectId: value.projectId || projectId,
            languageId: value.languageId || defaultLanguage?.id,
            name: value.name ?? "",
            description: value.description ?? "",
            type: value.type,
        });

        if (!result?.length) throw new Error("Failed to create research field");

        const { id: researchFieldId, name_id: nameId, description_id: descriptionId } = result[0];
        await processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, { name: nameId, description: descriptionId });

        if (value.type === "vocabulary" && value.vocabularies?.length > 0 && vocabularyProcessingFunction) {
            await vocabularyProcessingFunction(researchFieldId, value.projectId || projectId, value.languageId || defaultLanguage?.id, "create");
        }

        return result;
    };

    // Handle update mode
    const handleUpdate = async (value) => {
        const { nameTranslations, descriptionTranslations } = prepareTranslations(value);
        const result = await updateResearchField(initialData.id, {
            type: value.type,
            name: value.name,
            description: value.description,
            nameTranslations: nameTranslations.length ? nameTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length ? descriptionTranslations : undefined,
        });

        if (!result || result.error) throw new Error(result?.error || "Failed to update research field");

        if (value.type === "vocabulary" && value.vocabularies && vocabularyProcessingFunction) {
            await vocabularyProcessingFunction(initialData.id, value.projectId || projectId, value.languageId || defaultLanguage?.id, "edit");
        }

        return result;
    };

    // Determine title and description - Dynamic based on type
    const itemLabel = $derived(selectedType === "vocabulary" ? t("common.connection") : t("common.research-field"));
    
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
