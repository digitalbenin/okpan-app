<script>
    import { goto } from "$app/navigation";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { createTranslation } from "$lib/api/TranslationsApi.js";
    import VocabularyForm from "$lib/components/research_fields/VocabularyForm.svelte";
    import { addVocabulary, updateVocabularyAssets } from "$lib/api/ResearchFieldsApi.js";

    let { data } = $props();
    const { t } = getTranslationStore();
    const project = data.project;
    const researchField = data.researchField;
    const defaultLanguage = data.languages?.find((l) => l.is_default) || data.languages?.[0];

    const createTranslations = async (translations, textId) => {
        if (!translations?.length || !textId) return;
        for (const tr of translations) {
            const language = data.languages?.find(l => l.code === tr.language_code);
            if (!language) continue;
            try {
                await createTranslation({ textId, languageId: language.id, content: tr.content });
            } catch (e) {
                console.error("Failed to create translation", { textId, tr, error: e });
            }
        }
    };

    async function handleSubmit(values, mainAssetId, otherAssetIds) {
        console.group("Add Connection: handleSubmit");
        console.log("values:", values);
        console.log("mainAssetId:", mainAssetId);
        console.log("otherAssetIds:", otherAssetIds);
        console.log("languages:", data.languages);

        // Prepare params for addVocabulary
        const params = {
            languageId: defaultLanguage?.id,
            option: values.option,
            description: values.description,
            externalLink: values.externalLink,
            mainAsset: mainAssetId,
            // Collect translations
            optionTranslations: [], 
            descriptionTranslations: [] 
        };
        
            data.languages?.forEach(lang => {
            if (!lang.is_default) {
                const optKey = `translations_${lang.id}_option`;
                const descKey = `translations_${lang.id}_description`;
                
                     const optVal = values[optKey];
                     const descVal = values[descKey];

                     if (optVal !== undefined && optVal !== null && String(optVal).trim()) {
                         params.optionTranslations.push({ language_code: lang.code, content: String(optVal).trim() });
                }
                
                     if (descVal !== undefined && descVal !== null && String(descVal).trim()) {
                         params.descriptionTranslations.push({ language_code: lang.code, content: String(descVal).trim() });
                }
            }
        });

          console.log("addVocabulary params:", params);

          const result = await addVocabulary(researchField.id, params);
          console.log("addVocabulary result:", result);
        
        if (result.error) {
             console.error("Failed to add connection", result.error);
             console.groupEnd();
           return false;
        }

        // Logic to extract ID from result.
        const newVocabulary = result.result?.insertIntoVocabularies?.[0];
        const newVocabularyId = newVocabulary?.id;
        const optionTextId = newVocabulary?.option_id;
        const descriptionTextId = newVocabulary?.description_id;

        console.log("created vocabulary:", { newVocabularyId, optionTextId, descriptionTextId });

        // IMPORTANT: addVocabulary query chain does NOT persist translations.
        // We must create translation rows after the texts are created (same approach as ResearchFieldForm).
        await createTranslations(params.optionTranslations, optionTextId);
        await createTranslations(params.descriptionTranslations, descriptionTextId);

        if (newVocabularyId && otherAssetIds && otherAssetIds.length > 0) {
             const assetRes = await updateVocabularyAssets(newVocabularyId, otherAssetIds);
             if (assetRes.error) {
                 console.error("Failed to add additional assets", assetRes.error);
             }
        }
        
        console.groupEnd();
        window.setTimeout(() => {
            goBack();
        }, 0);
    }

    function goBack() {
        goto(`/projects/${project.id}/connections/${researchField.id}`);
    }
</script>

<VocabularyForm 
    {data} 
    {researchField} 
    {project} 
    title={t("common.add-connection", { fallback: "Add Connection" })}
    submitLabel={t("common.create", { fallback: "Create" })}
    onSubmit={handleSubmit}
    onCancel={goBack}
/>
