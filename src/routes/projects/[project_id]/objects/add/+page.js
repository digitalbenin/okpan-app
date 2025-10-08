import { browser } from '$app/environment';
import { getResearchFields } from "$lib/stores/ResearchFieldsUtils.js";
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, depends }) => {
    // Invalidate when institutions are updated elsewhere
    depends('app:institutions');
    if (!browser) return;

    const projectId = params.project_id;

    // Load research fields and institutions for the project
    const [researchFieldsResponse, institutionsResponse] = await Promise.all([
        getResearchFields(projectId),
        getProjectInstitutions({ projectId, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' })
    ]);

    const institutionItems = (institutionsResponse?.result || []).map((inst) => ({
        value: inst.id,
        label: inst?.name?.content ?? ''
    }));

    return {
        researchFields: researchFieldsResponse.result || [],
        institutions: institutionItems
    }
};