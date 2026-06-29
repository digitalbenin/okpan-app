<script>
    import { createForm } from "@tanstack/svelte-form";
    import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { createResearchField, updateResearchField } from "$lib/api/ResearchFieldsApi.js";
    import { processEntityTranslations, buildTranslationFormValues, getTranslationContent } from "$lib/api/TranslationsApi.js";
    import { goto } from "$app/navigation";
    import AutoForm from "$lib/components/form/AutoForm.svelte";
    import VocabularyManager from "$lib/components/research_fields/VocabularyManager.svelte";
    import TypeSelector from "$lib/components/research_fields/TypeSelector.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
    import { watch } from "runed";

    const translationStore = getTranslationStore();
    const t = $derived(translationStore.t);

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
        noFooter = false,
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
            return { type: selectedType, name: "", description: "", onwebsite: 0, vocabularies: [] };
        }

        const values = {
            type: selectedType,
            name: initialData.name?.content ?? "",
            description: initialData.description?.content ?? "",
            vocabularies: processVocabulariesForEdit(),
        };

        values.onwebsite = initialData.onwebsite ?? 0;
        const transValues = buildTranslationFormValues(initialData, secondaryLanguages, TRANSLATABLE_FIELDS);
        Object.assign(values, transValues);
        return values;
    };

    // Dynamic uiSchema that updates based on selected type
    const uiSchema = $derived({
        fieldId: { hidden: true },
        projectId: { hidden: true },
        languageId: { hidden: true },
        private: { hidden: true },
        onwebsite: { type: "checkbox", label: t("common.public-website", { fallback: "Visible on website" }), colSize: 12 },
        fieldsConfig: { hidden: true },
        name: { 
            label: t("common.label"), 
            colSize: 12 
        },
        description: { type: "textarea", label: t("common.description"), colSize: 12 },
        type: {
            label: t("common.field-type"),
            renderer: TypeSelector,
            colSize: 12,
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

    // Handle create mode (matching InstitutionForm pattern — create + processEntityTranslations)
    const handleCreate = async (value) => {
        const result = await createResearchField({
            projectId: value.projectId || projectId,
            languageId: value.languageId || defaultLanguage?.id,
            name: value.name ?? "",
            description: value.description ?? "",
            type: value.type,
            onwebsite: value.onwebsite ?? 0,
        });

        if (!result || result.error) {
            throw new Error(result?.error?.message || result?.error || "Failed to create research field");
        }

        const createdField = result?.result?.[0];
        if (!createdField) {
            throw new Error("No research field returned from create mutation");
        }

        const textIdMap = { name: createdField.name_id, description: createdField.description_id };
        await processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, languages, textIdMap);

        if (value.type === "vocabulary" && value.vocabularies?.length > 0 && vocabularyProcessingFunction) {
            await vocabularyProcessingFunction(createdField.id, value.projectId || projectId, value.languageId || defaultLanguage?.id, "create");
        }

        return result;
    };

    // Handle update mode (same translation pattern as InstitutionForm)
    const handleUpdate = async (value) => {
        const result = await updateResearchField(initialData.id, {
            type: value.type,
            name: value.name,
            description: value.description,
            onwebsite: value.onwebsite ?? 0,
        });

        if (!result || result.error) throw new Error(result?.error || "Failed to update research field");

        await processEntityTranslations(initialData, secondaryLanguages, TRANSLATABLE_FIELDS, value, languages);

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

    const autoFormProps = $derived({
        form,
        validator,
        createFieldValidator,
        languages,
        translatableFields: TRANSLATABLE_FIELDS,
        defaultColSize: 6,
        translationsValidator: getValidator("translations", validatorOperationName),
        fieldOrder: ["type", "vocabularies", "onwebsite"],
        uiSchema,
        margin:0,
        usePortal: false,
        hiddenValueProviders: {
            projectId: () => projectId,
            languageId: () => defaultLanguage?.id || "",
            type: () => selectedType
        }
    });

</script>

<form
    method="post"    id="research-field-form"    onsubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
    }}
>
    {#if showTitle}
        <div class="row"><div class="col-12">
            <h2 class="mt-3">{title}</h2>
            {#if showDescription}<p>{description}</p>{/if}
        </div></div>
    {/if}

    {#if noFooter}
        <div class="row"><div class="col-12">
            <AutoForm {...autoFormProps} />
        </div></div>
        <button type="submit" class="d-none" tabindex="-1" aria-label="Submit"></button>
    {:else}
        <PageActionFooter
            contentClass="container-fluid"
            leftButtons={leftActionButtons}
            rightButtons={rightActionButtons}
            formStore={formStore}
        >
            <div class="row"><div class="col-12">
                <AutoForm {...autoFormProps} />
            </div></div>
        </PageActionFooter>
    {/if}
</form>
