import { getProject } from "$lib/api/ProjectsApi.js";
import { getProjectInstitutions } from "$lib/api/InstitutionsApi.js";
import { getDisplayFields } from '$lib/api/DisplayFieldsApi.js';
import { getResearchFields } from '$lib/api/ResearchFieldsApi.js';
import { getOntologyFields } from '$lib/api/OntologyFieldsApi.js';
import { listContentLanguages, listContentLanguagesByProject } from '$lib/api/ContentLanguagesApi.js';
import { getAssetLocalStates } from '$lib/api/AssetsApi.js';

// Disable prerendering for this layout as it loads dynamic data
export const prerender = false;

export const load = async ({ params, depends }) => {
    depends('app:project-shared');
    depends('app:projects');
    depends('app:content-languages');
    depends('app:asset-sync');

    const project = await getProject(params.project_id);
    const displayFields = await getDisplayFields({ projectId: params.project_id });
    const researchFields = await getResearchFields(params.project_id);
    const ontologyFields = await getOntologyFields(params.project_id);
    const allLanguages = await listContentLanguages();
    const languages = await listContentLanguagesByProject(params.project_id);
    const assetLocalStates = await getAssetLocalStates(params.project_id);

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
        allLanguages,
        institutions,
        assetLocalStates
    };
};
