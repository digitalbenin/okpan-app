import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url, depends }) => {
    depends('app:institutions');
    if (!browser) return;
    const page = url.searchParams.get('iPage');
    const pageSize = url.searchParams.get('iPageSize')
    const orderBy = url.searchParams.get('iOrderBy')
    const direction = url.searchParams.get('iDirection')
    const search = url.searchParams.get('iSearch')
    const projectId = params.project_id

    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize, orderBy, direction, search);

    return {
        institutions
    }
};

