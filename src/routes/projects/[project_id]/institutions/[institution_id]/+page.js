import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getAssets } from "$lib/stores/AssetsUtils.js";
import { getObjects } from '$lib/stores/ObjectsUtils.js';
import { getDatasources as fetchDatasources } from '$lib/stores/DatasourcesUtils.js';
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    console.log("loading institution data");
    depends('custom:objects', 'custom:assets', 'custom:datasources')


    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // Get content language store to fetch project languages
    const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Load all data in parallel for better performance
    const [institutionData, assetsData, objectsData, projectLanguages, datasourcesResponse] = await Promise.all([
        getInstitution(institutionId),
        getAssets(projectId, institutionId),
        getObjects(projectId, institutionId),
        getAvaliableLocalesForProject(projectId),
        fetchDatasources(projectId, institutionId)
    ]);

    // Extract the actual datasources array from the response
    const datasources = datasourcesResponse?.result || [];
    // Log errors if any
    if (datasourcesResponse?.error) {
        console.error("Error fetching datasources in +page.js:", datasourcesResponse.error);
        // Potentially return an error state or show a notification
    }

    console.log("institution data loaded", assetsData);

    // Assuming getAssets, getObjects, getInstitution return data directly or handle errors internally
    // Adjust if they actually return { result: ..., error: ... }
    const institution = institutionData; // Assuming direct return
    const assets = assetsData || [];      // Assuming direct return, provide fallback
    const objects = objectsData || [];     // Assuming direct return, provide fallback



    return {
        institution,
        assets,
        objects,
        datasources,
        projectId,
        institutionId,
        projectLanguages
    }
};

