import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url, depends }) => {
    depends('app:institutions');
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    const orderBy = url.searchParams.get('orderBy')
    const direction = url.searchParams.get('direction')
    const search = url.searchParams.get('search')
    const projectId = params.project_id

    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize || 10, orderBy, direction, search);

    return {
        institutions
    }
};

