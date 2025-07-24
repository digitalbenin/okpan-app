import { browser } from '$app/environment';
import { getProject } from "$lib/stores/ProjectsUtils.js";
import { getDisplayFields } from '$lib/stores/DisplayFieldsUtils.js';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';



export const load = async ({ params, depends }) => {
    if (!browser) return;
    depends('app:project-shared');
    const project = await getProject(params.project_id);
    const displayFields = await getDisplayFields({ projectId: params.project_id });
    const researchFields = await getResearchFields(params.project_id);
    return {
        project,
        displayFields,
        researchFields
    };
};

