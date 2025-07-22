import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";
import { getObjects } from "$lib/stores/ObjectsUtils.js";
import { getActions } from "$lib/stores/ActionsUtils.js";

export const load = async ({ params, url, depends }) => {
    // depends('app:institutions');
    if (!browser) return;


    const objects = await getObjects({ projectId: params.project_id, orderBy: 'updated_at', direction: 'desc', pageSize: 5 });
    const objectsInProgress = await getObjects({ projectId: params.project_id, orderBy: 'updated_at', direction: 'desc', pageSize: 5, status: 'in progress' });
    const institutions = await getProjectInstitutions({ projectId: params.project_id, page: 0, pageSize: 3, orderBy: 'created_at', direction: 'desc' });
    const actions = await getActions({ projectId: params.project_id, limit: 10 });

    return {
        objects,
        objectsInProgress,
        institutions,
        actions
    }
};

