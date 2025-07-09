import { browser } from '$app/environment';
import { getProject } from "$lib/stores/ProjectsUtils.js";
import { getResearchFields } from "$lib/stores/ResearchFieldsUtils.js";
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    depends('app:projects', 'app:research_fields', 'app:content_languages');
    const project = await getProject(params.project_id);
    const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Fetch research fields with vocabularies
    const researchFieldsResponse = await getResearchFields(params.project_id);
    const researchFields = researchFieldsResponse?.result || [];
    const projectLanguages = await getAvaliableLocalesForProject(params.project_id);
    // Log research fields with their vocabularies to console
    //console.log("Project data:", projectLanguages, researchFields, project);

    return {
        project,
        researchFields,
        projectLanguages
    }
};