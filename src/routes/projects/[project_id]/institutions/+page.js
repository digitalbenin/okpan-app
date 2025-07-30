import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url, depends }) => {
    depends('app:institutions');
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize')
    const orderBy = url.searchParams.get('orderBy')
    const direction = url.searchParams.get('direction')
    const search = url.searchParams.get('search')
    const status = url.searchParams.get('status')
    const projectId = params.project_id
    const institutions = await getProjectInstitutions({ projectId, page: +page - 1, pageSize: +pageSize, orderBy, direction, search, status });

    return {
        institutions
    }
};