<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import VocabularyForm from "$lib/components/research_fields/VocabularyForm.svelte";

    let { data } = $props();
    const { t } = getTranslationStore();
    const project = data.project;
    const researchField = data.researchField;
</script>

<VocabularyForm 
    {data} 
    {researchField} 
    {project} 
    title={t("common.add-connection", { fallback: "Add Connection" })}
    submitLabel={t("common.create", { fallback: "Create" })}
    onCancel={() => window.history.back()}
/>
