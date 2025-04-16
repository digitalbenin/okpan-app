import { browser } from '$app/environment';
import { getProjectInstitutions } from "$lib/stores/InstitutionsUtils.js";
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, url, fetch }) => {
    if (!browser) return;
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('page-size')
    const projectId = params.project_id
    console.log('page', page);
    console.log('pageSize', pageSize);
    // console.log('id project for institution list', params.project_id);

    // Pass fetch to the data function (though it might not be used by executeQuery)
    const institutions = await getProjectInstitutions(projectId, +page - 1, +pageSize || 10, fetch);

    // Get content language store to fetch project languages
    const { getAvaliableLocalesForProject } = getContentLanguageStore();
    const projectLanguages = await getAvaliableLocalesForProject(projectId);

    return {
        institutions,
        projectLanguages
    }
};

