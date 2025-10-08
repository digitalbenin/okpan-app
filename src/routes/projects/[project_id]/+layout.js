import { browser } from '$app/environment';
import { getProject } from "$lib/stores/ProjectsUtils.js";
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";
import { getDisplayFields } from '$lib/stores/DisplayFieldsUtils.js';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';
import { getOntologyFields } from '$lib/stores/OntologyFieldsUtils.js';
import { getContentLanguageStore } from '$lib/stores/ContentLanguageStore.svelte.js';

const { getAvaliableLocalesForProject, setProjectLanguages } = getContentLanguageStore();

export const load = async ({ params, depends }) => {
    if (!browser) return;
    depends('app:project-shared');
    depends('app:projects');

    // Cache the current project ID in backend for optimized GraphQL queries
    try {
        await window.api.setCurrentProject(params.project_id);
    } catch (error) {
        console.warn('Failed to cache project ID:', error);
    }

    const project = await getProject(params.project_id);
    const displayFields = await getDisplayFields({ projectId: params.project_id });
    const researchFields = await getResearchFields(params.project_id);
    const ontologyFields = await getOntologyFields(params.project_id)
    const languages = await getAvaliableLocalesForProject(params.project_id);
    setProjectLanguages(languages);

    // Load institutions for the project (used by filters)
    const institutions = await getProjectInstitutions({
        projectId: params.project_id,
        page: 0,
        pageSize: 50,
        orderBy: 'created_at',
        direction: 'desc'
    });

    return {
        project,
        displayFields,
        researchFields,
        ontologyFields,
        languages,
        institutions
    };
};
