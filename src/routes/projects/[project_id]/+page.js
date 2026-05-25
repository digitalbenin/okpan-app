import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/api/InstitutionsApi.js";
import { getObjects } from "$lib/api/ObjectsApi.js";
import { getProjectActivity } from "$lib/api/ProjectActivityApi.js";

export const load = async ({ params, url, depends }) => {
    if (!browser) return;

    const objects = await getObjects({ projectId: params.project_id, orderBy: 'updated_at', direction: 'desc', pageSize: 25 });
    const institutions = await getProjectInstitutions({ projectId: params.project_id, page: 0, pageSize: 25, orderBy: 'created_at', direction: 'desc' });
    const activities = await getProjectActivity(params.project_id, 10);

    return {
        objects,
        institutions,
        activities
    }
};

