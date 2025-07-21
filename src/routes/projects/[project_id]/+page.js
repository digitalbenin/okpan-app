import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";
import { getObjects } from "$lib/stores/ObjectsUtils.js";
import { getActions } from "$lib/stores/ActionsUtils.js";

export const load = async ({ params, url, depends }) => {
    // depends('app:institutions');
    if (!browser) return;
    // const page = url.searchParams.get('iPage');
    // const pageSize = url.searchParams.get('iPageSize')
    // const orderBy = url.searchParams.get('iOrderBy')
    // const direction = url.searchParams.get('iDirection')
    // const search = url.searchParams.get('iSearch')
    // const projectId = params.project_id

    // const institutions = await getProjectInstitutions({ projectId, page: +page - 1, pageSize: +pageSize, orderBy, direction, search });
    const objects = await getObjects({ projectId: params.project_id, orderBy: 'updated_at', direction: 'desc', pageSize: 5 });
    const objectsInProgress = await getObjects({ projectId: params.project_id, orderBy: 'updated_at', direction: 'desc', pageSize: 5, status: 'in progress' });
    const institutions = await getProjectInstitutions({ projectId: params.project_id, page: 0, pageSize: 3, orderBy: 'created_at', direction: 'desc' });
    // const actions = await getActions({ projectId: params.project_id, limit: 10 }); the correct one
    const actions = await getActions();
    return {
        objects,
        objectsInProgress,
        institutions,
        actions
    }
};

