import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/api/InstitutionsApi.js";

export const load = async ({ params }) => {
    if (!browser) return;
    const institutions = await getProjectInstitutions({ projectId: params.project_id, page: 0, pageSize: 50, orderBy: 'created_at', direction: 'desc' });
    return {
        institutions: institutions?.result || [],
    }
};

