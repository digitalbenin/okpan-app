import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url, depends }) => {
    depends('app:institutions');
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    const projectId = params.project_id
    console.log('page', page);
    console.log('pageSize', pageSize);
    // console.log('id project for institution list', params.project_id);

    // Pass fetch to the data function (though it might not be used by executeQuery)
    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize || 10);



    return {
        institutions
    }
};

