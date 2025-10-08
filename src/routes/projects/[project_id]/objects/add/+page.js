import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    depends('app:institutions');

    const projectId = params.project_id;
    const institutionsResponse = await getProjectInstitutions({ projectId, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' });

    const institutionItems = (institutionsResponse?.result || []).map((inst) => ({
        value: inst.id,
        label: inst?.name?.content ?? ''
    }));

    return {
        institutions: institutionItems
    };
};