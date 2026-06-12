<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import VocabularyForm from "$lib/components/research_fields/VocabularyForm.svelte";

    const { data } = $props();
    const { t } = getTranslationStore();
    
    // Initial data
    const vocabulary = $derived(data.vocabulary);
    const researchField = $derived(data.researchField);
    const project = $derived(data.project);

    const initialValues = $derived({
        ...vocabulary,
        option: vocabulary?.option?.content || "",
        description: vocabulary?.description?.content || "",
        externalLink: vocabulary?.externalLink || vocabulary?.external_link || "",
    });
</script>

{#if !data.missingEntity && vocabulary && researchField && project}
    <VocabularyForm
        data={data}
        project={project}
        researchField={researchField}
        {vocabulary}
        {initialValues}
        linkedObjects={data.linkedObjects}
        linkedObjectsTotalCount={data.linkedObjectsTotalCount}
        linkedObjectsPage={data.linkedObjectsPage}
        linkedObjectsPageSize={data.linkedObjectsPageSize}
        title={t("common.edit-connection", {fallback: "Edit Connection"})}
        submitLabel={t("common.save", {fallback: "Save"})}
        onCancel={() => window.history.back()}
    />
{/if}
