import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, url }) => {
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    const orderBy = url.searchParams.get('orderBy')
    const direction = url.searchParams.get('direction')
    const search = url.searchParams.get('search')
    const projectId = params.project_id
    // console.log('id project for institution list', params.project_id);

    // Pass fetch to the data function (though it might not be used by executeQuery)
    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize || 10, orderBy, direction, search);
    console.log('institutions', institutions);

    // Get content language store to fetch project languages
    const { getAvaliableLocalesForProject } = getContentLanguageStore();
    const projectLanguages = await getAvaliableLocalesForProject(projectId);

    return {
        institutions,
        projectLanguages
    }
};

