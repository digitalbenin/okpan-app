import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";

export const load = async ({ params, url, depends }) => {
    depends('app:institutions');
    if (!browser) return;
    const rawPage = Number.parseInt(url.searchParams.get('page') ?? '', 10);
    const rawPageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '', 10);
    const orderBy = url.searchParams.get('orderBy') || 'name';
    const direction = url.searchParams.get('direction') === 'desc' ? 'desc' : 'asc';
    const search = url.searchParams.get('search') || undefined;
    const rawStatus = url.searchParams.get('status');
    const status = rawStatus && rawStatus !== 'all' ? rawStatus : undefined;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 25;
    const projectId = params.project_id;
    const institutions = await getProjectInstitutions({
        projectId,
        page: page - 1,
        pageSize,
        orderBy,
        direction,
        search,
        status
    });

    return {
        institutions
    };
};