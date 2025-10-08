import { browser } from '$app/environment';
import { getObjects } from "$lib/stores/ObjectsUtils.js";

export const load = async ({ params, depends, url }) => {
    if (!browser) return;
    depends('app:objects');

    const projectId = params.project_id;

    // common params
    const pageSize = url.searchParams.get('pageSize')
    // objects params
    const page = url.searchParams.get('page');
    const orderBy = url.searchParams.get('orderBy')
    const direction = url.searchParams.get('direction')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    const searchField = url.searchParams.get('searchField')

    const options = {
        projectId,
        // institutionId,
        page: +page - 1,
        pageSize: +pageSize,
        orderBy: orderBy,
        direction: direction,
        search: search,
        status: status,
        searchField: searchField
    }

    console.log(options, "options")
    // Load all data in parallel
    const objectsData = await getObjects(options)


    const res = {
        objects: objectsData,
    };
    return res;
};

