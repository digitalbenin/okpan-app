import { browser } from '$app/environment';
import { getInstitution } from "$lib/stores/InstitutionsUtils.js";
import { getAssets, getTotalAssetsForInstitution } from "$lib/stores/AssetsUtils.js";
import { getObjects, getTotalObjectsForInstitution } from '$lib/stores/ObjectsUtils.js';
import { getDatasources as fetchDatasources } from '$lib/stores/DatasourcesUtils.js';
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

export const load = async ({ params, depends }) => {
    if (!browser) return;
    console.log("loading institution page data for:", params.institution_id);
    depends('app:objects', 'app:assets', 'app:datasources', 'app:institution');

    const projectId = params.project_id;
    const institutionId = params.institution_id;

    // Initial parameters for paginated lists (can be adjusted or made dynamic later)
    const initialPageOptions = {
        page: 0,
        pageSize: 10, // Default page size
        // You can add other default filters here if needed, e.g., initial search term, type
        projectId,
        institutionId
    };

    // Get content language store to fetch project languages
    const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Load all data in parallel
    const [
        institutionData,
        initialAssetsData,
        totalInstitutionAssetsData,
        initialObjectsData,
        totalInstitutionObjectsData,
        projectLanguages,
        datasourcesResponse // Assuming fetchDatasources will also return { items, totalCount }
    ] = await Promise.all([
        getInstitution(institutionId),
        getAssets(initialPageOptions), // For initial filtered/paginated list and its filtered count
        getTotalAssetsForInstitution(projectId, institutionId), // For total unfiltered assets in this institution
        getObjects(initialPageOptions), // For initial filtered/paginated list and its filtered count
        getTotalObjectsForInstitution(projectId, institutionId), // For total unfiltered objects in this institution
        getAvaliableLocalesForProject(projectId),
        fetchDatasources(projectId, institutionId)
    ]);


    console.log("Institution page data fully loaded for:", institutionId);

    const res = {
        institution: institutionData?.result || institutionData, // Adjust based on getInstitution's actual return

        assets: {
            items: initialAssetsData?.items || [],
            filteredCount: initialAssetsData?.totalCount || 0,
            institutionTotal: totalInstitutionAssetsData?.totalCount || 0
        },
        objects: {
            items: initialObjectsData?.items || [],
            filteredCount: initialObjectsData?.totalCount || 0,
            institutionTotal: totalInstitutionObjectsData?.totalCount || 0
        },

        projectId,
        institutionId,
        datasources: datasourcesResponse?.result || [],
        projectLanguages: projectLanguages?.result || projectLanguages || [] // Adjust as per getAvaliableLocalesForProject's return
    };
    console.log("institution page data loaded", res);
    return res;
};

