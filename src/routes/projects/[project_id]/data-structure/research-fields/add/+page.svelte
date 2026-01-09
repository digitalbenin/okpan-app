<script>
    import ResearchFieldForm from "$lib/components/research_fields/ResearchFieldForm.svelte";
    import { page } from "$app/stores";

    let { data } = $props();

    // Extract languages from layout data
    const { languages } = data;
    
    // Get type from query params
    const type = $page.url.searchParams.get("type");
</script>

<div class="container-fluid my-4">
    <ResearchFieldForm
        {languages}
        mode="create"
        projectId={$page.params.project_id}
        fixedType={type}
    />
</div>
