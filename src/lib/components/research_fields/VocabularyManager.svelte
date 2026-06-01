<script>
    import { watch } from "runed";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import VocabularyRow from "$lib/components/research_fields/VocabularyRow.svelte";
    import { addVocabulary as addVocabularyAPI, updateVocabulary as updateVocabularyAPI, deleteVocabulary as deleteVocabularyAPI } from "$lib/api/ResearchFieldsApi.js";
    import { executeQuery } from "$lib/api/graphqlClient.js";

    const translationStore = getTranslationStore();
    const t = $derived(translationStore.t);

    let {
        value = $bindable(),
        languages = [],
        field = null, // TanStack Form field for accessing meta
        maxVocabularies = 50,
        activeLanguageCode = "default",
        selectedType = "freetext",
        class: customClass = "",
        onChange = null,
        mode = "create",
        initialData = null,
        onVocabulariesProcessed = null,
    } = $props();

    // Access structured errors from field meta
    const structuredErrors = $derived(field?.state?.meta?.structuredErrors || []);

    // State
    let localVocabularies = $state(Array.isArray(value) ? [...value] : []);

    // Derived
    const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);

    // Vocabulary management
    const addVocabulary = () => {
        if (localVocabularies.length >= maxVocabularies) return;

        const newVocabulary = { option: "", description: "", externalLink: "", mainAssetFile: null, otherAssetsFiles: [] };
        secondaryLanguages.forEach((lang) => {
            newVocabulary[`option_${lang.id}`] = "";
            newVocabulary[`description_${lang.id}`] = "";
        });

        localVocabularies = [...localVocabularies, newVocabulary];
    };

    const removeVocabulary = (index) => {
        if (localVocabularies.length <= 0) return;
        localVocabularies = localVocabularies.filter((_, i) => i !== index);
    };

    const updateVocabulary = (index, field, newValue) => {
        const updated = [...localVocabularies];
        updated[index] = { ...updated[index], [field]: newValue };
        localVocabularies = updated;
    };

    const getFieldErrors = (index, fieldName) => {
        if (!structuredErrors || !Array.isArray(structuredErrors)) return [];
        return structuredErrors
            .filter((error) => error?.path?.length >= 3 && error.path[0] === "vocabularies" && error.path[1] === index && error.path[2] === fieldName)
            .map((error) => error.message);
    };

    const handleMediaChange = (index, { mainAsset, otherAssets }) => {
        updateVocabulary(index, "mainAssetFile", mainAsset);
        updateVocabulary(index, "otherAssetsFiles", otherAssets);
    };

    // Helper functions
    const getTranslationContent = (textObj, langId) => textObj?.translations?.find((t) => t.language_id === langId)?.content || "";

    const linkVocabularyAssets = async (vocabularyId, assetIds) => {
        if (!assetIds?.length) return;
        try {
            return await executeQuery("vocabulary_assets", "create", {
                values: assetIds.map((assetId, index) => ({ vocabulary_id: vocabularyId, generic_asset_id: assetId, order: index })),
            });
        } catch (error) {
            console.error("Error linking vocabulary assets:", error);
            throw error;
        }
    };

    const handleAssetUpload = async (assetFile, projectId) => {
        if (!assetFile) return null;
        if (assetFile.id) return assetFile.id;
        if (assetFile.path) {
            try {
                const result = await window.api.importAssets({ path: [assetFile.path], projectId, isGenericAsset: true });
                return result?.createdAssets?.[0]?.id || null;
            } catch (error) {
                console.error("Error uploading asset:", error);
                return null;
            }
        }
        return null;
    };

    const uploadAssets = async (vocab, projectId) => {
        const mainAssetId = await handleAssetUpload(vocab.mainAssetFile, projectId);
        const otherAssetIds = [];
        
        if (vocab.otherAssetsFiles?.length) {
            for (const file of vocab.otherAssetsFiles) {
                const assetId = await handleAssetUpload(file, projectId);
                if (assetId) otherAssetIds.push(assetId);
            }
        }
        
        return { mainAssetId, otherAssetIds };
    };

    const hasVocabularyChanged = (currentVocab, existingVocabs) => {
        const originalVocab = existingVocabs.find((existing) => existing.id === currentVocab.id);
        if (!originalVocab) return true;

        // Check main fields
        if ((originalVocab.option?.content || "") !== (currentVocab.option || "")) return true;
        if ((originalVocab.description?.content || "") !== (currentVocab.description || "")) return true;
        if ((originalVocab.external_link || "") !== (currentVocab.externalLink || "")) return true;

        // Check assets
        const originalMainAssetId = originalVocab.mainAsset?.id || null;
        const currentMainAssetId = currentVocab.mainAssetFile?.id || null;
        const hasNewMainAsset = currentVocab.mainAssetFile?.path && !currentVocab.mainAssetFile?.id;
        if (hasNewMainAsset || originalMainAssetId !== currentMainAssetId) return true;

        const originalOtherAssetIds = (originalVocab.vocabulariesGenericAssets || []).map((va) => va.genericAsset.id).sort().join(',');
        const currentOtherAssets = currentVocab.otherAssetsFiles || [];
        const currentOtherAssetIds = currentOtherAssets.map((file) => file.id).filter(Boolean).sort().join(',');
        const hasNewOtherAssets = currentOtherAssets.some((file) => file.path && !file.id);
        if (hasNewOtherAssets || originalOtherAssetIds !== currentOtherAssetIds) return true;

        // Check translations
        return secondaryLanguages.some((lang) => {
            const originalOption = getTranslationContent(originalVocab.option, lang.code);
            const originalDescription = getTranslationContent(originalVocab.description, lang.code);
            const currentOption = currentVocab[`option_${lang.id}`] || "";
            const currentDescription = currentVocab[`description_${lang.id}`] || "";
            return originalOption !== currentOption || originalDescription !== currentDescription;
        });
    };

    const prepareTranslation = (vocab, lang, field, originalVocab) => {
        const content = vocab[`${field}_${lang.id}`];
        if (!content?.trim()) return null;

        const translation = { language_id: lang.id, language_code: lang.code, content };
        const existingTranslation = originalVocab?.[field]?.translations?.find((t) => t.language_id === lang.id);
        if (existingTranslation) translation.id = existingTranslation.id;

        return translation;
    };

    const prepareVocabTranslations = (vocab) => {
        const originalVocab = (mode === "edit" && vocab.id && initialData?.vocabularies)
            ? initialData.vocabularies.find((v) => v.id === vocab.id)
            : null;

        const translations = { optionTranslations: [], descriptionTranslations: [] };
        
        secondaryLanguages.forEach((lang) => {
            const optionTranslation = prepareTranslation(vocab, lang, "option", originalVocab);
            const descriptionTranslation = prepareTranslation(vocab, lang, "description", originalVocab);
            
            if (optionTranslation) translations.optionTranslations.push(optionTranslation);
            if (descriptionTranslation) translations.descriptionTranslations.push(descriptionTranslation);
        });

        return translations;
    };

    const saveVocabulary = async (vocab, researchFieldId, projectId, languageId, isUpdate = false) => {
        const { mainAssetId, otherAssetIds } = await uploadAssets(vocab, projectId);
        const { optionTranslations, descriptionTranslations } = prepareVocabTranslations(vocab);
        
        const vocabData = {
            option: vocab.option,
            description: vocab.description || "",
            externalLink: vocab.externalLink || "",
            mainAsset: mainAssetId,
            optionTranslations: optionTranslations.length > 0 ? optionTranslations : undefined,
            descriptionTranslations: descriptionTranslations.length > 0 ? descriptionTranslations : undefined,
        };

        const result = isUpdate 
            ? await updateVocabularyAPI(vocab.id, vocabData)
            : await addVocabularyAPI(researchFieldId, { ...vocabData, languageId, otherAssets: otherAssetIds });

        if (result?.result && !result?.error) {
            if (isUpdate) {
                try {
                    await executeQuery("vocabulary_assets", "delete", { vocabularyId: vocab.id });
                    if (otherAssetIds.length > 0) await linkVocabularyAssets(vocab.id, otherAssetIds);
                } catch (error) {
                    console.error("Error managing vocabulary assets:", error);
                }
            } else {
                const createdVocab = result.result?.[0];
                if (createdVocab && otherAssetIds.length > 0) {
                    await linkVocabularyAssets(createdVocab.id, otherAssetIds);
                }
            }
        }
        
        return result;
    };

    const processVocabularies = async (vocabularies, researchFieldId, projectId, languageId, mode) => {
        const validVocabs = vocabularies.filter((vocab) => vocab.option?.trim());
        
        if (mode === "edit") {
            const existingVocabs = initialData.vocabularies || [];
            const vocabsToDelete = existingVocabs.filter((existing) => 
                !validVocabs.find((current) => current.id === existing.id)
            );

            await Promise.all([
                ...vocabsToDelete.map((vocab) => 
                    deleteVocabularyAPI(vocab.id).catch((error) => 
                        console.error(`Error deleting vocabulary ${vocab.id}:`, error)
                    )
                ),
                ...validVocabs.map((vocab) => {
                    const isUpdate = vocab.id && hasVocabularyChanged(vocab, existingVocabs);
                    const shouldSave = !vocab.id || isUpdate;
                    
                    return shouldSave 
                        ? saveVocabulary(vocab, researchFieldId, projectId, languageId, !!vocab.id)
                            .catch((error) => console.error("Error processing vocabulary:", error))
                        : Promise.resolve();
                })
            ]);
        } else {
            await Promise.all(validVocabs.map((vocab) => 
                saveVocabulary(vocab, researchFieldId, projectId, languageId, false)
            ));
        }
    };

    const handleVocabularyProcessing = async (researchFieldId, projectId, languageId, mode) => {
        try {
            await processVocabularies(localVocabularies, researchFieldId, projectId, languageId, mode);
        } catch (error) {
            console.error("Error processing vocabularies:", error);
            throw error;
        }
    };

    // Sync local changes back to the parent binding
    watch(() => localVocabularies, () => {
        value = [...localVocabularies];
        onChange?.(value);
    });

    // Register the processing function with the parent when the callback becomes available
    watch(() => onVocabulariesProcessed, (callback) => {
        if (callback) callback(handleVocabularyProcessing);
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
                        fallback: "Add Vocabulary item",
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

            {#each localVocabularies as vocab, index}
                <VocabularyRow
                    {vocab}
                    {index}
                    isLast={index === localVocabularies.length - 1}
                    {activeLanguageCode}
                    {languages}
                    getFieldErrors={(fieldName) => getFieldErrors(index, fieldName)}
                    onUpdate={(field, newValue) => updateVocabulary(index, field, newValue)}
                    onRemove={() => removeVocabulary(index)}
                    onMediaChange={(mediaData) => handleMediaChange(index, mediaData)}
                />
            {/each}
        {/if}
    </div>
{/if}


