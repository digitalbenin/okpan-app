import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getAssets } from "$lib/stores/AssetsUtils.js";
import { getObjects } from '$lib/stores/ObjectsUtils.js';
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params }) => {
    if (!browser) return;

    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // Get content language store to fetch project languages
    const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Load all data in parallel for better performance
    const [institution, assets, objects, projectLanguages] = await Promise.all([
        getInstitution(institutionId),
        getAssets(projectId, institutionId),
        getObjects(projectId, institutionId),
        getAvaliableLocalesForProject(projectId)
    ]);

    return {
        institution,
        assets,
        objects,
        projectId,
        institutionId,
        projectLanguages
    }
};

