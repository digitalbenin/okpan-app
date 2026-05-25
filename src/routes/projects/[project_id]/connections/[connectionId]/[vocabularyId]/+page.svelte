<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { updateVocabulary, updateVocabularyAssets } from "$lib/api/ResearchFieldsApi.js";
    import { goto } from "$app/navigation";
    import VocabularyForm from "$lib/components/research_fields/VocabularyForm.svelte";

    const { data } = $props();
    const { t } = getTranslationStore();
    
    // Initial data
    const vocabulary = $derived(data.vocabulary);
    const researchField = $derived(data.researchField);
    const project = $derived(data.project);

    // Helper to extract initial translations for defaultValues
    const getInitialTranslations = () => {
        const trans = {};
        data.languages?.forEach(lang => {
            if (!lang.is_default) {
                // Check option translations
                // Match by ID or code to handle legacy data/ID mismatch
                const optTrans = vocabulary?.option?.translations?.find(t => 
                    t.language_id === lang.id || t.language?.code === lang.code
                );
                if (optTrans) trans[`translations_${lang.id}_option`] = optTrans.content;
                
                // Check description translations
                const descTrans = vocabulary?.description?.translations?.find(t => 
                    t.language_id === lang.id || t.language?.code === lang.code
                );
                if (descTrans) trans[`translations_${lang.id}_description`] = descTrans.content;
            }
        });
        return trans;
    };

    const initialValues = $derived({
        ...vocabulary,
        option: vocabulary?.option?.content || "",
        description: vocabulary?.description?.content || "",
        externalLink: vocabulary?.externalLink || vocabulary?.external_link || "",
        ...getInitialTranslations()
    });

    async function handleSave(values, mainAssetId, otherAssetIds) {
        // Prepare update payload
        const updateData = {
           option: values.option,
           description: values.description,
           externalLink: values.externalLink,
           mainAsset: mainAssetId,
           optionTranslations: [], 
           descriptionTranslations: [] 
        };

        // Collect translations from flat values
        data.languages?.forEach(lang => {
            if (!lang.is_default) {
                const optKey = `translations_${lang.id}_option`;
                const descKey = `translations_${lang.id}_description`;

                if (values[optKey] !== undefined && values[optKey] !== null) {
                    const content = values[optKey].toString();
                    if (content.trim()) {
                        const existing = vocabulary?.option?.translations?.find(t => 
                            t.language_id === lang.id || t.language?.code === lang.code
                        );
                        updateData.optionTranslations.push({ 
                            language_code: lang.code, 
                            content: content,
                            id: existing?.id
                        });
                    }
                }
                
                if (values[descKey] !== undefined && values[descKey] !== null) {
                     const content = values[descKey].toString();
                     if (content.trim()) {
                        const existing = vocabulary?.description?.translations?.find(t => 
                            t.language_id === lang.id || t.language?.code === lang.code
                        );
                        updateData.descriptionTranslations.push({ 
                            language_code: lang.code, 
                            content: content,
                            id: existing?.id
                        });
                     }
                }
            }
        });

        const finalUpdateData = JSON.parse(JSON.stringify(updateData));
        const res = await updateVocabulary(vocabulary.id, finalUpdateData);
        
        if (!res.error) {
            const assetsRes = await updateVocabularyAssets(vocabulary.id, otherAssetIds);
            if (!assetsRes.error) {
                goto(`/projects/${project.id}/connections`);
            }
        }
    }
</script>

{#if !data.missingEntity && vocabulary && researchField && project}
    <VocabularyForm
        data={data}
        project={project}
        researchField={researchField}
        initialValues={initialValues}
        linkedObjects={data.linkedObjects}
        linkedObjectsTotalCount={data.linkedObjectsTotalCount}
        linkedObjectsPage={data.linkedObjectsPage}
        linkedObjectsPageSize={data.linkedObjectsPageSize}
        title={t("common.edit-connection", {fallback: "Edit Connection"})}
        submitLabel={t("common.save", {fallback: "Save"})}
        onSubmit={handleSave}
        onCancel={() => window.history.back()}
    />
{/if}
