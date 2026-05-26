import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/api/InstitutionsApi.js";
import { getResearchFields } from "$lib/api/ResearchFieldsApi.js";
import { getOntologyFields } from "$lib/api/OntologyFieldsApi.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    depends('app:institutions');

    const projectId = params.project_id;
    const [institutionsResponse, researchFieldsResponse, ontologyFieldsResponse] = await Promise.all([
        getProjectInstitutions({ projectId, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' }),
        getResearchFields(projectId),
        getOntologyFields(projectId)
    ]);

    const institutionItems = (institutionsResponse?.result || []).map((inst) => ({
        value: inst.id,
        label: inst?.name?.content ?? ''
    }));

    return {
        institutions: institutionItems,
        researchFields: researchFieldsResponse || [],
        ontologyFields: ontologyFieldsResponse || []
    };
};