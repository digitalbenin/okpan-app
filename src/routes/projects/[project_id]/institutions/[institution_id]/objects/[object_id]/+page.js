import { browser } from '$app/environment';
import {
    getObjectById,
} from "$lib/stores/ObjectsUtils.js";
import { getResearchFields } from "$lib/stores/ResearchFieldsUtils.js";
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, depends }) => {
    // Invalidate when institutions are updated elsewhere
    depends('app:institutions');
    if (!browser) return;

    const objectId = params.object_id;
    const projectId = params.project_id;

    // Load object data, research fields, and institutions for the project
    const [objectResponse, researchFieldsResponse, institutionsResponse] = await Promise.all([
        getObjectById(objectId),
        getResearchFields(projectId),
        getProjectInstitutions({ projectId, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' })
    ]);

    const institutionItems = (institutionsResponse?.result || []).map((inst) => ({
        value: inst.id,
        label: inst?.name?.content ?? ''
    }));

    depends("custom:object");
    return {
        object: objectResponse.result,
        researchFields: researchFieldsResponse.result || [],
        institutions: institutionItems
    }
};



