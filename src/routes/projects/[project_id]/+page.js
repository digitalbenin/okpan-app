import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url }) => {
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    console.log('page', page);
    console.log('pageSize', pageSize);
    const institutions = await getProjectInstitutions(params.id);
    return {
        institutions
    }
};

