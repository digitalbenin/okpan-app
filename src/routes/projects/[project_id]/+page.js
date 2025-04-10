import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url }) => {
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    const projectId = params.project_id
    // console.log('page', page);
    // console.log('pageSize', pageSize);
    // console.log('id project for institution list', params.project_id);
    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize);
    return {
        institutions
    }
};

